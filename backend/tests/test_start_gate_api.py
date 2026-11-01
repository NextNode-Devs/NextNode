"""The start gate over REST (#6) with real PostgreSQL, through to #7's signed
webhook: the full client path, the developer path and every refusal."""

from dataclasses import replace
from datetime import date, timedelta

import pytest
from django.db import transaction

from nextnode.domain.projects import Project, ProjectDetails, ProjectKind, Team
from nextnode.infrastructure.container import get_container, override_container
from nextnode.infrastructure.payments.stripe_gateway import StripeGateway
from nextnode.infrastructure.persistence.models import (
    ConversationModel,
    OfferModel,
    PaymentModel,
    ProjectModel,
    TeamModel,
)
from tests.conversation_fakes import make_account
from tests.stripe_helpers import TEST_WEBHOOK_SECRET, checkout_event, sign

pytestmark = pytest.mark.django_db
START = date.today() + timedelta(days=7)
DELIVERY = START + timedelta(days=90)


@pytest.fixture(autouse=True)
def container(verifier):
    gateway = StripeGateway("sk_test_unused", TEST_WEBHOOK_SECRET)
    with override_container(token_verifier=verifier, payment_gateway=gateway):
        yield


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def people(db):
    ids = {
        "client": make_account("user_client", "Grace", "client"),
        "lead": make_account("user_lead", "Ada", "developer"),
        "stranger": make_account("user_stranger", "Edsger", "developer"),
    }
    for n in range(4):
        ids[f"dev{n}"] = make_account(f"user_dev{n}", f"Dev {n}", "developer")
    return ids


def make_project(people, kind: ProjectKind = ProjectKind.CLIENT, members: int = 4) -> int:
    budget = 200_000 if kind is ProjectKind.CLIENT else None
    owner = people["client"] if kind is ProjectKind.CLIENT else people["lead"]
    details = ProjectDetails("Booking app", "A booking app for a yoga studio.", (), date(2027, 6, 1), budget)
    repo = get_container().projects
    record = repo.add(Project.publish(kind, owner, details), Team.for_new_project(people["lead"]))
    team = replace(
        record.team, team_size=5, member_account_ids=tuple(people[f"dev{n}"] for n in range(members))
    )
    repo.save_team(team)
    assert record.project.id is not None
    return record.project.id


@pytest.fixture
def project(people) -> int:
    return make_project(people)


def offer_body(total_cents=1_000_000, **overrides):
    return {
        "summary": "Five sprints: booking, payments and an admin area.",
        "total_cents": total_cents,
        "start_date": START.isoformat(),
        "delivery_date": DELIVERY.isoformat(),
        **overrides,
    }


def close(api, auth, project_id, sub="user_lead"):
    return api.post(f"/api/projects/{project_id}/close-proposal/", **auth(sub))


def send(api, auth, project_id, sub="user_lead", **body):
    return api.post(f"/api/projects/{project_id}/offers/", offer_body(**body), format="json", **auth(sub))


def gate(api, auth, project_id, sub="user_lead"):
    return api.get(f"/api/projects/{project_id}/start/", **auth(sub))


def error(response):
    return response.json()["error"]


# --- the client-funded path, end to end ------------------------------------------------


def test_client_project_from_full_team_to_in_progress_on_a_confirmed_deposit(api, auth, project, people):
    assert close(api, auth, project).json()["data"]["team_status"] == "locked"
    sent = send(api, auth, project)
    assert sent.status_code == 201
    offer = sent.json()["data"]["offers"][0]
    assert (offer["total_cents"], offer["deposit_cents"], offer["status"]) == (1_000_000, 200_000, "sent")
    assert ProjectModel.objects.get(pk=project).status == "OfferSent"

    accepted = api.post(f"/api/offers/{offer['id']}/accept/", **auth("user_client"))
    assert accepted.status_code == 200
    assert ProjectModel.objects.get(pk=project).status == "Assigned"
    row = OfferModel.objects.get(pk=offer["id"])
    assert (row.status, row.decided_by_id, row.decided_at is not None) == ("accepted", people["client"], True)

    # A direct start before Stripe confirms the deposit names what is missing.
    early = api.post(f"/api/projects/{project}/start/", **auth("user_client"))
    assert early.status_code == 409
    assert error(early)["code"] == "START_CONDITION_MISSING"
    assert "Deposit confirmed by Stripe" in error(early)["message"]

    # #7 reads the accepted offer through #6's adapter.
    with transaction.atomic():
        terms = get_container().deposit_terms.get_for_update(project)
    assert (terms.is_assigned, terms.offer_version_id, terms.accepted_total_cents) == (
        True,
        offer["id"],
        1_000_000,
    )
    assert terms.client_user_id == "user_client"

    payment = PaymentModel.objects.create(
        project_id=project,
        offer_version_id=offer["id"],
        type="deposit",
        amount_cents=200_000,
        currency="cad",
        checkout_session_id="cs_test_1",
    )
    payload = checkout_event(str(payment.id), amount=200_000)
    webhook = api.post(
        "/api/payments/stripe/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=sign(payload),
    )
    assert webhook.json()["data"]["result"] == "completed"
    assert ProjectModel.objects.get(pk=project).status == "InProgress"
    assert TeamModel.objects.get(project_id=project).status == "active"

    status = gate(api, auth, project, "user_dev0").json()["data"]
    assert (status["started"], status["next_actor"]) == (True, "nobody")
    workspace = ConversationModel.objects.get(subject_kind="project_workspace", subject_id=str(project))
    assert status["workspace_conversation_id"] == str(workspace.id)
    participants = set(workspace.participants.values_list("account_id", flat=True))
    assert participants == {people["lead"], *(people[f"dev{n}"] for n in range(4))}

    # The client and other users cannot open the workspace.
    for outsider in ("user_client", "user_stranger"):
        assert api.get(f"/api/conversations/{workspace.id}/", **auth(outsider)).status_code == 404
    assert gate(api, auth, project, "user_client").json()["data"]["workspace_conversation_id"] is None


def test_a_webhook_for_an_unaccepted_offer_rolls_the_payment_back(api, auth, project):
    close(api, auth, project)
    offer_id = send(api, auth, project).json()["data"]["offers"][0]["id"]
    payment = PaymentModel.objects.create(
        project_id=project,
        offer_version_id=offer_id,
        type="deposit",
        amount_cents=200_000,
        currency="cad",
        checkout_session_id="cs_test_1",
    )
    payload = checkout_event(str(payment.id), amount=200_000)
    response = api.post(
        "/api/payments/stripe/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=sign(payload),
    )
    assert response.status_code == 409
    payment.refresh_from_db()
    assert payment.status == "pending" and ProjectModel.objects.get(pk=project).status == "OfferSent"


def test_decline_and_revise_over_rest(api, auth, project):
    close(api, auth, project)
    first = send(api, auth, project).json()["data"]["offers"][0]
    declined = api.post(
        f"/api/offers/{first['id']}/decline/", {"reason": "Over budget"}, format="json", **auth("user_client")
    )
    assert declined.status_code == 200
    assert declined.json()["data"]["offers"][0]["decline_reason"] == "Over budget"
    assert TeamModel.objects.get(project_id=project).status == "locked"
    revised = send(api, auth, project, total_cents=600_000).json()["data"]["offers"]
    assert [(o["version"], o["status"]) for o in revised] == [(2, "sent"), (1, "declined")]
    assert OfferModel.objects.get(pk=first["id"]).total_cents == 1_000_000


# --- the developer-created path ----------------------------------------------------


def test_developer_idea_starts_on_its_timeline_with_no_offer_or_payment(api, auth, people):
    idea = make_project(people, ProjectKind.DEVELOPER)
    close(api, auth, idea)
    body = {"start_date": START.isoformat(), "delivery_date": DELIVERY.isoformat()}
    response = api.post(f"/api/projects/{idea}/timeline/", body, format="json", **auth("user_lead"))
    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["started"], data["offers"], data["deposit"]) == (True, None, None)
    assert ProjectModel.objects.get(pk=idea).status == "InProgress"
    assert not OfferModel.objects.filter(project_id=idea).exists()
    assert not PaymentModel.objects.filter(project_id=idea).exists()
    assert ConversationModel.objects.filter(subject_kind="project_workspace", subject_id=str(idea)).exists()


# --- refusals -----------------------------------------------------------------------


def test_close_proposal_refusals(api, auth, people, project):
    assert close(api, auth, project, "user_client").status_code == 403
    assert close(api, auth, project, "user_dev0").status_code == 403
    not_full = make_project(people, members=2)
    response = close(api, auth, not_full)
    assert response.status_code == 409 and "3 of 5 people" in error(response)["message"]
    assert close(api, auth, 99999).status_code == 404


def test_recruitment_is_refused_once_locked(api, auth, project):
    close(api, auth, project)
    response = api.post(f"/api/projects/{project}/team/applications/", **auth("user_stranger"))
    assert response.status_code == 409
    assert error(response)["message"] == "Recruitment has closed"


def test_offer_refusals(api, auth, people, project):
    early = send(api, auth, project)
    assert early.status_code == 409 and "closes the project proposal first" in error(early)["message"]
    close(api, auth, project)
    assert send(api, auth, project, "user_dev0").status_code == 403
    assert send(api, auth, project, "user_client").status_code == 403
    idea = make_project(people, ProjectKind.DEVELOPER)
    close(api, auth, idea)
    assert send(api, auth, idea).status_code == 409


def test_a_total_below_cad_1500_is_refused_on_the_field_even_without_the_ui(api, auth, project):
    close(api, auth, project)
    below = send(api, auth, project, total_cents=149_999)
    assert below.status_code == 400
    assert error(below)["fields"] == {"total_cents": ["Must be at least CAD 1,500.00."]}
    assert send(api, auth, project, total_cents=150_000).status_code == 201


def test_deposit_preview_is_the_servers_twenty_percent(api, auth, project):
    url = f"/api/projects/{project}/offers/deposit-preview/"
    preview = api.get(url, {"total_cents": 1_000_000}, **auth("user_lead"))
    assert preview.json()["data"] == {
        "total_cents": 1_000_000,
        "deposit_cents": 200_000,
        "deposit_percent": 20,
        "currency": "cad",
    }
    assert api.get(url, {"total_cents": 149_999}, **auth("user_lead")).status_code == 400
    assert api.get(url, {"total_cents": 1_000_000}, **auth("user_client")).status_code == 403


def test_decision_refusals(api, auth, project):
    close(api, auth, project)
    offer_id = send(api, auth, project).json()["data"]["offers"][0]["id"]
    assert api.post(f"/api/offers/{offer_id}/accept/", **auth("user_lead")).status_code == 403
    assert api.post(f"/api/offers/{offer_id}/accept/", **auth("user_dev0")).status_code == 403
    assert api.post(f"/api/offers/{offer_id}/accept/", **auth("user_stranger")).status_code == 404
    blank = api.post(
        f"/api/offers/{offer_id}/decline/", {"reason": " "}, format="json", **auth("user_client")
    )
    assert blank.status_code == 400 and "reason" in error(blank)["fields"]
    api.post(f"/api/offers/{offer_id}/accept/", **auth("user_client"))
    again = api.post(f"/api/offers/{offer_id}/accept/", **auth("user_client"))
    assert again.status_code == 409


def test_timeline_refusals(api, auth, people, project):
    body = {"start_date": START.isoformat(), "delivery_date": DELIVERY.isoformat()}
    close(api, auth, project)
    client_project = api.post(f"/api/projects/{project}/timeline/", body, format="json", **auth("user_lead"))
    assert client_project.status_code == 409
    idea = make_project(people, ProjectKind.DEVELOPER)
    assert (
        api.post(f"/api/projects/{idea}/timeline/", body, format="json", **auth("user_lead")).status_code
        == 409
    )
    close(api, auth, idea)
    assert (
        api.post(f"/api/projects/{idea}/timeline/", body, format="json", **auth("user_dev0")).status_code
        == 403
    )


def test_only_the_client_and_team_see_the_gate(api, auth, project):
    for sub, role in (("user_client", "client"), ("user_lead", "lead"), ("user_dev2", "member")):
        response = gate(api, auth, project, sub)
        assert response.status_code == 200 and response.json()["data"]["viewer_role"] == role
    assert gate(api, auth, project, "user_stranger").status_code == 403
    assert api.get(f"/api/projects/{project}/start/").status_code in (401, 403)
