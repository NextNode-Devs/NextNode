"""Start-gate use cases (#6) with in-memory fakes: no database, no Stripe."""

from datetime import date

import pytest

from nextnode.domain.errors import (
    ConflictError,
    ForbiddenError,
    InvalidStateTransitionError,
    NotFoundError,
    ValidationError,
)
from nextnode.domain.projects import ProjectKind, ProjectStatus, TeamStatus
from nextnode.domain.start_gate import OfferOpenError, StartConditionMissingError
from nextnode.domain.teams import TeamNotRecruitingError
from tests.start_gate_fakes import GateWorld, offer
from tests.team_fakes import CLIENT, CLIENT_ID, DEV_IDS, LEAD, LEAD_ID, STRANGER, dev


@pytest.fixture
def w() -> GateWorld:
    return GateWorld()


def to_assigned(w: GateWorld, total: int = 1_000_000) -> int:
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    sent = w.uc.send_offer.execute(LEAD, project, offer(total))
    w.uc.accept_offer.execute(CLIENT, sent.offers[0].id)
    return project


# --- close proposal ----------------------------------------------------------------


def test_closing_a_full_teams_proposal_locks_it_and_stops_recruitment(w):
    project = w.project()
    view = w.uc.close_proposal.execute(LEAD, project)
    assert (view.team_status, view.next_actor, view.actions) == ("locked", "lead", ["send_offer"])
    assert w.record(project).team.status is TeamStatus.LOCKED
    assert w.recruitment.closed == [project]


def test_a_team_with_open_spots_cannot_close(w):
    project = w.project(members=2)
    with pytest.raises(TeamNotRecruitingError, match="3 of 5"):
        w.uc.close_proposal.execute(LEAD, project)
    assert w.record(project).team.status is TeamStatus.OPEN


@pytest.mark.parametrize("who", [CLIENT, dev(0), STRANGER])
def test_only_the_lead_closes_the_proposal(w, who):
    with pytest.raises(ForbiddenError):
        w.uc.close_proposal.execute(who, w.project())


def test_closing_a_missing_project_is_not_found(w):
    with pytest.raises(NotFoundError):
        w.uc.close_proposal.execute(LEAD, 99)


# --- offers ----------------------------------------------------------------------


def test_the_lead_sends_a_signed_offer_and_the_project_becomes_offer_sent(w):
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    view = w.uc.send_offer.execute(LEAD, project, offer())
    sent = view.offers[0]
    assert w.record(project).project.status is ProjectStatus.OFFER_SENT
    assert (sent.version, sent.status, sent.total_cents, sent.currency) == (1, "sent", 1_000_000, "cad")
    assert (sent.signed_by.account_id, sent.signed_by.display_name, sent.signed_at) == (
        LEAD_ID,
        "Ada",
        "2026-10-31T12:00:00+00:00",
    )
    assert view.proposed_budget_cents == 200_000  # shown next to the offer total


def test_an_offer_of_10000_shows_a_server_computed_deposit_of_2000(w):
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    assert w.uc.send_offer.execute(LEAD, project, offer(1_000_000)).offers[0].deposit_cents == 200_000
    preview = w.uc.preview_deposit.execute(LEAD, project, 1_000_000)
    assert (preview.deposit_cents, preview.deposit_percent, preview.currency) == (200_000, 20, "cad")


@pytest.mark.parametrize(("total", "ok"), [(149_999, False), (150_000, True)])
def test_the_minimum_offer_total_is_cad_1500(w, total, ok):
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    if ok:
        assert w.uc.send_offer.execute(LEAD, project, offer(total)).offers[0].total_cents == total
        return
    with pytest.raises(ValidationError) as refused:
        w.uc.send_offer.execute(LEAD, project, offer(total))
    assert "total_cents" in refused.value.fields
    assert w.offers.rows == {}


def test_no_offer_before_the_proposal_is_closed(w):
    with pytest.raises(InvalidStateTransitionError, match="closes the project proposal first"):
        w.uc.send_offer.execute(LEAD, w.project(), offer())


@pytest.mark.parametrize("who", [CLIENT, dev(0), STRANGER])
def test_only_the_lead_sends_an_offer(w, who):
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    with pytest.raises(ForbiddenError):
        w.uc.send_offer.execute(who, project, offer())


def test_a_developer_idea_never_gets_an_offer(w):
    project = w.project(ProjectKind.DEVELOPER)
    w.uc.close_proposal.execute(LEAD, project)
    with pytest.raises(InvalidStateTransitionError, match="no offer"):
        w.uc.send_offer.execute(LEAD, project, offer())


def test_only_one_version_is_open_at_a_time(w):
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    w.uc.send_offer.execute(LEAD, project, offer())
    with pytest.raises(OfferOpenError):
        w.uc.send_offer.execute(LEAD, project, offer(900_000))


# --- accept and decline ------------------------------------------------------------


def test_accepting_records_the_version_user_and_time_and_assigns_the_project(w):
    project = to_assigned(w)
    view = w.uc.get.execute(CLIENT, project)
    accepted = view.offers[0]
    assert w.record(project).project.status is ProjectStatus.ASSIGNED
    assert (accepted.version, accepted.status, accepted.decided_by.account_id, accepted.decided_at) == (
        1,
        "accepted",
        CLIENT_ID,
        "2026-10-31T12:00:00+00:00",
    )
    assert (view.next_actor, view.actions) == ("client", ["pay_deposit"])


def test_decline_and_revise_keeps_the_team_locked_and_earlier_versions_readable(w):
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    first = w.uc.send_offer.execute(LEAD, project, offer(1_000_000)).offers[0]
    declined = w.uc.decline_offer.execute(CLIENT, first.id, "Above our budget of 2,000.")
    assert (declined.next_actor, declined.offers[0].decline_reason) == ("lead", "Above our budget of 2,000.")
    assert w.record(project).team.status is TeamStatus.LOCKED
    assert w.uc.get.execute(LEAD, project).actions == ["send_offer"]

    revised = w.uc.send_offer.execute(LEAD, project, offer(500_000))
    assert [(o.version, o.status, o.total_cents) for o in revised.offers] == [
        (2, "sent", 500_000),
        (1, "declined", 1_000_000),
    ]
    assert w.record(project).project.status is ProjectStatus.OFFER_SENT


@pytest.mark.parametrize("who", [LEAD, dev(0)])
def test_the_team_cannot_accept_or_decline(w, who):
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    sent = w.uc.send_offer.execute(LEAD, project, offer()).offers[0]
    with pytest.raises(ForbiddenError, match="Only the project's client"):
        w.uc.accept_offer.execute(who, sent.id)
    with pytest.raises(ForbiddenError, match="Only the project's client"):
        w.uc.decline_offer.execute(who, sent.id, "No")


def test_a_stranger_cannot_find_the_offer(w):
    project = w.project()
    w.uc.close_proposal.execute(LEAD, project)
    sent = w.uc.send_offer.execute(LEAD, project, offer()).offers[0]
    with pytest.raises(NotFoundError):
        w.uc.accept_offer.execute(STRANGER, sent.id)
    with pytest.raises(NotFoundError):
        w.uc.accept_offer.execute(CLIENT, 999)


def test_a_decided_version_cannot_be_decided_again(w):
    project = to_assigned(w)
    offer_id = w.uc.get.execute(CLIENT, project).offers[0].id
    with pytest.raises(InvalidStateTransitionError, match="already accepted"):
        w.uc.decline_offer.execute(CLIENT, offer_id, "Too late")


# --- start ---------------------------------------------------------------------------


def test_a_client_project_does_not_start_without_a_confirmed_deposit(w):
    project = to_assigned(w)
    accepted_id = w.offers.for_project(project)[0].id
    w.deposits.status[project] = "pending"
    with pytest.raises(StartConditionMissingError, match="Deposit confirmed by Stripe"):
        w.uc.start_client_project.start_client_project(project, accepted_id)
    with pytest.raises(StartConditionMissingError, match="Deposit confirmed by Stripe"):
        w.uc.start.execute(CLIENT, project)
    assert w.record(project).project.status is ProjectStatus.ASSIGNED
    assert w.workspace.opened == {}


def test_a_confirmed_deposit_starts_the_project_with_a_team_only_workspace(w):
    project = to_assigned(w)
    w.deposits.status[project] = "completed"
    w.uc.start_client_project.start_client_project(project, w.offers.for_project(project)[0].id)
    record = w.record(project)
    assert (record.project.status, record.team.status) == (ProjectStatus.IN_PROGRESS, TeamStatus.ACTIVE)
    assert w.workspace.opened[project] == [LEAD_ID, *DEV_IDS[:4]]
    assert CLIENT_ID not in w.workspace.opened[project]
    member_view = w.uc.get.execute(dev(0), project)
    assert (member_view.started, member_view.workspace_conversation_id) == (True, f"workspace-{project}")
    assert w.uc.get.execute(CLIENT, project).workspace_conversation_id is None


def test_a_deposit_for_another_offer_version_does_not_start(w):
    project = to_assigned(w)
    w.deposits.status[project] = "completed"
    with pytest.raises(ConflictError, match="not this project's accepted offer"):
        w.uc.start_client_project.start_client_project(project, 999)


def test_a_direct_start_is_refused_naming_the_missing_condition(w):
    project = w.project()
    with pytest.raises(StartConditionMissingError, match="Missing: Team full and proposal closed"):
        w.uc.start.execute(LEAD, project)


def test_a_developer_idea_starts_when_its_lead_finalises_the_timeline(w):
    project = w.project(ProjectKind.DEVELOPER)
    w.uc.close_proposal.execute(LEAD, project)
    view = w.uc.finalize_timeline.execute(LEAD, project, date(2026, 11, 2), date(2027, 1, 15))
    record = w.record(project)
    assert (record.project.status, record.team.status) == (ProjectStatus.IN_PROGRESS, TeamStatus.ACTIVE)
    assert (view.started, view.offers, view.deposit, view.deposit_percent) == (True, None, None, None)
    assert view.timeline.start_date == "2026-11-02"
    assert w.offers.rows == {} and w.workspace.opened[project] == [LEAD_ID, *DEV_IDS[:4]]


def test_the_timeline_waits_for_the_closed_proposal_and_is_finalised_once(w):
    project = w.project(ProjectKind.DEVELOPER)
    with pytest.raises(InvalidStateTransitionError, match="closes the project proposal first"):
        w.uc.finalize_timeline.execute(LEAD, project, date(2026, 11, 2), date(2027, 1, 15))
    w.uc.close_proposal.execute(LEAD, project)
    w.uc.finalize_timeline.execute(LEAD, project, date(2026, 11, 2), date(2027, 1, 15))
    with pytest.raises(InvalidStateTransitionError, match="already started"):
        w.uc.finalize_timeline.execute(LEAD, project, date(2026, 11, 2), date(2027, 1, 15))


def test_only_a_developer_ideas_lead_finalises_its_timeline(w):
    idea = w.project(ProjectKind.DEVELOPER)
    w.uc.close_proposal.execute(LEAD, idea)
    with pytest.raises(ForbiddenError):
        w.uc.finalize_timeline.execute(dev(0), idea, date(2026, 11, 2), date(2027, 1, 15))
    client_project = w.project()
    w.uc.close_proposal.execute(LEAD, client_project)
    with pytest.raises(InvalidStateTransitionError, match="part of its offer"):
        w.uc.finalize_timeline.execute(LEAD, client_project, date(2026, 11, 2), date(2027, 1, 15))


# --- gate status --------------------------------------------------------------------


@pytest.mark.parametrize(("who", "role"), [(CLIENT, "client"), (LEAD, "lead"), (dev(1), "member")])
def test_the_client_lead_and_members_see_the_gate(w, who, role):
    view = w.uc.get.execute(who, w.project())
    assert view.viewer_role == role
    assert [c.key for c in view.conditions] == ["team_locked", "offer_accepted", "deposit_confirmed"]


def test_anyone_else_cannot_see_the_gate(w):
    with pytest.raises(ForbiddenError):
        w.uc.get.execute(STRANGER, w.project())


def test_only_the_lead_previews_a_deposit_and_never_below_the_minimum(w):
    project = w.project()
    with pytest.raises(ForbiddenError):
        w.uc.preview_deposit.execute(CLIENT, project, 1_000_000)
    with pytest.raises(ValidationError) as refused:
        w.uc.preview_deposit.execute(LEAD, project, 149_999)
    assert "total_cents" in refused.value.fields
