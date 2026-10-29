"""TeamRoster and Candidacy rules: size 5-7 with the Lead, spot arithmetic,
who may accept what, and closing the rest when the team is full."""

from uuid import UUID

import pytest

from nextnode.domain.errors import ForbiddenError
from nextnode.domain.teams import (
    TEAM_FULL_REASON,
    Candidacy,
    CandidacyClosedError,
    CandidacyKind,
    CandidacyStatus,
    DuplicateCandidacyError,
    TeamFullError,
    TeamNotRecruitingError,
    TeamRoster,
    TeamSizeError,
    TeamStatus,
    accept,
    close_pending_if_full,
)

LEAD = "user_lead"


def roster(size: int | None = 5, members: int = 0, status: TeamStatus = TeamStatus.OPEN) -> TeamRoster:
    return TeamRoster(
        team_id=1,
        project_id=10,
        lead_user_id=LEAD,
        status=status,
        team_size=size,
        member_user_ids=[f"user_member_{n}" for n in range(members)],
    )


def candidacy(kind: CandidacyKind, dev: str = "user_dev", n: int = 1, team_id: int = 1) -> Candidacy:
    return Candidacy(UUID(int=n), team_id, kind, dev)


# --- size: 5 to 7 people including the Lead -------------------------------------


@pytest.mark.parametrize("size", [5, 6, 7])
def test_size_between_five_and_seven_is_accepted(size):
    team = roster(size=None)
    team.set_size(size)
    assert team.team_size == size


@pytest.mark.parametrize("size", [0, 4, 8, -1])
def test_size_outside_five_to_seven_is_refused(size):
    team = roster(size=None)
    with pytest.raises(TeamSizeError) as raised:
        team.set_size(size)
    assert "5 to 7 people including the Team Lead" in raised.value.message
    assert "team_size" in raised.value.fields
    assert team.team_size is None


def test_size_can_shrink_only_while_current_members_still_fit():
    team = roster(size=7, members=4)  # 5 people on it
    team.set_size(5)
    assert team.team_size == 5
    team = roster(size=7, members=5)  # 6 people on it
    with pytest.raises(TeamSizeError, match="already has 6 people"):
        team.set_size(5)
    assert team.team_size == 7


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
    team = roster(size=size, members=members)
    assert team.headcount == members + 1
    assert team.developer_spots == developer_spots
    assert team.open_spots == open_spots
    assert team.is_full is full


def test_each_new_member_takes_exactly_one_spot():
    team = roster(size=6, members=1)
    team.add_member("user_new")
    assert team.open_spots == 3
    assert team.headcount == 3


def test_a_full_team_is_never_over_filled():
    team = roster(size=5, members=4)
    with pytest.raises(TeamFullError, match="already has 5 of 5 people"):
        team.add_member("user_extra")
    assert len(team.member_user_ids) == 4


def test_no_one_joins_before_the_size_is_set():
    with pytest.raises(TeamNotRecruitingError, match="not set the team size"):
        roster(size=None).add_member("user_dev")


def test_the_lead_and_existing_members_cannot_join_again():
    team = roster(size=6, members=1)
    with pytest.raises(DuplicateCandidacyError):
        team.add_member(LEAD)
    with pytest.raises(DuplicateCandidacyError):
        team.add_member("user_member_0")


@pytest.mark.parametrize("status", [TeamStatus.LOCKED, TeamStatus.ACTIVE, TeamStatus.ARCHIVED])
def test_a_team_that_is_not_open_refuses_every_roster_change(status):
    team = roster(size=6, members=1, status=status)
    with pytest.raises(TeamNotRecruitingError):
        team.set_size(7)
    with pytest.raises(TeamNotRecruitingError):
        team.add_member("user_dev")
    assert team.team_size == 6


def test_the_locked_message_says_what_is_refused():
    with pytest.raises(TeamNotRecruitingError, match="roster is locked"):
        roster(status=TeamStatus.LOCKED).ensure_open()


# --- who accepts what -----------------------------------------------------------


def test_the_lead_accepts_an_application():
    team, application = roster(), candidacy(CandidacyKind.APPLICATION)
    accept(application, team, LEAD)
    assert application.status is CandidacyStatus.ACCEPTED
    assert team.member_user_ids == ["user_dev"]


def test_an_applicant_cannot_accept_their_own_application():
    team, application = roster(), candidacy(CandidacyKind.APPLICATION)
    with pytest.raises(ForbiddenError, match="Only the Team Lead"):
        accept(application, team, "user_dev")
    assert application.is_pending
    assert team.member_user_ids == []


def test_only_the_invitee_accepts_an_invitation():
    team, invitation = roster(), candidacy(CandidacyKind.INVITATION)
    with pytest.raises(ForbiddenError, match="Only the invited developer"):
        accept(invitation, team, LEAD)
    assert invitation.is_pending
    accept(invitation, team, "user_dev")
    assert invitation.status is CandidacyStatus.ACCEPTED
    assert team.member_user_ids == ["user_dev"]


def test_an_accepted_or_closed_candidacy_cannot_be_accepted_again():
    team, application = roster(), candidacy(CandidacyKind.APPLICATION)
    accept(application, team, LEAD)
    with pytest.raises(CandidacyClosedError, match="already accepted"):
        accept(application, team, LEAD)
    closed = candidacy(CandidacyKind.APPLICATION, dev="user_other", n=2)
    closed.close(TEAM_FULL_REASON)
    with pytest.raises(CandidacyClosedError, match="The team is full"):
        accept(closed, team, LEAD)


def test_accepting_into_a_full_team_changes_nothing():
    team, application = roster(size=5, members=4), candidacy(CandidacyKind.APPLICATION)
    with pytest.raises(TeamFullError):
        accept(application, team, LEAD)
    assert application.is_pending


# --- closing the rest when the team fills up -----------------------------------


def test_filling_the_last_spot_closes_the_other_pending_candidacies():
    team = roster(size=5, members=3)
    last = candidacy(CandidacyKind.APPLICATION, dev="user_last", n=1)
    others = [
        candidacy(CandidacyKind.APPLICATION, dev="user_a", n=2),
        candidacy(CandidacyKind.INVITATION, dev="user_b", n=3),
    ]
    other_team = candidacy(CandidacyKind.APPLICATION, dev="user_c", n=4, team_id=2)
    accept(last, team, LEAD)
    closed = close_pending_if_full(team, [last, *others, other_team])
    assert closed == others
    assert all(c.status is CandidacyStatus.CLOSED for c in others)
    assert all(c.closed_reason == "The team is full" for c in others)
    assert last.status is CandidacyStatus.ACCEPTED
    assert other_team.is_pending


def test_nothing_closes_while_spots_remain():
    team = roster(size=6, members=1)
    pending = [candidacy(CandidacyKind.APPLICATION)]
    assert close_pending_if_full(team, pending) == []
    assert pending[0].is_pending
