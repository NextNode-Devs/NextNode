"""Team and Candidacy rules: size 5-7 with the Lead, spot arithmetic, who may
accept what, and closing the rest when the team is full."""

from datetime import UTC, datetime
from uuid import UUID

import pytest

from nextnode.domain.errors import ForbiddenError
from nextnode.domain.teams import (
    RECRUITMENT_CLOSED,
    TEAM_FULL_REASON,
    Candidacy,
    CandidacyClosedError,
    CandidacyKind,
    CandidacyStatus,
    DuplicateCandidacyError,
    Team,
    TeamFullError,
    TeamNotRecruitingError,
    TeamSizeError,
    TeamStatus,
    close_all,
)

LEAD = 1
DEV = 50
AT = datetime(2026, 11, 1, tzinfo=UTC)


def team(size: int | None = 5, members: int = 0, status: TeamStatus = TeamStatus.OPEN) -> Team:
    return Team(
        id=1,
        project_id=10,
        status=status,
        lead_account_id=LEAD,
        team_size=size,
        member_account_ids=tuple(100 + n for n in range(members)),
    )


def candidacy(kind: CandidacyKind, dev: int = DEV, n: int = 1) -> Candidacy:
    return Candidacy(UUID(int=n), 10, LEAD, dev, kind)


# --- size: 5 to 7 people including the Lead -------------------------------------


@pytest.mark.parametrize("size", [5, 6, 7])
def test_size_between_five_and_seven_is_accepted(size):
    assert team(size=None).with_size(size).team_size == size


@pytest.mark.parametrize("size", [0, 4, 8, -1])
def test_size_outside_five_to_seven_is_refused_naming_the_rule(size):
    with pytest.raises(TeamSizeError) as raised:
        team(size=None).with_size(size)
    assert "5 to 7 people including the Team Lead" in raised.value.message
    assert "size" in raised.value.fields


def test_size_can_shrink_only_while_current_members_still_fit():
    assert team(size=7, members=4).with_size(5).team_size == 5  # 5 people on it
    with pytest.raises(TeamSizeError, match="already has 6 people"):
        team(size=7, members=5).with_size(5)


# --- spot arithmetic ------------------------------------------------------------


@pytest.mark.parametrize(
    ("size", "members", "developer_spots", "open_spots", "full"),
    [
        (5, 0, 4, 4, False),
        (5, 4, 4, 0, True),
        (6, 2, 5, 3, False),
        (7, 6, 6, 0, True),
        (None, 0, 0, 0, False),  # nothing open until the Lead sets the size
    ],
)
def test_spot_arithmetic(size, members, developer_spots, open_spots, full):
    roster = team(size=size, members=members)
    assert roster.headcount == members + 1
    assert roster.developer_spots == developer_spots
    assert roster.open_spots == open_spots
    assert roster.is_full is full


def test_each_new_member_takes_exactly_one_spot():
    joined = team(size=6, members=1).with_member(DEV)
    assert (joined.open_spots, joined.headcount) == (3, 3)


def test_a_full_team_is_never_over_filled():
    with pytest.raises(TeamFullError, match="already has 5 of 5 people"):
        team(size=5, members=4).with_member(DEV)


def test_no_one_joins_before_the_size_is_set():
    with pytest.raises(TeamNotRecruitingError, match="not set the team size"):
        team(size=None).with_member(DEV)


def test_the_lead_and_existing_members_cannot_join_again():
    roster = team(size=6, members=1)
    with pytest.raises(DuplicateCandidacyError):
        roster.with_member(LEAD)
    with pytest.raises(DuplicateCandidacyError):
        roster.with_member(100)


@pytest.mark.parametrize("status", [TeamStatus.LOCKED, TeamStatus.ACTIVE, TeamStatus.ARCHIVED])
def test_a_team_that_is_not_open_says_recruitment_has_closed(status):
    roster = team(size=6, members=1, status=status)
    for change in (lambda: roster.with_size(7), lambda: roster.with_member(DEV)):
        with pytest.raises(TeamNotRecruitingError) as raised:
            change()
        assert raised.value.message == RECRUITMENT_CLOSED == "Recruitment has closed"


# --- who accepts what -----------------------------------------------------------


def test_the_lead_accepts_an_application():
    accepted, joined = candidacy(CandidacyKind.APPLICATION).accept(team(), LEAD, AT)
    assert (accepted.status, accepted.decided_at) == (CandidacyStatus.ACCEPTED, AT)
    assert joined.member_account_ids == (DEV,)


def test_an_applicant_cannot_accept_their_own_application():
    with pytest.raises(ForbiddenError, match="Only the Team Lead"):
        candidacy(CandidacyKind.APPLICATION).accept(team(), DEV, AT)


def test_only_the_invitee_accepts_an_invitation():
    invitation = candidacy(CandidacyKind.INVITATION)
    with pytest.raises(ForbiddenError, match="Only the invited developer"):
        invitation.accept(team(), LEAD, AT)
    accepted, joined = invitation.accept(team(), DEV, AT)
    assert accepted.status is CandidacyStatus.ACCEPTED
    assert joined.member_account_ids == (DEV,)


def test_an_accepted_or_closed_candidacy_cannot_be_decided_again():
    accepted, _ = candidacy(CandidacyKind.APPLICATION).accept(team(), LEAD, AT)
    with pytest.raises(CandidacyClosedError, match="already accepted"):
        accepted.accept(team(), LEAD, AT)
    closed = candidacy(CandidacyKind.APPLICATION).close(TEAM_FULL_REASON, AT)
    with pytest.raises(CandidacyClosedError, match="The team is full"):
        closed.accept(team(), LEAD, AT)
    with pytest.raises(CandidacyClosedError, match="The team is full"):
        closed.withdraw(DEV, AT)


def test_a_locked_team_refuses_an_accept():
    with pytest.raises(TeamNotRecruitingError, match="Recruitment has closed"):
        candidacy(CandidacyKind.APPLICATION).accept(team(status=TeamStatus.LOCKED), LEAD, AT)


# --- ending a candidacy ---------------------------------------------------------


def test_each_ending_belongs_to_one_side_and_records_why():
    application = candidacy(CandidacyKind.APPLICATION)
    with pytest.raises(ForbiddenError):
        application.reject(DEV, AT)
    with pytest.raises(ForbiddenError):
        application.withdraw(LEAD, AT)
    assert application.reject(LEAD, AT).status is CandidacyStatus.REJECTED
    assert application.withdraw(DEV, AT).status is CandidacyStatus.WITHDRAWN
    invitation = candidacy(CandidacyKind.INVITATION)
    with pytest.raises(ForbiddenError):
        invitation.decline(LEAD, AT)
    declined = invitation.decline(DEV, AT)
    assert (declined.status, declined.closed_reason) == (
        CandidacyStatus.DECLINED,
        "The developer declined the invitation",
    )


def test_close_all_closes_only_the_pending_ones():
    accepted, _ = candidacy(CandidacyKind.APPLICATION, n=1).accept(team(), LEAD, AT)
    waiting = candidacy(CandidacyKind.INVITATION, dev=60, n=2)
    closed = close_all([accepted, waiting], TEAM_FULL_REASON, AT)
    assert [c.id for c in closed] == [waiting.id]
    assert (closed[0].status, closed[0].closed_reason) == (CandidacyStatus.CLOSED, "The team is full")
