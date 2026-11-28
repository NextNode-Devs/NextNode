"""A2 (#176): milestone delivery and client review. The loop's rules without a
database, then the whole path over REST with real PostgreSQL: deposit
confirmed by Stripe -> milestone 1 in progress -> submit -> revision ->
resubmit -> approve -> the next milestone starts."""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from nextnode.application.ports import Notification
from nextnode.domain.errors import InvalidStateTransitionError, ValidationError
from nextnode.domain.milestones import ReviewKind, approve, begin_work, request_revision, start_next, submit
from nextnode.domain.start_gate import MilestoneStatus, PlannedMilestone
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.payments.stripe_gateway import StripeGateway
from nextnode.infrastructure.persistence.milestone_models import MilestoneModel, MilestoneReviewModel
from nextnode.infrastructure.persistence.models import PaymentModel
from tests.conversation_fakes import make_account
from tests.stripe_helpers import TEST_WEBHOOK_SECRET, checkout_event, sign
from tests.test_start_gate_api import START, close, error, make_project, send

AT = datetime(2026, 12, 1, 15, 0, tzinfo=UTC)
S = MilestoneStatus


def milestone(sequence=1, status=S.IN_PROGRESS) -> PlannedMilestone:
    return PlannedMilestone(
        sequence, f"M{sequence}", "", 100_000, date(2027, 1, sequence), status, id=sequence
    )


# --- the loop (no database) ------------------------------------------------------------------


def test_the_deposit_starts_milestone_1_and_leaves_the_rest_not_started():
    plan = [milestone(n, S.PENDING_DEPOSIT) for n in (1, 2, 3)]
    assert [m.status for m in begin_work(plan)] == [S.IN_PROGRESS, S.NOT_STARTED, S.NOT_STARTED]
    begun = begin_work(plan)
    assert begin_work(begun) == begun  # only once


def test_submit_review_and_approve_with_one_event_each():
    sent, event = submit(milestone(), 7, "  The designs are ready. ", "https://staging.example.com", AT)
    assert (sent.status, sent.submitted_at, event.kind, event.note) == (
        S.UNDER_REVIEW,
        AT,
        ReviewKind.SUBMITTED,
        "The designs are ready.",
    )
    back, event = request_revision(sent, 3, "Use our brand colours.", AT)
    assert (back.status, event.kind, event.author_role.value) == (
        S.IN_PROGRESS,
        ReviewKind.REVISION_REQUESTED,
        "client",
    )
    again, _ = submit(back, 7, "Colours updated.", None, AT)
    done, event = approve(again, 3, "", AT)
    assert (done.status, done.approved_at, event.kind, event.note) == (
        S.COMPLETED,
        AT,
        ReviewKind.APPROVED,
        "",
    )


@pytest.mark.parametrize("status", [S.PENDING_DEPOSIT, S.NOT_STARTED, S.UNDER_REVIEW, S.COMPLETED])
def test_only_a_milestone_in_progress_can_be_submitted(status):
    with pytest.raises(InvalidStateTransitionError):
        submit(milestone(status=status), 7, "Ready.", None, AT)


@pytest.mark.parametrize("step", [approve, request_revision])
def test_only_a_milestone_under_review_can_be_decided(step):
    with pytest.raises(InvalidStateTransitionError):
        step(milestone(status=S.IN_PROGRESS), 3, "Change this.", AT)


def test_the_lead_and_the_client_must_say_something_where_it_matters():
    with pytest.raises(ValidationError) as caught:
        submit(milestone(), 7, "   ", None, AT)
    assert list(caught.value.fields) == ["note"]
    with pytest.raises(ValidationError):
        request_revision(milestone(status=S.UNDER_REVIEW), 3, "", AT)
    with pytest.raises(ValidationError):
        submit(milestone(), 7, "x" * 2001, None, AT)


@pytest.mark.parametrize(
    "link", ["http://staging.example.com", "staging.example.com", "javascript:alert(1)", "https://"]
)
def test_links_must_be_full_https_links(link):
    with pytest.raises(ValidationError) as caught:
        submit(milestone(), 7, "Ready.", link, AT)
    assert list(caught.value.fields) == ["link_url"]


def test_approving_starts_the_next_milestone_not_started():
    plan = [milestone(1, S.COMPLETED), milestone(2, S.NOT_STARTED), milestone(3, S.NOT_STARTED)]
    assert [m.status for m in start_next(plan)] == [S.COMPLETED, S.IN_PROGRESS, S.NOT_STARTED]
    busy = [milestone(1, S.COMPLETED), milestone(2, S.UNDER_REVIEW), milestone(3, S.NOT_STARTED)]
    assert start_next(busy) == busy
    finished = [replace(m, status=S.COMPLETED) for m in plan]
    assert start_next(finished) == finished


# --- end to end ------------------------------------------------------------------------------


class Recorder:
    def __init__(self) -> None:
        self.sent: list[Notification] = []

    def send(self, notification: Notification) -> None:
        self.sent.append(notification)


@pytest.fixture
def notes() -> Recorder:
    return Recorder()


@pytest.fixture
def auth(make_token, verifier, notes):
    gateway = StripeGateway("sk_test_unused", TEST_WEBHOOK_SECRET)
    with override_container(token_verifier=verifier, payment_gateway=gateway, notifications=notes):
        yield lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


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


def rows(*amounts: int) -> list[dict]:
    return [
        {
            "title": f"Milestone {n + 1}",
            "amount_cents": a,
            "due_date": (START + timedelta(days=20 * (n + 1))).isoformat(),
        }
        for n, a in enumerate(amounts)
    ]


@pytest.fixture
def started(api, auth, people) -> int:
    """A client project with a 3-milestone plan, its deposit confirmed by Stripe."""
    project = make_project(people)
    close(api, auth, project)
    offer = send(api, auth, project, milestones=rows(300_000, 400_000, 300_000)).json()["data"]["offers"][0]
    api.post(
        f"/api/offers/{offer['id']}/accept/",
        {"deposit_release_milestone": 1},
        format="json",
        **auth("user_client"),
    )
    payment = PaymentModel.objects.create(
        project_id=project,
        offer_version_id=offer["id"],
        type="deposit",
        amount_cents=200_000,
        currency="cad",
        checkout_session_id="cs_test_1",
    )
    payload = checkout_event(str(payment.id), amount=200_000)
    hook = api.post(
        "/api/payments/stripe/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=sign(payload),
    )
    assert hook.json()["data"]["result"] == "completed"
    return project


def board(api, auth, project, sub="user_client"):
    return api.get(f"/api/projects/{project}/milestones/reviews/", **auth(sub))


def act(api, auth, milestone_id, action, sub, **body):
    return api.post(f"/api/milestones/{milestone_id}/{action}/", body, format="json", **auth(sub))


def statuses(response) -> list[str]:
    assert response.status_code == 200, response.json()
    return [m["status"] for m in response.json()["data"]["milestones"]]


@pytest.mark.django_db
def test_the_whole_loop_from_deposit_to_the_next_milestone(api, auth, started, notes):
    first = board(api, auth, started).json()["data"]
    assert [m["status"] for m in first["milestones"]] == ["in_progress", "not_started", "not_started"]
    m1 = first["milestones"][0]["id"]
    assert board(api, auth, started, "user_lead").json()["data"]["actions"][str(m1)] == ["submit"]

    sent = act(
        api, auth, m1, "submit", "user_lead", note="Designs ready.", link_url="https://staging.example.com"
    )
    assert statuses(sent) == ["under_review", "not_started", "not_started"]
    assert sent.json()["data"]["actions"][str(m1)] == []  # the Lead waits now
    assert board(api, auth, started).json()["data"]["actions"][str(m1)] == ["approve", "request_revision"]

    back = act(api, auth, m1, "request-revision", "user_client", note="Phone layout, please.")
    assert statuses(back) == ["in_progress", "not_started", "not_started"]
    act(api, auth, m1, "submit", "user_lead", note="Phone layout added.")
    done = act(api, auth, m1, "approve", "user_client")
    assert statuses(done) == ["completed", "in_progress", "not_started"]

    history = done.json()["data"]["reviews"]
    assert [(r["kind"], r["author_name"], r["author_role"]) for r in history] == [
        ("submitted", "Ada", "lead"),
        ("revision_requested", "Grace", "client"),
        ("submitted", "Ada", "lead"),
        ("approved", "Grace", "client"),
    ]
    assert history[0]["link_url"] == "https://staging.example.com"
    row = MilestoneModel.objects.get(pk=m1)
    assert row.submitted_at is not None and row.approved_at is not None

    # The other side hears about each step.
    assert [n.kind for n in notes.sent] == [
        "milestone_submitted",
        "milestone_revision_requested",
        "milestone_submitted",
        "milestone_approved",
    ]
    assert notes.sent[0].link == f"/projects/{started}/milestones"

    # The plan read by Aliya's screen shows the same, with the times.
    plan = api.get(f"/api/projects/{started}/milestones/", **auth("user_dev0")).json()["data"]
    assert plan["milestones"][0]["approved_at"] is not None


@pytest.mark.django_db
def test_wrong_people_and_wrong_steps_are_refused_and_nothing_is_written(api, auth, started):
    m1 = board(api, auth, started).json()["data"]["milestones"][0]["id"]
    assert act(api, auth, m1, "submit", "user_client", note="Done.").status_code == 403
    assert act(api, auth, m1, "submit", "user_dev0", note="Done.").status_code == 403
    assert act(api, auth, m1, "approve", "user_client").status_code == 409  # not under review yet
    assert act(api, auth, m1, "submit", "user_stranger", note="Done.").status_code == 404
    assert act(api, auth, 999_999, "submit", "user_lead", note="Done.").status_code == 404
    refused = act(api, auth, m1, "submit", "user_lead", note="", link_url="http://insecure.example.com")
    assert refused.status_code == 400 and "note" in error(refused)["fields"]
    assert board(api, auth, started, "user_stranger").status_code == 404
    assert api.get(f"/api/projects/{started}/milestones/reviews/").status_code == 401
    assert MilestoneReviewModel.objects.count() == 0


@pytest.mark.django_db
def test_nothing_can_be_submitted_before_the_deposit(api, auth, people):
    project = make_project(people)
    close(api, auth, project)
    offer = send(api, auth, project, milestones=rows(300_000, 400_000, 300_000)).json()["data"]["offers"][0]
    m1 = offer["milestone_plan"]["milestones"][0]["id"]
    # Not accepted yet: the milestone isn't on an accepted plan.
    assert act(api, auth, m1, "submit", "user_lead", note="Ready.").status_code == 409
    api.post(
        f"/api/offers/{offer['id']}/accept/",
        {"deposit_release_milestone": 2},
        format="json",
        **auth("user_client"),
    )
    refused = act(api, auth, m1, "submit", "user_lead", note="Ready.")
    assert refused.status_code == 409
    assert statuses(board(api, auth, project)) == ["pending_deposit"] * 3
