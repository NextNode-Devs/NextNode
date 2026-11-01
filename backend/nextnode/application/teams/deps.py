"""The collaborators every Hire Devs use case shares, and the steps they repeat."""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID, uuid4

from nextnode.application.conversations.ports import AccountNames, Clock, ConversationEvents
from nextnode.application.ports import Actor
from nextnode.application.projects.ports import ProjectRecord, ProjectRepository
from nextnode.application.teams.dto import CandidacyView, team_updated_frame
from nextnode.application.teams.ports import (
    CandidacyRepository,
    DeveloperAccounts,
    HiringConversations,
    UnitOfWork,
)
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.teams import TEAM_FULL_REASON, Candidacy, Team, close_all

PROJECT_NOT_FOUND = "Project not found."


def require_account(actor: Actor) -> int:
    if actor.account_id is None:
        raise ForbiddenError("Finish setting up your account first.")
    return actor.account_id


class TeamDeps:
    def __init__(
        self,
        projects: ProjectRepository,
        candidacies: CandidacyRepository,
        accounts: DeveloperAccounts,
        conversations: HiringConversations,
        events: ConversationEvents,
        names: AccountNames,
        clock: Clock,
        uow: UnitOfWork,
        new_id: Callable[[], UUID] = uuid4,
    ) -> None:
        self.projects = projects
        self.candidacies = candidacies
        self.accounts = accounts
        self.conversations = conversations
        self.events = events
        self.names = names
        self.clock = clock
        self.uow = uow
        self.new_id = new_id

    def lock_team(self, project_id: int) -> Team:
        """Locks the project and team until the transaction ends. Every roster
        change happens under this lock, so spots fill one at a time."""
        record: ProjectRecord | None = self.projects.get_for_update(project_id)
        if record is None:
            raise NotFoundError(PROJECT_NOT_FOUND)
        return record.team

    def view(self, candidacy: Candidacy, actor: Actor) -> CandidacyView:
        conversation_id = self.conversations.conversation_id_for(candidacy.id)
        return CandidacyView.of(candidacy, actor.account_id, conversation_id)

    def announce(self, candidacy: Candidacy) -> None:
        conversation_id = self.conversations.conversation_id_for(candidacy.id)
        self.events.publish(candidacy.participant_ids, team_updated_frame(candidacy, conversation_id))

    def close_pending(self, project_id: int, reason: str) -> list[Candidacy]:
        """Closes every pending candidacy for the project and its conversation, live."""
        closed = close_all(self.candidacies.pending_for_project(project_id), reason, self.clock.now())
        for candidacy in closed:
            self.candidacies.save(candidacy)
            self.conversations.close_for_candidacy(candidacy.id, reason)
            self.announce(candidacy)
        return closed

    def close_pending_if_full(self, project_id: int, team: Team) -> list[Candidacy]:
        return self.close_pending(project_id, TEAM_FULL_REASON) if team.is_full else []
