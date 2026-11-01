"""Hire Devs use cases with in-memory fakes: no database, no sockets."""

from uuid import UUID

import pytest

from nextnode.application.ports import Actor
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.projects import ProjectKind
from nextnode.domain.teams import (
    CandidacyClosedError,
    CandidacyStatus,
    DuplicateCandidacyError,
    TeamFullError,
    TeamNotRecruitingError,
    TeamSizeError,
    TeamStatus,
)
from tests.team_fakes import CLIENT, CLIENT_ID, DEV_IDS, LEAD, LEAD_ID, STRANGER, World, dev


@pytest.fixture
def w() -> World:
    return World()


@pytest.fixture
def project(w: World) -> int:
    return w.project()


# --- SetTeamSize ----------------------------------------------------------------


def test_the_lead_sets_the_team_size(w, project):
    view = w.uc.set_team_size.execute(LEAD, project, 6)
    assert (view.size, view.developer_spots, view.open_spots, view.status) == (6, 5, 5, "open")
    assert w.team(project).team_size == 6


@pytest.mark.parametrize("size", [4, 8])
def test_a_size_outside_five_to_seven_is_refused(w, project, size):
    with pytest.raises(TeamSizeError):
        w.uc.set_team_size.execute(LEAD, project, size)
    assert w.team(project).team_size is None


@pytest.mark.parametrize("who", [dev(0), CLIENT])
def test_only_the_lead_sets_the_size(w, project, who):
    with pytest.raises(ForbiddenError, match="Only this team's Team Lead"):
        w.uc.set_team_size.execute(who, project, 6)
    assert w.team(project).team_size is None


def test_nobody_sets_a_size_before_a_lead_is_hired(w):
    project = w.project(lead_id=None)
    with pytest.raises(ForbiddenError):
        w.uc.set_team_size.execute(CLIENT, project, 5)


def test_the_size_of_a_missing_project_is_not_found(w):
    with pytest.raises(NotFoundError):
        w.uc.set_team_size.execute(LEAD, 99, 6)


def test_the_size_cannot_shrink_below_the_people_already_on_the_team(w, project):
    w.uc.set_team_size.execute(LEAD, project, 7)
    for n in range(5):
        w.projects.add_member(project, DEV_IDS[n])
    with pytest.raises(TeamSizeError, match="already has 6 people"):
        w.uc.set_team_size.execute(LEAD, project, 5)
    assert w.team(project).team_size == 7


def test_a_locked_team_refuses_a_new_size(w, project):
    w.uc.set_team_size.execute(LEAD, project, 7)
    w.set_status(project, TeamStatus.LOCKED)
    with pytest.raises(TeamNotRecruitingError, match="Recruitment has closed"):
        w.uc.set_team_size.execute(LEAD, project, 6)


def test_shrinking_to_the_current_headcount_closes_pending_candidacies(w, project):
    w.uc.set_team_size.execute(LEAD, project, 6)
    for n in range(4):
        w.projects.add_member(project, DEV_IDS[n])
    waiting = w.uc.apply_to_join.execute(dev(5), project)
    view = w.uc.set_team_size.execute(LEAD, project, 5)
    assert view.open_spots == 0
    assert view.closed_candidacy_ids == [waiting.id]
    assert w.conversations.closed[UUID(waiting.id)] == "The team is full"
    assert w.candidacies.get(UUID(waiting.id)).status is CandidacyStatus.CLOSED


def test_works_with_the_creator_as_lead_on_a_developer_idea(w):
    idea = w.project(kind=ProjectKind.DEVELOPER)
    assert w.uc.set_team_size.execute(LEAD, idea, 5).open_spots == 4


# --- ApplyToJoinTeam ------------------------------------------------------------


def test_a_developer_applies_and_a_conversation_opens(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    assert (application.kind, application.status) == ("application", "pending")
    assert application.conversation_id == f"conversation-{application.id}"
    assert w.conversations.opened == [(UUID(application.id), LEAD_ID, DEV_IDS[0])]
    assert application.actions.withdraw is True
    assert application.actions.accept is False
    [(recipients, frame)] = w.events.frames
    assert recipients == (LEAD_ID, DEV_IDS[0])
    assert (frame["type"], frame["status"]) == ("team.updated", "pending")


def test_a_client_cannot_apply_to_join(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    with pytest.raises(ForbiddenError, match="Only developers"):
        w.uc.apply_to_join.execute(CLIENT, project)
    assert w.candidacies.rows == {}


def test_someone_without_an_account_cannot_apply(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    with pytest.raises(ForbiddenError, match="Finish setting up"):
        w.uc.apply_to_join.execute(Actor("user_new", None), project)


def test_applying_twice_is_refused(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    w.uc.apply_to_join.execute(dev(0), project)
    with pytest.raises(DuplicateCandidacyError, match="already applied"):
        w.uc.apply_to_join.execute(dev(0), project)
    assert len(w.conversations.opened) == 1


@pytest.mark.parametrize("ending", ["withdraw_application", "reject_application"])
def test_a_developer_applies_once_per_team_whatever_became_of_it(w, project, ending):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    who = dev(0) if ending == "withdraw_application" else LEAD
    getattr(w.uc, ending).execute(who, UUID(application.id))
    with pytest.raises(DuplicateCandidacyError, match="already applied"):
        w.uc.apply_to_join.execute(dev(0), project)


def test_the_lead_and_members_cannot_apply_to_their_own_team(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    with pytest.raises(DuplicateCandidacyError, match="Team Lead already"):
        w.uc.apply_to_join.execute(LEAD, project)
    w.uc.accept_application.execute(LEAD, UUID(w.uc.apply_to_join.execute(dev(0), project).id))
    with pytest.raises(DuplicateCandidacyError, match="already a member"):
        w.uc.apply_to_join.execute(dev(0), project)


def test_applying_before_the_size_is_set_is_refused(w, project):
    with pytest.raises(TeamNotRecruitingError, match="not set the team size"):
        w.uc.apply_to_join.execute(dev(0), project)


def test_a_missing_project_is_not_found(w):
    with pytest.raises(NotFoundError, match="Project not found"):
        w.uc.apply_to_join.execute(dev(0), 99)


# --- deciding an application ----------------------------------------------------


def test_the_lead_accepts_an_application(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    accepted = w.uc.accept_application.execute(LEAD, UUID(application.id))
    assert accepted.status == "accepted"
    team = w.team(project)
    assert (team.member_account_ids, team.headcount, team.open_spots) == ((DEV_IDS[0],), 2, 3)
    assert UUID(application.id) not in w.conversations.closed  # they keep talking


def test_the_applicant_cannot_accept_their_own_application(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    with pytest.raises(ForbiddenError, match="Only the Team Lead"):
        w.uc.accept_application.execute(dev(0), UUID(application.id))
    assert w.team(project).member_account_ids == ()


def test_the_lead_rejects_and_the_conversation_closes_with_the_reason(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    rejected = w.uc.reject_application.execute(LEAD, UUID(application.id))
    assert (rejected.status, rejected.closed_reason) == (
        "rejected",
        "The Team Lead turned down this application",
    )
    assert w.conversations.closed[UUID(application.id)] == rejected.closed_reason
    assert w.team(project).member_account_ids == ()
    with pytest.raises(CandidacyClosedError):
        w.uc.accept_application.execute(LEAD, UUID(application.id))


def test_the_applicant_withdraws(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    with pytest.raises(ForbiddenError, match="Only the developer"):
        w.uc.withdraw_application.execute(LEAD, UUID(application.id))
    assert w.uc.withdraw_application.execute(dev(0), UUID(application.id)).status == "withdrawn"
    assert UUID(application.id) in w.conversations.closed


def test_strangers_and_other_teams_see_nothing(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    for who in (STRANGER, CLIENT):
        for action in (w.uc.accept_application, w.uc.reject_application, w.uc.withdraw_application):
            with pytest.raises(NotFoundError, match="Application not found"):
                action.execute(who, UUID(application.id))


# --- InviteDeveloper ------------------------------------------------------------


def test_the_lead_invites_and_the_invitee_is_not_a_member_until_they_accept(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    invitation = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    assert (invitation.kind, invitation.developer_account_id) == ("invitation", DEV_IDS[0])
    assert w.conversations.opened == [(UUID(invitation.id), LEAD_ID, DEV_IDS[0])]
    assert w.team(project).member_account_ids == ()
    assert invitation.actions.accept is False  # what the Lead sees


@pytest.mark.parametrize("who", [dev(1), CLIENT])
def test_only_the_lead_invites(w, project, who):
    w.uc.set_team_size.execute(LEAD, project, 5)
    with pytest.raises(ForbiddenError, match="Only this team's Team Lead"):
        w.uc.invite_developer.execute(who, project, DEV_IDS[0])
    assert w.candidacies.rows == {}


def test_a_client_or_unknown_account_cannot_be_invited(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    for target in (CLIENT_ID, 9999):
        with pytest.raises(NotFoundError, match="Developer not found"):
            w.uc.invite_developer.execute(LEAD, project, target)


def test_the_lead_cannot_invite_themselves_or_a_member(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    with pytest.raises(DuplicateCandidacyError):
        w.uc.invite_developer.execute(LEAD, project, LEAD_ID)
    w.projects.add_member(project, DEV_IDS[0])
    with pytest.raises(DuplicateCandidacyError, match="already a member"):
        w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])


def test_duplicates_point_to_what_is_already_open(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    with pytest.raises(DuplicateCandidacyError, match="already invited"):
        w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    with pytest.raises(DuplicateCandidacyError, match="accept the invitation instead"):
        w.uc.apply_to_join.execute(dev(0), project)
    w.uc.apply_to_join.execute(dev(1), project)
    with pytest.raises(DuplicateCandidacyError, match="accept their application instead"):
        w.uc.invite_developer.execute(LEAD, project, DEV_IDS[1])


def test_a_declined_developer_can_be_invited_again(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    first = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    w.uc.decline_invitation.execute(dev(0), UUID(first.id))
    assert w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0]).status == "pending"


# --- deciding an invitation -----------------------------------------------------


def test_the_invitee_accepts_and_the_lead_cannot_accept_for_them(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    invitation = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    with pytest.raises(ForbiddenError, match="Only the invited developer"):
        w.uc.accept_invitation.execute(LEAD, UUID(invitation.id))
    assert w.team(project).member_account_ids == ()
    assert w.uc.accept_invitation.execute(dev(0), UUID(invitation.id)).status == "accepted"
    assert w.team(project).member_account_ids == (DEV_IDS[0],)


def test_the_invitee_declines_and_the_conversation_closes(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    invitation = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    with pytest.raises(ForbiddenError, match="Only the invited developer"):
        w.uc.decline_invitation.execute(LEAD, UUID(invitation.id))
    assert w.uc.decline_invitation.execute(dev(0), UUID(invitation.id)).status == "declined"
    assert w.conversations.closed[UUID(invitation.id)] == "The developer declined the invitation"


def test_the_wrong_url_for_the_kind_is_not_found(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    invitation = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    application = w.uc.apply_to_join.execute(dev(1), project)
    with pytest.raises(NotFoundError, match="Application not found"):
        w.uc.accept_application.execute(LEAD, UUID(invitation.id))
    with pytest.raises(NotFoundError, match="Invitation not found"):
        w.uc.accept_invitation.execute(dev(1), UUID(application.id))


def test_a_developer_can_lead_one_project_and_join_another(w, project):
    other = w.project(lead_id=DEV_IDS[0], kind=ProjectKind.DEVELOPER)
    w.uc.set_team_size.execute(dev(0), other, 5)
    w.uc.set_team_size.execute(LEAD, project, 5)
    invitation = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    w.uc.accept_invitation.execute(dev(0), UUID(invitation.id))
    assert w.team(other).is_lead(DEV_IDS[0])
    assert w.team(project).is_member(DEV_IDS[0])


# --- filling the team and closing the rest ------------------------------------


def fill_all_but_one(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    for n in range(3):
        w.uc.accept_application.execute(LEAD, UUID(w.uc.apply_to_join.execute(dev(n), project).id))


def test_the_last_spot_closes_every_other_pending_candidacy_and_conversation_live(w, project):
    fill_all_but_one(w, project)
    last = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[3])
    waiting_application = w.uc.apply_to_join.execute(dev(4), project)
    waiting_invitation = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[5])
    w.events.frames.clear()

    accepted = w.uc.accept_invitation.execute(dev(3), UUID(last.id))

    team = w.team(project)
    assert accepted.status == "accepted"
    assert (team.headcount, team.open_spots, team.is_full) == (5, 0, True)
    for waiting in (waiting_application, waiting_invitation):
        stored = w.candidacies.get(UUID(waiting.id))
        assert (stored.status, stored.closed_reason) == (CandidacyStatus.CLOSED, "The team is full")
        assert w.conversations.closed[UUID(waiting.id)] == "The team is full"
    assert UUID(last.id) not in w.conversations.closed  # the new member keeps theirs
    announced = {frame["candidacy_id"]: frame["status"] for _, frame in w.events.frames}
    assert announced == {
        last.id: "accepted",
        waiting_application.id: "closed",
        waiting_invitation.id: "closed",
    }


def test_a_full_team_refuses_new_applications_and_invitations(w, project):
    fill_all_but_one(w, project)
    w.uc.accept_application.execute(LEAD, UUID(w.uc.apply_to_join.execute(dev(3), project).id))
    with pytest.raises(TeamFullError, match="already has 5 of 5 people"):
        w.uc.apply_to_join.execute(dev(6), project)
    with pytest.raises(TeamFullError):
        w.uc.invite_developer.execute(LEAD, project, DEV_IDS[7])


def test_a_candidacy_closed_by_the_full_team_cannot_be_accepted_later(w, project):
    fill_all_but_one(w, project)
    waiting = w.uc.apply_to_join.execute(dev(9), project)
    w.uc.accept_application.execute(LEAD, UUID(w.uc.apply_to_join.execute(dev(3), project).id))
    with pytest.raises(CandidacyClosedError, match="The team is full"):
        w.uc.accept_application.execute(LEAD, UUID(waiting.id))
    assert len(w.team(project).member_account_ids) == 4


def test_making_room_again_does_not_reopen_closed_candidacies(w, project):
    fill_all_but_one(w, project)
    waiting = w.uc.apply_to_join.execute(dev(9), project)
    w.uc.accept_application.execute(LEAD, UUID(w.uc.apply_to_join.execute(dev(3), project).id))
    w.uc.set_team_size.execute(LEAD, project, 6)
    assert w.candidacies.get(UUID(waiting.id)).status is CandidacyStatus.CLOSED


# --- a Locked team -------------------------------------------------------------


def test_a_locked_team_refuses_applying_inviting_and_accepting(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    invitation = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[1])
    w.set_status(project, TeamStatus.LOCKED)
    refused = [
        lambda: w.uc.apply_to_join.execute(dev(2), project),
        lambda: w.uc.invite_developer.execute(LEAD, project, DEV_IDS[3]),
        lambda: w.uc.accept_application.execute(LEAD, UUID(application.id)),
        lambda: w.uc.accept_invitation.execute(dev(1), UUID(invitation.id)),
    ]
    for attempt in refused:
        with pytest.raises(TeamNotRecruitingError) as raised:
            attempt()
        assert raised.value.message == "Recruitment has closed"
    assert w.team(project).member_account_ids == ()


def test_close_recruitment_closes_what_is_pending_with_the_reason(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    accepted = w.uc.apply_to_join.execute(dev(1), project)
    w.uc.accept_application.execute(LEAD, UUID(accepted.id))
    assert w.uc.close_recruitment.execute(project) == [application.id]
    stored = w.candidacies.get(UUID(application.id))
    assert (stored.status, stored.closed_reason) == (CandidacyStatus.CLOSED, "Recruitment has closed")
    assert w.conversations.closed[UUID(application.id)] == "Recruitment has closed"
