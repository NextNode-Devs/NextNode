"""The start gate's rules (#6), with no database: team transitions, offer
versions and decisions, the minimum total and the gate's order."""

from dataclasses import replace
from datetime import UTC, date, datetime

import pytest

from nextnode.domain.errors import ForbiddenError, InvalidStateTransitionError, ValidationError
from nextnode.domain.projects import Project, ProjectDetails, ProjectKind, ProjectStatus, Team, TeamStatus
from nextnode.domain.projects.team import TeamNotRecruitingError
from nextnode.domain.start_gate import (
    NextActor,
    Offer,
    OfferOpenError,
    OfferStatus,
    OfferTerms,
    StartConditionMissingError,
    Timeline,
    evaluate_client,
    evaluate_developer,
)

AT = datetime(2026, 11, 1, 12, tzinfo=UTC)
TODAY = date(2026, 11, 1)
LEAD, CLIENT = 2, 1


def terms(total_cents: int = 1_000_000, **overrides) -> OfferTerms:
    values = {
        "summary": "Five sprints: booking, payments, admin.",
        "total_cents": total_cents,
        "start_date": date(2026, 11, 9),
        "delivery_date": date(2027, 2, 1),
        "today": TODAY,
    }
    return OfferTerms.create(**(values | overrides))


def full_team(status: TeamStatus = TeamStatus.OPEN) -> Team:
    return Team(1, 1, status, LEAD, 5, (10, 11, 12, 13))


def client_project(status: ProjectStatus = ProjectStatus.POSTED) -> Project:
    details = ProjectDetails("Booking app", "A booking app.", (), date(2027, 1, 1), 200_000)
    return replace(Project.publish(ProjectKind.CLIENT, CLIENT, details), id=1, status=status)


# --- team: Open -> Locked -> Active -----------------------------------------------


def test_the_lead_closes_a_full_teams_proposal_and_it_locks():
    assert full_team().close_proposal(LEAD).status is TeamStatus.LOCKED


def test_a_team_that_is_not_full_cannot_close():
    team = replace(full_team(), member_account_ids=(10, 11))
    with pytest.raises(TeamNotRecruitingError, match="3 of 5 people"):
        team.close_proposal(LEAD)


def test_a_team_without_a_size_cannot_close():
    with pytest.raises(TeamNotRecruitingError, match="size has not been set"):
        replace(full_team(), team_size=None).close_proposal(LEAD)


@pytest.mark.parametrize("who", [10, CLIENT, None])
def test_only_the_lead_closes_the_proposal(who):
    with pytest.raises(ForbiddenError, match="Team Lead"):
        full_team().close_proposal(who)


def test_a_locked_team_refuses_new_members_with_a_reason():
    locked = full_team().close_proposal(LEAD)
    with pytest.raises(TeamNotRecruitingError, match="Recruitment has closed"):
        locked.ensure_can_join(99)


def test_closing_twice_is_refused():
    with pytest.raises(InvalidStateTransitionError, match="already closed"):
        full_team(TeamStatus.LOCKED).close_proposal(LEAD)


def test_only_a_locked_team_becomes_active():
    assert full_team(TeamStatus.LOCKED).activate().status is TeamStatus.ACTIVE
    with pytest.raises(InvalidStateTransitionError, match="closes the project proposal first"):
        full_team().activate()
    with pytest.raises(InvalidStateTransitionError, match="already started"):
        full_team(TeamStatus.ACTIVE).activate()


def test_the_workspace_people_are_the_lead_and_members_never_the_client():
    assert full_team().participant_ids == (LEAD, 10, 11, 12, 13)


# --- offer terms ------------------------------------------------------------------


def test_an_offer_of_1499_99_is_refused_on_the_total_field():
    with pytest.raises(ValidationError) as refused:
        terms(149_999)
    assert "at least CAD 1,500.00" in refused.value.message
    assert refused.value.fields == {"total_cents": ["Must be at least CAD 1,500.00."]}


def test_an_offer_of_exactly_1500_00_is_accepted():
    assert terms(150_000).total_cents == 150_000


def test_offer_fields_are_checked_together():
    with pytest.raises(ValidationError) as refused:
        terms(summary="short", start_date=date(2026, 10, 1), delivery_date=date(2026, 9, 1))
    assert set(refused.value.fields) == {"summary", "start_date", "delivery_date"}


def test_a_timeline_must_end_after_it_starts():
    with pytest.raises(ValidationError, match="Some fields"):
        Timeline.create(date(2026, 12, 1), date(2026, 12, 1), TODAY)


# --- versions and decisions ---------------------------------------------------------


def sign(previous: list[Offer], **overrides) -> Offer:
    offer = Offer.sign(1, previous, terms(**overrides), LEAD, AT)
    return replace(offer, id=len(previous) + 1)


def test_versions_count_up_and_only_one_is_open():
    first = sign([])
    assert (first.version, first.status, first.signed_by_account_id, first.signed_at) == (1, "sent", LEAD, AT)
    with pytest.raises(OfferOpenError, match="Version 1"):
        sign([first])


def test_decline_and_revise_keeps_the_earlier_version_unchanged():
    first = sign([])
    declined = first.decline(CLIENT, CLIENT, "  Too  high for v1 ", AT)
    assert (declined.status, declined.decline_reason, declined.decided_by_account_id) == (
        OfferStatus.DECLINED,
        "Too high for v1",
        CLIENT,
    )
    second = sign([declined], total_cents=800_000)
    assert second.version == 2 and second.is_open
    assert first.terms.total_cents == 1_000_000  # immutable: a new version, never an edit


def test_accepting_records_the_client_and_time():
    accepted = sign([]).accept(CLIENT, CLIENT, AT)
    assert (accepted.status, accepted.decided_by_account_id, accepted.decided_at) == (
        OfferStatus.ACCEPTED,
        CLIENT,
        AT,
    )


def test_a_decision_is_never_changed():
    accepted = sign([]).accept(CLIENT, CLIENT, AT)
    with pytest.raises(InvalidStateTransitionError, match="already accepted"):
        accepted.decline(CLIENT, CLIENT, "Changed my mind", AT)
    with pytest.raises(InvalidStateTransitionError, match="already accepted an offer"):
        sign([accepted])


@pytest.mark.parametrize("who", [LEAD, 10, 99])
def test_only_the_projects_client_decides(who):
    with pytest.raises(ForbiddenError, match="Only the project's client"):
        sign([]).accept(who, CLIENT, AT)


def test_a_decline_needs_a_reason():
    with pytest.raises(ValidationError) as refused:
        sign([]).decline(CLIENT, CLIENT, "   ", AT)
    assert "reason" in refused.value.fields


def test_a_developer_idea_never_gets_an_offer():
    details = ProjectDetails("Idea app", "A developer idea.", (), date(2027, 1, 1))
    idea = replace(Project.publish(ProjectKind.DEVELOPER, LEAD, details), id=2)
    with pytest.raises(InvalidStateTransitionError, match="no offer"):
        idea.send_offer()


def test_a_revision_keeps_the_project_offer_sent_and_needs_an_earlier_offer():
    assert client_project(ProjectStatus.OFFER_SENT).revise_offer().status is ProjectStatus.OFFER_SENT
    with pytest.raises(InvalidStateTransitionError):
        client_project(ProjectStatus.ASSIGNED).revise_offer()


# --- the gate's order ------------------------------------------------------------


def test_client_gate_walks_through_each_condition_in_order():
    project = client_project()
    open_team = evaluate_client(project, full_team(), None, "none")
    assert (open_team.next_actor, [c.met for c in open_team.conditions]) == (NextActor.LEAD, [False] * 3)
    assert "closes the project proposal" in open_team.next_step

    locked = full_team(TeamStatus.LOCKED)
    assert evaluate_client(project, locked, None, "none").next_step.endswith(
        "sends the client a signed offer."
    )

    sent = sign([])
    in_review = evaluate_client(client_project(ProjectStatus.OFFER_SENT), locked, sent, "none")
    assert in_review.next_actor is NextActor.CLIENT and "version 1" in in_review.next_step

    declined = sent.decline(CLIENT, CLIENT, "Too high", AT)
    revise = evaluate_client(client_project(ProjectStatus.OFFER_SENT), locked, declined, "none")
    assert revise.next_actor is NextActor.LEAD and "revised offer" in revise.next_step

    assigned = client_project(ProjectStatus.ASSIGNED)
    to_pay = evaluate_client(assigned, locked, sent.accept(CLIENT, CLIENT, AT), "none")
    assert (to_pay.next_actor, [c.met for c in to_pay.conditions]) == (NextActor.CLIENT, [True, True, False])
    assert evaluate_client(assigned, locked, None, "pending").next_actor is NextActor.STRIPE
    assert evaluate_client(assigned, locked, None, "completed").missing is None


def test_without_a_confirmed_deposit_the_gate_refuses_naming_it():
    gate = evaluate_client(
        client_project(ProjectStatus.ASSIGNED), full_team(TeamStatus.LOCKED), None, "pending"
    )
    with pytest.raises(StartConditionMissingError, match="Missing: Deposit confirmed by Stripe"):
        gate.ensure_met()


def test_developer_gate_needs_a_locked_team_and_a_timeline():
    details = ProjectDetails("Idea app", "A developer idea.", (), date(2027, 1, 1))
    idea = replace(Project.publish(ProjectKind.DEVELOPER, LEAD, details), id=2)
    assert evaluate_developer(idea, full_team(), False).missing.key == "team_locked"
    assert evaluate_developer(idea, full_team(TeamStatus.LOCKED), False).missing.key == "timeline_finalised"
    evaluate_developer(idea, full_team(TeamStatus.LOCKED), True).ensure_met()
