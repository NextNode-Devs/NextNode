"""A1 (#175): the milestone plan on an offer, its deposit % and the client's
deposit-release choice. Domain rules first (no database), then the API with
real PostgreSQL. The Phase 1 offer without milestones is covered by
``test_start_gate_api.py`` and must keep passing."""

from datetime import date, timedelta

import pytest

from nextnode.domain.errors import ValidationError
from nextnode.domain.start_gate import MilestoneDraft, MilestonePlan, MilestoneStatus, Timeline
from nextnode.domain.start_gate.milestones import ensure_release_choice
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.payments.stripe_gateway import StripeGateway
from nextnode.infrastructure.persistence.milestone_models import MilestoneModel
from nextnode.infrastructure.persistence.models import OfferModel
from tests.conversation_fakes import make_account
from tests.stripe_helpers import TEST_WEBHOOK_SECRET
from tests.test_start_gate_api import START, close, error, make_project, send

TIMELINE = Timeline(date(2027, 1, 4), date(2027, 4, 2))


def rows(*amounts: int, start: date = date(2027, 1, 4), step: int = 14) -> list[MilestoneDraft]:
    return [
        MilestoneDraft(f"Milestone {n + 1}", "", amount, start + timedelta(days=step * (n + 1)))
        for n, amount in enumerate(amounts)
    ]


def plan(drafts, total=600_000, percent=20) -> MilestonePlan:
    return MilestonePlan.create(drafts, total_cents=total, timeline=TIMELINE, deposit_percent=percent)


def fields(caught) -> set[str]:
    return set(caught.value.fields)


# --- domain ---------------------------------------------------------------------------


def test_a_valid_plan_numbers_milestones_and_starts_them_pending_deposit():
    made = plan(rows(200_000, 250_000, 150_000))
    assert [m.sequence for m in made.milestones] == [1, 2, 3]
    assert {m.status for m in made.milestones} == {MilestoneStatus.PENDING_DEPOSIT}
    assert made.deposit_cents(600_000) == 120_000


@pytest.mark.parametrize(("percent", "deposit"), [(20, 120_000), (30, 180_000), (40, 240_000)])
def test_the_deposit_follows_the_agreed_percent(percent, deposit):
    assert plan(rows(200_000, 200_000, 200_000), percent=percent).deposit_cents(600_000) == deposit


@pytest.mark.parametrize("percent", [0, 15, 21, 45, 100])
def test_only_20_to_40_in_steps_of_5_are_allowed(percent):
    with pytest.raises(ValidationError) as caught:
        plan(rows(200_000, 200_000, 200_000), percent=percent)
    assert "deposit_percent" in fields(caught)


@pytest.mark.parametrize("count", [0, 2, 11])
def test_an_offer_needs_3_to_10_milestones(count):
    with pytest.raises(ValidationError) as caught:
        plan(rows(*([60_000] * count), step=7), total=60_000 * count)
    assert "milestones" in fields(caught)


def test_ten_milestones_are_allowed():
    assert len(plan(rows(*([60_000] * 10), step=7)).milestones) == 10


def test_amounts_must_add_up_to_the_offer_total_exactly():
    with pytest.raises(ValidationError) as caught:
        plan(rows(200_000, 200_000, 199_999))
    assert caught.value.fields["milestones"] == [
        "The milestones add up to CAD 5,999.99; the offer total is CAD 6,000.00."
    ]


def test_every_row_needs_a_title_and_an_amount_above_zero():
    drafts = rows(300_000, 300_000, 0)
    drafts[0] = MilestoneDraft("   ", "", 300_000, drafts[0].due_date)
    with pytest.raises(ValidationError) as caught:
        plan(drafts)
    assert fields(caught) == {"milestones.0.title", "milestones.2.amount_cents"}


def test_due_dates_run_in_order_inside_the_timeline():
    first, second, third = rows(200_000, 200_000, 200_000)
    on_start = MilestoneDraft("Kick-off", "", 200_000, TIMELINE.start_date)
    late = MilestoneDraft("Late", "", 200_000, TIMELINE.delivery_date + timedelta(days=1))
    with pytest.raises(ValidationError) as caught:
        plan([on_start, second, third])
    assert fields(caught) == {"milestones.0.due_date"}
    with pytest.raises(ValidationError) as caught:
        plan([second, first, third])
    assert fields(caught) == {"milestones.1.due_date"}
    with pytest.raises(ValidationError) as caught:
        plan([first, second, late])
    assert fields(caught) == {"milestones.2.due_date"}


def test_titles_are_tidied():
    drafts = rows(200_000, 200_000, 200_000)
    drafts[0] = MilestoneDraft("  Designs   and setup ", "  Screens. ", 200_000, drafts[0].due_date)
    first = plan(drafts).milestones[0]
    assert (first.title, first.description) == ("Designs and setup", "Screens.")


def test_the_release_choice_is_1_or_2_and_only_with_a_plan():
    made = plan(rows(200_000, 200_000, 200_000))
    assert ensure_release_choice(made, 1) == 1
    assert ensure_release_choice(made, 2) == 2
    for bad in (None, 0, 3):
        with pytest.raises(ValidationError):
            ensure_release_choice(made, bad)
    assert ensure_release_choice(None, None) is None
    with pytest.raises(ValidationError):
        ensure_release_choice(None, 1)


# --- the API ------------------------------------------------------------------------------


@pytest.fixture
def auth(make_token, verifier):
    gateway = StripeGateway("sk_test_unused", TEST_WEBHOOK_SECRET)
    with override_container(token_verifier=verifier, payment_gateway=gateway):
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


@pytest.fixture
def project(people) -> int:
    return make_project(people)


def milestone_rows(*amounts: int) -> list[dict]:
    return [
        {
            "title": f"Milestone {n + 1}",
            "description": "Work for this stage.",
            "amount_cents": amount,
            "due_date": (START + timedelta(days=20 * (n + 1))).isoformat(),
        }
        for n, amount in enumerate(amounts)
    ]


def send_plan(api, auth, project_id, amounts=(300_000, 400_000, 300_000), **extra):
    return send(api, auth, project_id, milestones=milestone_rows(*amounts), **extra)


def accept(api, auth, offer_id, choice=None, sub="user_client"):
    body = {} if choice is None else {"deposit_release_milestone": choice}
    return api.post(f"/api/offers/{offer_id}/accept/", body, format="json", **auth(sub))


def plan_of(api, auth, project_id, sub="user_client"):
    return api.get(f"/api/projects/{project_id}/milestones/", **auth(sub))


@pytest.mark.django_db
def test_the_lead_sends_a_plan_the_client_accepts_it_choosing_milestone_2(api, auth, project):
    close(api, auth, project)
    sent = send_plan(api, auth, project, deposit_percent=30)
    assert sent.status_code == 201, sent.json()
    offer = sent.json()["data"]["offers"][0]
    shown = offer["milestone_plan"]
    assert (shown["deposit_percent"], shown["deposit_cents"], shown["deposit_release_milestone"]) == (
        30,
        300_000,
        None,
    )
    assert [m["sequence"] for m in shown["milestones"]] == [1, 2, 3]
    assert {m["status"] for m in shown["milestones"]} == {"pending_deposit"}
    # The live deposit (what checkout charges) is unchanged until A11.
    assert offer["deposit_cents"] == 200_000

    # Everyone on the project reads the waiting plan; the client then accepts all of it.
    for sub in ("user_client", "user_lead", "user_dev0"):
        assert plan_of(api, auth, project, sub).json()["data"]["offer_status"] == "sent"
    accepted = accept(api, auth, offer["id"], 2)
    assert accepted.status_code == 200, accepted.json()
    assert OfferModel.objects.get(pk=offer["id"]).deposit_release_milestone == 2
    data = plan_of(api, auth, project).json()["data"]
    assert (data["offer_status"], data["deposit_release_milestone"], data["offer_version"]) == (
        "accepted",
        2,
        1,
    )
    assert MilestoneModel.objects.filter(offer_id=offer["id"]).count() == 3


@pytest.mark.django_db
def test_the_deposit_percent_defaults_to_20(api, auth, project):
    close(api, auth, project)
    offer = send_plan(api, auth, project).json()["data"]["offers"][0]
    assert offer["milestone_plan"]["deposit_percent"] == 20


@pytest.mark.django_db
def test_the_client_must_choose_milestone_1_or_2_on_a_plan(api, auth, project):
    close(api, auth, project)
    offer_id = send_plan(api, auth, project).json()["data"]["offers"][0]["id"]
    for choice in (None, 3):
        refused = accept(api, auth, offer_id, choice)
        assert refused.status_code == 400
        assert "deposit_release_milestone" in error(refused)["fields"]
    assert OfferModel.objects.get(pk=offer_id).status == "sent"


@pytest.mark.django_db
def test_an_offer_without_milestones_works_as_in_phase_1(api, auth, project):
    close(api, auth, project)
    offer = send(api, auth, project).json()["data"]["offers"][0]
    assert offer["milestone_plan"] is None
    assert plan_of(api, auth, project).json()["data"] is None
    refused = accept(api, auth, offer["id"], 1)
    assert refused.status_code == 400
    assert accept(api, auth, offer["id"]).status_code == 200


@pytest.mark.django_db
def test_plan_refusals_name_their_fields_and_store_nothing(api, auth, project):
    close(api, auth, project)
    short = send_plan(api, auth, project, amounts=(500_000, 500_000))
    assert short.status_code == 400 and "milestones" in error(short)["fields"]
    wrong_total = send_plan(api, auth, project, amounts=(300_000, 300_000, 300_000))
    assert wrong_total.status_code == 400
    assert "CAD 9,000.00" in error(wrong_total)["fields"]["milestones"][0]
    alone = send(api, auth, project, deposit_percent=30)
    assert alone.status_code == 400 and "milestones" in error(alone)["fields"]
    bad_percent = send_plan(api, auth, project, deposit_percent=50)
    assert bad_percent.status_code == 400 and "deposit_percent" in error(bad_percent)["fields"]
    assert OfferModel.objects.filter(project_id=project).count() == 0


@pytest.mark.django_db
def test_a_revision_carries_a_new_plan_and_the_old_one_stays_readable(api, auth, project):
    close(api, auth, project)
    first = send_plan(api, auth, project).json()["data"]["offers"][0]
    api.post(
        f"/api/offers/{first['id']}/decline/", {"reason": "Too fast."}, format="json", **auth("user_client")
    )
    assert plan_of(api, auth, project).json()["data"] is None  # nothing waiting or accepted
    revised = send_plan(api, auth, project, amounts=(250_000, 250_000, 250_000, 250_000)).json()["data"]
    newest, older = revised["offers"]
    assert len(newest["milestone_plan"]["milestones"]) == 4
    assert len(older["milestone_plan"]["milestones"]) == 3
    assert plan_of(api, auth, project).json()["data"]["offer_version"] == 2


@pytest.mark.django_db
def test_only_the_client_and_team_read_the_plan(api, auth, project, people):
    close(api, auth, project)
    send_plan(api, auth, project)
    assert plan_of(api, auth, project, "user_stranger").status_code == 403
    assert api.get(f"/api/projects/{project}/milestones/").status_code == 401
    assert plan_of(api, auth, 999_999).status_code == 404


@pytest.mark.django_db
def test_a_developer_idea_has_no_plan(api, auth, people):
    from nextnode.domain.projects import ProjectKind

    idea = make_project(people, ProjectKind.DEVELOPER)
    assert plan_of(api, auth, idea, "user_lead").json()["data"] is None
