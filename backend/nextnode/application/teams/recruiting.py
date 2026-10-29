"""SetTeamSize, ApplyToJoinTeam and InviteDeveloper: the Team Lead opens the
spots, then developers apply or the Team Lead invites (spec Workflow B)."""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID, uuid4

from nextnode.application.ports import Actor
from nextnode.application.teams.dto import CandidacyView, RosterUpdate
from nextnode.application.teams.ports import (
    CandidacyRepository,
    DeveloperAccounts,
    HiringConversations,
    TeamRosterRepository,
    UnitOfWork,
)
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.teams import (
    Candidacy,
    CandidacyKind,
    DuplicateCandidacyError,
    TeamRoster,
    close_pending_if_full,
)


def close_if_full(
    roster: TeamRoster, candidacies: CandidacyRepository, conversations: HiringConversations
) -> list[Candidacy]:
    """Closes the remaining candidacies and their conversations once the team is full."""
    closed = close_pending_if_full(roster, candidacies.pending_for_team(roster.team_id))
    for candidacy in closed:
        candidacies.save(candidacy)
        assert candidacy.closed_reason is not None
        conversations.close_for_candidacy(candidacy.id, candidacy.closed_reason)
    return closed


class SetTeamSize:
    """The Team Lead sets the total team size (5-7, Lead included)."""

    def __init__(
        self,
        rosters: TeamRosterRepository,
        candidacies: CandidacyRepository,
        conversations: HiringConversations,
        uow: UnitOfWork,
    ) -> None:
        self._rosters = rosters
        self._candidacies = candidacies
        self._conversations = conversations
        self._uow = uow

    def execute(self, actor: Actor, team_id: int, team_size: int) -> RosterUpdate:
        with self._uow.atomic():
            roster = self._rosters.get_for_update(team_id)
            if roster is None:
                raise NotFoundError("Team not found.")
            roster.ensure_lead(actor.clerk_user_id, "set the team size")
            roster.set_size(team_size)
            self._rosters.save(roster)
            closed = close_if_full(roster, self._candidacies, self._conversations)
        return RosterUpdate.of(roster, closed)


class _OpenCandidacy:
    """Shared by apply and invite: one pending candidacy per developer and
    team, with its hiring conversation."""

    def __init__(
        self,
        rosters: TeamRosterRepository,
        candidacies: CandidacyRepository,
        accounts: DeveloperAccounts,
        conversations: HiringConversations,
        uow: UnitOfWork,
        *,
        new_id: Callable[[], UUID] = uuid4,
    ) -> None:
        self._rosters = rosters
        self._candidacies = candidacies
        self._accounts = accounts
        self._conversations = conversations
        self._uow = uow
        self._new_id = new_id

    def _open(self, roster: TeamRoster, kind: CandidacyKind, developer_user_id: str) -> CandidacyView:
        roster.ensure_can_join(developer_user_id)
        existing = self._candidacies.find_pending(roster.team_id, developer_user_id)
        if existing is not None:
            raise DuplicateCandidacyError(self._duplicate_message(kind, existing.kind))
        candidacy = Candidacy(self._new_id(), roster.team_id, kind, developer_user_id)
        self._candidacies.save(candidacy)
        self._conversations.open_for_candidacy(
            candidacy.id, roster.team_id, roster.lead_user_id, developer_user_id
        )
        return CandidacyView.of(candidacy)

    @staticmethod
    def _duplicate_message(new: CandidacyKind, existing: CandidacyKind) -> str:
        if new is CandidacyKind.APPLICATION:
            if existing is CandidacyKind.APPLICATION:
                return "You have already applied to join this team."
            return "The Team Lead has already invited you to this team; accept the invitation instead."
        if existing is CandidacyKind.INVITATION:
            return "You have already invited this developer."
        return "This developer has already applied to join; accept their application instead."


class ApplyToJoinTeam(_OpenCandidacy):
    """A developer applies to join a team. Not applying to *lead* a project (#4)."""

    def execute(self, actor: Actor, team_id: int) -> CandidacyView:
        with self._uow.atomic():
            roster = self._rosters.get_for_update(team_id)
            if roster is None:
                raise NotFoundError("Team not found.")
            if not self._accounts.is_developer(actor.clerk_user_id):
                raise ForbiddenError("Only developers can apply to join a team.")
            return self._open(roster, CandidacyKind.APPLICATION, actor.clerk_user_id)


class InviteDeveloper(_OpenCandidacy):
    """The Team Lead invites a developer, who must accept before joining."""

    def execute(self, actor: Actor, team_id: int, developer_user_id: str) -> CandidacyView:
        with self._uow.atomic():
            roster = self._rosters.get_for_update(team_id)
            if roster is None:
                raise NotFoundError("Team not found.")
            roster.ensure_lead(actor.clerk_user_id, "invite developers")
            if not self._accounts.is_developer(developer_user_id):
                raise NotFoundError("Developer not found.")
            return self._open(roster, CandidacyKind.INVITATION, developer_user_id)
