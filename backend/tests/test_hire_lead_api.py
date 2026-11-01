"""Hire Lead over REST with real PostgreSQL. #3's projects don't exist yet, so a
fake stands in for them; candidacies, conversations and constraints are real."""

import threading
from uuid import UUID

import pytest
from django.db import connections

from nextnode.domain.hiring import LeadProject
from nextnode.infrastructure.container import get_container, override_container
from nextnode.infrastructure.persistence.models import ConversationModel, LeadCandidacyModel
from tests.conversation_fakes import make_account
from tests.hiring_fakes import FakeLeadProjects

PROJECT = 10


@pytest.fixture
def projects():
    return FakeLeadProjects()


@pytest.fixture
def people(db, projects):
    ids = {
        "client": make_account("user_client", "Grace", "client"),
        "ada": make_account("user_ada", "Ada", "developer"),
        "linus": make_account("user_linus", "Linus", "developer"),
    }
    projects.put(
        LeadProject(PROJECT, ids["client"], client_funded=True, status="Posted", lead_account_id=None)
    )
    return ids


@pytest.fixture(autouse=True)
def container(verifier, projects):
    with override_container(token_verifier=verifier, lead_projects=projects):
        yield


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


def apply(api, auth, sub, note=""):
    return api.post(f"/api/projects/{PROJECT}/lead-applications/", {"note": note}, format="json", **auth(sub))


def invite(api, auth, developer_id):
    body = {"developer_account_id": developer_id}
    return api.post(f"/api/projects/{PROJECT}/lead-invitations/", body, format="json", **auth("user_client"))


@pytest.mark.django_db
def test_apply_opens_the_conversation_and_a_second_application_is_409(api, auth, people):
    response = apply(api, auth, "user_ada", "I've led React teams.")
    assert response.status_code == 201
    data = response.json()["data"]
    assert (data["status"], data["note"]) == ("candidate", "I've led React teams.")
    conversation = ConversationModel.objects.get(pk=data["conversation_id"])
    assert conversation.subject_kind == "lead_application"
    assert apply(api, auth, "user_ada").status_code == 409


@pytest.mark.django_db
def test_clients_cannot_apply_and_missing_projects_are_404(api, auth, people):
    assert apply(api, auth, "user_client").status_code == 403
    response = api.post("/api/projects/999/lead-applications/", {}, format="json", **auth("user_ada"))
    assert response.status_code == 404


@pytest.mark.django_db
def test_invite_accept_and_hire_through_the_api(api, auth, people):
    invited = invite(api, auth, people["ada"]).json()["data"]
    assert invited["status"] == "invited"
    assert invite(api, auth, people["ada"]).status_code == 409  # duplicate invitation

    seen_by_ada = api.get(f"/api/lead-candidacies/{invited['id']}/", **auth("user_ada")).json()["data"]
    assert seen_by_ada["actions"] == {"accept": True, "decline": True, "withdraw": False, "hire": False}
    assert api.get(f"/api/lead-candidacies/{invited['id']}/", **auth("user_linus")).status_code == 404

    hire_url = f"/api/lead-candidacies/{invited['id']}/hire/"
    assert api.post(hire_url, **auth("user_client")).status_code == 409  # not accepted yet
    assert api.post(f"/api/lead-invitations/{invited['id']}/accept/", **auth("user_ada")).status_code == 200
    assert api.post(hire_url, **auth("user_ada")).status_code == 403  # only the client hires

    linus = apply(api, auth, "user_linus").json()["data"]
    hired = api.post(hire_url, **auth("user_client"))
    assert hired.status_code == 200
    assert hired.json()["data"]["status"] == "hired"
    assert api.post(hire_url, **auth("user_client")).status_code == 409  # only once

    closed = ConversationModel.objects.get(pk=linus["conversation_id"])
    assert (closed.status, closed.close_reason) == ("closed", "Another candidate was hired.")
    assert LeadCandidacyModel.objects.get(pk=linus["id"]).status == "closed"


@pytest.mark.django_db
def test_decline_and_withdraw_close_their_conversations(api, auth, people):
    invited = invite(api, auth, people["ada"]).json()["data"]
    assert api.post(f"/api/lead-invitations/{invited['id']}/decline/", **auth("user_ada")).status_code == 200
    assert ConversationModel.objects.get(pk=invited["conversation_id"]).status == "closed"

    applied = apply(api, auth, "user_linus").json()["data"]
    withdraw_url = f"/api/lead-applications/{applied['id']}/withdraw/"
    assert api.post(withdraw_url, **auth("user_linus")).status_code == 200
    assert ConversationModel.objects.get(pk=applied["conversation_id"]).close_reason == (
        "The developer withdrew their application."
    )


@pytest.mark.django_db
def test_with_real_projects_from_3_an_unknown_project_is_404(api, auth, people):
    from nextnode.infrastructure.persistence.projects import DjangoLeadProjects

    with override_container(lead_projects=DjangoLeadProjects()):
        assert apply(api, auth, "user_ada").status_code == 404


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_hires_cannot_both_succeed(people, projects):
    from nextnode.application.ports import Actor
    from nextnode.domain.accounts import Role

    client = Actor("user_client", None, account_id=people["client"], role=Role.CLIENT)
    ids = []
    for name in ("ada", "linus"):
        developer = Actor(f"user_{name}", None, account_id=people[name], role=Role.DEVELOPER)
        ids.append(UUID(get_container().apply_to_lead.execute(developer, PROJECT).id))

    barrier = threading.Barrier(2)
    outcomes: list[str] = []

    def hire(candidacy_id: UUID) -> None:
        try:
            barrier.wait()
            get_container().hire_team_lead.execute(client, candidacy_id)
            outcomes.append("hired")
        except Exception as error:
            outcomes.append(type(error).__name__)
        finally:
            connections.close_all()

    # The stand-in for #3 has no row lock, so only the database constraint stops a double hire.
    threads = [threading.Thread(target=hire, args=(candidacy,)) for candidacy in ids]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(outcomes) == ["LeadAlreadyHiredError", "hired"]
    assert LeadCandidacyModel.objects.filter(status="hired").count() == 1


@pytest.mark.django_db
def test_project_lead_chats_over_the_api(api, auth, people):
    applied = apply(api, auth, "user_ada").json()["data"]
    invite(api, auth, people["linus"])
    url = f"/api/projects/{PROJECT}/lead-chats/"

    seen_by_client = api.get(url, **auth("user_client")).json()["data"]
    assert [(c["developer_name"], c["kind"]) for c in seen_by_client] == [
        ("Ada", "application"),
        ("Linus", "invitation"),
    ]
    assert seen_by_client[0]["conversation_id"] == applied["conversation_id"]

    seen_by_ada = api.get(url, **auth("user_ada")).json()["data"]
    assert [c["developer_name"] for c in seen_by_ada] == ["Ada"]
    assert api.get("/api/projects/999/lead-chats/", **auth("user_client")).status_code == 404


@pytest.mark.django_db
def test_my_lead_candidacies_over_the_api(api, auth, people):
    apply(api, auth, "user_ada")
    invite(api, auth, people["linus"])
    url = "/api/lead-candidacies/mine/"

    seen_by_client = api.get(url, **auth("user_client")).json()["data"]
    assert [(c["developer_name"], c["kind"]) for c in seen_by_client] == [
        ("Linus", "invitation"),
        ("Ada", "application"),
    ]
    seen_by_linus = api.get(url, **auth("user_linus")).json()["data"]
    assert [(c["client_name"], c["status"], c["project_id"]) for c in seen_by_linus] == [
        ("Grace", "invited", PROJECT)
    ]
