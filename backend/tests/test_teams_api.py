"""Hire Devs over REST with real PostgreSQL: teams, candidacies, conversations and constraints."""

from datetime import date

import pytest

from nextnode.domain.projects import Project, ProjectDetails, ProjectKind, Team
from nextnode.infrastructure.container import get_container, override_container
from nextnode.infrastructure.persistence.models import (
    ConversationModel,
    TeamCandidacyModel,
    TeamMembershipModel,
    TeamModel,
)
from tests.conversation_fakes import make_account


@pytest.fixture(autouse=True)
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def people(db):
    ids = {
        "client": make_account("user_client", "Grace", "client"),
        "lead": make_account("user_lead", "Ada", "developer"),
        "other_lead": make_account("user_other_lead", "Edsger", "developer"),
    }
    for n in range(7):
        ids[f"dev{n}"] = make_account(f"user_dev{n}", f"Dev {n}", "developer")
    return ids


def make_project(owner: int, lead: int | None, kind: ProjectKind = ProjectKind.CLIENT) -> int:
    budget = 200_000 if kind is ProjectKind.CLIENT else None
    details = ProjectDetails("Booking app", "A booking app for a yoga studio.", (), date(2027, 1, 1), budget)
    record = get_container().projects.add(Project.publish(kind, owner, details), Team.for_new_project(lead))
    assert record.project.id is not None
    return record.project.id


@pytest.fixture
def project(people) -> int:
    return make_project(people["client"], people["lead"])


def set_size(api, auth, project_id, size, sub="user_lead"):
    return api.put(f"/api/projects/{project_id}/team/size/", {"size": size}, format="json", **auth(sub))


# --- team size ------------------------------------------------------------------


def test_the_lead_sets_the_size(api, auth, project):
    response = set_size(api, auth, project, 6)
    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["size"], data["open_spots"], data["developer_spots"], data["status"]) == (6, 5, 5, "open")
    assert TeamModel.objects.get(project_id=project).team_size == 6


@pytest.mark.parametrize("size", [4, 8])
def test_a_size_outside_the_rule_is_refused_naming_it(api, auth, project, size):
    response = set_size(api, auth, project, size)
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "TEAM_SIZE_INVALID"
    assert "5 to 7 people including the Team Lead" in error["message"]
    assert "size" in error["fields"]


def test_a_size_that_is_not_a_number_is_a_field_error(api, auth, project):
    response = set_size(api, auth, project, "lots")
    assert response.status_code == 400
    assert "size" in response.json()["error"]["fields"]


@pytest.mark.parametrize("sub", ["user_client", "user_dev0", "user_other_lead"])
def test_only_this_projects_lead_sets_the_size(api, auth, project, sub):
    assert set_size(api, auth, project, 6, sub=sub).status_code == 403


def test_a_missing_project_is_404_and_no_token_is_401(api, auth, project):
    assert set_size(api, auth, 99999, 6).status_code == 404
    assert api.put(f"/api/projects/{project}/team/size/", {"size": 6}, format="json").status_code == 401


def test_a_developer_idea_is_sized_by_its_creator(api, auth, people):
    idea = make_project(people["lead"], people["lead"], ProjectKind.DEVELOPER)
    assert set_size(api, auth, idea, 5).status_code == 200


def test_a_client_project_without_a_lead_refuses_everyone(api, auth, people):
    posted = make_project(people["client"], None)
    assert set_size(api, auth, posted, 5, sub="user_client").status_code == 403


# --- applications ---------------------------------------------------------------


def apply(api, auth, project_id, sub):
    return api.post(f"/api/projects/{project_id}/team/applications/", **auth(sub))


def decide(api, auth, candidacy_id, action, sub):
    return api.post(f"/api/team-applications/{candidacy_id}/{action}/", **auth(sub))


def test_apply_opens_the_conversation_and_a_second_application_is_409(api, auth, project, people):
    set_size(api, auth, project, 5)
    response = apply(api, auth, project, "user_dev0")
    assert response.status_code == 201
    data = response.json()["data"]
    assert (data["kind"], data["status"]) == ("application", "pending")
    assert (data["lead_account_id"], data["developer_account_id"]) == (people["lead"], people["dev0"])
    conversation = ConversationModel.objects.get(pk=data["conversation_id"])
    assert (conversation.subject_kind, conversation.subject_id) == ("team_candidacy", data["id"])
    participants = set(conversation.participants.values_list("account_id", flat=True))
    assert participants == {people["lead"], people["dev0"]}

    second = apply(api, auth, project, "user_dev0")
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_CANDIDACY"


def test_clients_and_the_lead_cannot_apply_and_missing_projects_are_404(api, auth, project):
    set_size(api, auth, project, 5)
    assert apply(api, auth, project, "user_client").status_code == 403
    assert apply(api, auth, project, "user_lead").status_code == 409
    assert apply(api, auth, 99999, "user_dev0").status_code == 404


def test_accepting_an_application_adds_the_member(api, auth, project, people):
    set_size(api, auth, project, 5)
    candidacy = apply(api, auth, project, "user_dev0").json()["data"]["id"]
    assert decide(api, auth, candidacy, "accept", "user_dev0").status_code == 403  # not their call
    assert not TeamMembershipModel.objects.filter(account_id=people["dev0"]).exists()

    response = decide(api, auth, candidacy, "accept", "user_lead")
    assert response.status_code == 200
    membership = TeamMembershipModel.objects.get(account_id=people["dev0"])
    assert (membership.role, membership.status) == ("member", "approved")
    assert decide(api, auth, candidacy, "accept", "user_lead").status_code == 409  # only once
    assert TeamCandidacyModel.objects.get(pk=candidacy).status == "accepted"


@pytest.mark.parametrize(
    ("action", "sub", "status", "reason"),
    [
        ("reject", "user_lead", "rejected", "The Team Lead turned down this application"),
        ("withdraw", "user_dev0", "withdrawn", "The developer withdrew their application"),
    ],
)
def test_rejecting_or_withdrawing_closes_the_conversation(api, auth, project, action, sub, status, reason):
    set_size(api, auth, project, 5)
    data = apply(api, auth, project, "user_dev0").json()["data"]
    response = decide(api, auth, data["id"], action, sub)
    assert response.status_code == 200
    assert response.json()["data"]["status"] == status
    conversation = ConversationModel.objects.get(pk=data["conversation_id"])
    assert (conversation.status, conversation.close_reason) == ("closed", reason)


def test_wrong_people_get_403_or_404_on_a_decision(api, auth, project):
    set_size(api, auth, project, 5)
    candidacy = apply(api, auth, project, "user_dev0").json()["data"]["id"]
    assert decide(api, auth, candidacy, "reject", "user_dev0").status_code == 403
    assert decide(api, auth, candidacy, "withdraw", "user_lead").status_code == 403
    for action in ("accept", "reject", "withdraw"):
        assert decide(api, auth, candidacy, action, "user_dev1").status_code == 404
        assert decide(api, auth, candidacy, action, "user_client").status_code == 404
        assert decide(api, auth, candidacy, action, "user_other_lead").status_code == 404


# --- invitations ----------------------------------------------------------------


def invite(api, auth, project_id, developer_id, sub="user_lead"):
    body = {"developer_account_id": developer_id}
    return api.post(f"/api/projects/{project_id}/team/invitations/", body, format="json", **auth(sub))


def answer(api, auth, candidacy_id, action, sub):
    return api.post(f"/api/team-invitations/{candidacy_id}/{action}/", **auth(sub))


def test_invite_opens_the_conversation_and_only_the_invitee_can_accept(api, auth, project, people):
    set_size(api, auth, project, 5)
    response = invite(api, auth, project, people["dev0"])
    assert response.status_code == 201
    data = response.json()["data"]
    assert (data["kind"], data["status"]) == ("invitation", "pending")
    conversation = ConversationModel.objects.get(pk=data["conversation_id"])
    assert conversation.subject_kind == "team_candidacy"
    assert not TeamMembershipModel.objects.filter(account_id=people["dev0"]).exists()

    assert answer(api, auth, data["id"], "accept", "user_lead").status_code == 403
    assert answer(api, auth, data["id"], "accept", "user_dev1").status_code == 404
    assert answer(api, auth, data["id"], "accept", "user_dev0").status_code == 200
    assert TeamMembershipModel.objects.get(account_id=people["dev0"]).role == "member"


def test_inviting_is_for_the_lead_and_for_developers(api, auth, project, people):
    set_size(api, auth, project, 5)
    assert invite(api, auth, project, people["dev0"], sub="user_dev1").status_code == 403
    assert invite(api, auth, project, people["dev0"], sub="user_client").status_code == 403
    assert invite(api, auth, project, people["dev0"], sub="user_other_lead").status_code == 403
    assert invite(api, auth, project, people["client"]).status_code == 404
    assert invite(api, auth, project, 99999).status_code == 404
    assert invite(api, auth, 99999, people["dev0"]).status_code == 404
    assert invite(api, auth, project, "someone").status_code == 400
    assert invite(api, auth, project, people["dev0"]).status_code == 201
    assert invite(api, auth, project, people["dev0"]).status_code == 409


def test_declining_closes_the_conversation(api, auth, project, people):
    set_size(api, auth, project, 5)
    data = invite(api, auth, project, people["dev0"]).json()["data"]
    assert answer(api, auth, data["id"], "decline", "user_lead").status_code == 403
    assert answer(api, auth, data["id"], "decline", "user_dev0").status_code == 200
    conversation = ConversationModel.objects.get(pk=data["conversation_id"])
    assert (conversation.status, conversation.close_reason) == (
        "closed",
        "The developer declined the invitation",
    )
    assert answer(api, auth, data["id"], "accept", "user_dev0").status_code == 409
