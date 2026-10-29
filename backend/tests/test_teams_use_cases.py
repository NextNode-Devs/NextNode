"""Hire Devs use cases with in-memory fakes: no database, and no #1, #3 or #4
(accounts, teams and conversations are faked)."""

from uuid import UUID

import pytest

from nextnode.application.ports import Actor
from nextnode.application.teams.membership import AcceptApplication, AcceptInvitation
from nextnode.application.teams.recruiting import ApplyToJoinTeam, InviteDeveloper, SetTeamSize
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.teams import (
    CandidacyClosedError,
    CandidacyStatus,
    DuplicateCandidacyError,
    TeamFullError,
    TeamNotRecruitingError,
    TeamRoster,
    TeamSizeError,
    TeamStatus,
)
from tests.team_fakes import (
    FakeAccounts,
    FakeCandidacies,
    FakeConversations,
    FakeRosters,
    FakeUnitOfWork,
    TeamStore,
)

LEAD = Actor(clerk_user_id="user_lead", session_id="sess_lead")
CLIENT = Actor(clerk_user_id="user_client", session_id="sess_client")
STRANGER = Actor(clerk_user_id="user_stranger", session_id="sess_stranger")


def dev(n: int) -> Actor:
    return Actor(clerk_user_id=f"user_dev_{n}", session_id=f"sess_{n}")


@pytest.fixture
def store() -> TeamStore:
    store = TeamStore()
    store.rosters[1] = TeamRoster(team_id=1, project_id=10, lead_user_id=LEAD.clerk_user_id)
    store.rosters[2] = TeamRoster(team_id=2, project_id=20, lead_user_id="user_other_lead", team_size=5)
    store.developers = {LEAD.clerk_user_id, STRANGER.clerk_user_id, *(f"user_dev_{n}" for n in range(10))}
    return store


class UseCases:
    def __init__(self, store: TeamStore) -> None:
        ids = (UUID(int=n) for n in range(1, 100))
        rosters, candidacies = FakeRosters(store), FakeCandidacies(store)
        accounts, conversations, uow = FakeAccounts(store), FakeConversations(store), FakeUnitOfWork(store)
        self.set_size = SetTeamSize(rosters, candidacies, conversations, uow)
        self.apply = ApplyToJoinTeam(
            rosters, candidacies, accounts, conversations, uow, new_id=lambda: next(ids)
        )
        self.invite = InviteDeveloper(
            rosters, candidacies, accounts, conversations, uow, new_id=lambda: next(ids)
        )
        self.accept_application = AcceptApplication(rosters, candidacies, conversations, uow)
        self.accept_invitation = AcceptInvitation(rosters, candidacies, conversations, uow)


@pytest.fixture
def uc(store) -> UseCases:
    return UseCases(store)


# --- SetTeamSize ----------------------------------------------------------------


def test_the_lead_sets_the_team_size(uc, store):
    update = uc.set_size.execute(LEAD, 1, 6)
    assert (update.roster.team_size, update.roster.developer_spots, update.roster.open_spots) == (6, 5, 5)
    assert store.rosters[1].team_size == 6


@pytest.mark.parametrize("size", [4, 8])
def test_a_size_outside_five_to_seven_is_refused(uc, store, size):
    with pytest.raises(TeamSizeError):
        uc.set_size.execute(LEAD, 1, size)
    assert store.rosters[1].team_size is None


@pytest.mark.parametrize("actor", [dev(0), CLIENT])
def test_only_the_lead_sets_the_size(uc, store, actor):
    with pytest.raises(ForbiddenError, match="Only this team's Team Lead"):
        uc.set_size.execute(actor, 1, 6)
    assert store.rosters[1].team_size is None


def test_an_unknown_team_is_not_found(uc):
    with pytest.raises(NotFoundError):
        uc.set_size.execute(LEAD, 99, 6)


def test_shrinking_to_the_current_headcount_closes_pending_candidacies(uc, store):
    uc.set_size.execute(LEAD, 1, 6)
    for n in range(4):
        app = uc.apply.execute(dev(n), 1)
        uc.accept_application.execute(LEAD, UUID(app.id))
    waiting = uc.apply.execute(dev(5), 1)
    update = uc.set_size.execute(LEAD, 1, 5)
    assert update.roster.open_spots == 0
    assert update.closed_candidacy_ids == (waiting.id,)
    assert store.closed[UUID(waiting.id)] == "The team is full"


# --- ApplyToJoinTeam ------------------------------------------------------------


def test_a_developer_applies_and_a_conversation_opens(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    application = uc.apply.execute(dev(0), 1)
    assert (application.kind, application.status) == ("application", "pending")
    assert store.opened == [(UUID(application.id), 1, LEAD.clerk_user_id, "user_dev_0")]


def test_a_client_cannot_apply_to_join(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    with pytest.raises(ForbiddenError, match="Only developers"):
        uc.apply.execute(CLIENT, 1)
    assert store.candidacies == {}


def test_applying_twice_is_refused(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    uc.apply.execute(dev(0), 1)
    with pytest.raises(DuplicateCandidacyError, match="already applied"):
        uc.apply.execute(dev(0), 1)
    assert len(store.candidacies) == 1
    assert len(store.opened) == 1


def test_applying_while_invited_points_to_the_invitation(uc):
    uc.set_size.execute(LEAD, 1, 5)
    uc.invite.execute(LEAD, 1, "user_dev_0")
    with pytest.raises(DuplicateCandidacyError, match="accept the invitation instead"):
        uc.apply.execute(dev(0), 1)


def test_the_lead_cannot_apply_to_their_own_team(uc):
    uc.set_size.execute(LEAD, 1, 5)
    with pytest.raises(DuplicateCandidacyError, match="Team Lead already"):
        uc.apply.execute(LEAD, 1)


def test_applying_before_the_size_is_set_is_refused(uc):
    with pytest.raises(TeamNotRecruitingError, match="not set the team size"):
        uc.apply.execute(dev(0), 1)


@pytest.mark.parametrize("status", [TeamStatus.LOCKED, TeamStatus.ACTIVE])
def test_a_team_that_is_not_open_refuses_applications_and_invitations(uc, store, status):
    store.rosters[2].status = status
    with pytest.raises(TeamNotRecruitingError):
        uc.apply.execute(dev(0), 2)
    with pytest.raises(TeamNotRecruitingError):
        uc.invite.execute(Actor("user_other_lead", None), 2, "user_dev_0")
    assert store.candidacies == {}


# --- InviteDeveloper ------------------------------------------------------------


def test_the_lead_invites_a_developer(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    invitation = uc.invite.execute(LEAD, 1, "user_dev_0")
    assert (invitation.kind, invitation.developer_user_id) == ("invitation", "user_dev_0")
    assert store.rosters[1].member_user_ids == []  # not a member until they accept


@pytest.mark.parametrize("actor", [dev(1), CLIENT])
def test_only_the_lead_invites(uc, store, actor):
    uc.set_size.execute(LEAD, 1, 5)
    with pytest.raises(ForbiddenError, match="Only this team's Team Lead"):
        uc.invite.execute(actor, 1, "user_dev_0")
    assert store.candidacies == {}


def test_a_client_or_unknown_user_cannot_be_invited(uc):
    uc.set_size.execute(LEAD, 1, 5)
    for target in (CLIENT.clerk_user_id, "user_nobody"):
        with pytest.raises(NotFoundError, match="Developer not found"):
            uc.invite.execute(LEAD, 1, target)


def test_inviting_an_applicant_points_to_their_application(uc):
    uc.set_size.execute(LEAD, 1, 5)
    uc.apply.execute(dev(0), 1)
    with pytest.raises(DuplicateCandidacyError, match="accept their application instead"):
        uc.invite.execute(LEAD, 1, "user_dev_0")


# --- AcceptApplication / AcceptInvitation ----------------------------------------


def test_the_lead_accepts_an_application(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    application = uc.apply.execute(dev(0), 1)
    result = uc.accept_application.execute(LEAD, UUID(application.id))
    assert result.candidacy.status == "accepted"
    assert (result.update.roster.headcount, result.update.roster.open_spots) == (2, 3)
    assert store.rosters[1].member_user_ids == ["user_dev_0"]


def test_the_applicant_cannot_accept_their_own_application(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    application = uc.apply.execute(dev(0), 1)
    with pytest.raises(ForbiddenError, match="Only the Team Lead"):
        uc.accept_application.execute(dev(0), UUID(application.id))
    assert store.rosters[1].member_user_ids == []


def test_the_invitee_accepts_and_the_lead_cannot_accept_for_them(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    invitation = uc.invite.execute(LEAD, 1, "user_dev_0")
    with pytest.raises(ForbiddenError, match="Only the invited developer"):
        uc.accept_invitation.execute(LEAD, UUID(invitation.id))
    assert store.rosters[1].member_user_ids == []
    uc.accept_invitation.execute(dev(0), UUID(invitation.id))
    assert store.rosters[1].member_user_ids == ["user_dev_0"]


def test_strangers_and_other_teams_leads_see_nothing(uc):
    uc.set_size.execute(LEAD, 1, 5)
    application = uc.apply.execute(dev(0), 1)
    for actor in (STRANGER, CLIENT, Actor("user_other_lead", None)):
        with pytest.raises(NotFoundError, match="Application not found"):
            uc.accept_application.execute(actor, UUID(application.id))


def test_the_wrong_accept_action_for_the_kind_is_not_found(uc):
    uc.set_size.execute(LEAD, 1, 5)
    invitation = uc.invite.execute(LEAD, 1, "user_dev_0")
    with pytest.raises(NotFoundError, match="Application not found"):
        uc.accept_application.execute(LEAD, UUID(invitation.id))


def test_filling_the_team_closes_every_other_candidacy_and_its_conversation(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    for n in range(3):
        uc.accept_application.execute(LEAD, UUID(uc.apply.execute(dev(n), 1).id))
    last = uc.invite.execute(LEAD, 1, "user_dev_3")
    waiting_app = uc.apply.execute(dev(4), 1)
    waiting_inv = uc.invite.execute(LEAD, 1, "user_dev_5")

    result = uc.accept_invitation.execute(dev(3), UUID(last.id))

    assert (result.update.roster.headcount, result.update.roster.open_spots) == (5, 0)
    assert set(result.update.closed_candidacy_ids) == {waiting_app.id, waiting_inv.id}
    for waiting in (waiting_app, waiting_inv):
        stored = store.candidacies[UUID(waiting.id)]
        assert (stored.status, stored.closed_reason) == (CandidacyStatus.CLOSED, "The team is full")
        assert store.closed[UUID(waiting.id)] == "The team is full"
    assert UUID(last.id) not in store.closed  # the accepted conversation stays open


def test_a_full_team_refuses_new_applications_and_invitations(uc):
    uc.set_size.execute(LEAD, 1, 5)
    for n in range(4):
        uc.accept_application.execute(LEAD, UUID(uc.apply.execute(dev(n), 1).id))
    with pytest.raises(TeamFullError, match="already has 5 of 5 people"):
        uc.apply.execute(dev(6), 1)
    with pytest.raises(TeamFullError):
        uc.invite.execute(LEAD, 1, "user_dev_7")


def test_a_closed_candidacy_cannot_be_accepted_later(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    waiting = uc.apply.execute(dev(9), 1)
    for n in range(4):
        uc.accept_application.execute(LEAD, UUID(uc.apply.execute(dev(n), 1).id))
    with pytest.raises(CandidacyClosedError, match="The team is full"):
        uc.accept_application.execute(LEAD, UUID(waiting.id))
    assert len(store.rosters[1].member_user_ids) == 4


def test_a_refused_accept_leaves_everything_as_it_was(uc, store):
    uc.set_size.execute(LEAD, 1, 5)
    application = uc.apply.execute(dev(0), 1)
    store.rosters[1].status = TeamStatus.LOCKED
    with pytest.raises(TeamNotRecruitingError):
        uc.accept_application.execute(LEAD, UUID(application.id))
    assert store.candidacies[UUID(application.id)].is_pending
    assert store.rosters[1].member_user_ids == []
