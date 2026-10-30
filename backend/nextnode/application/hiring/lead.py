"""Hire Lead use cases (issue #4): apply, invite, accept, decline, withdraw, hire.

Every application or invitation opens its hiring conversation; every decision
is broadcast to both people (``lead.updated``) after it is saved, and the
decisions that end a candidacy close its conversation with the reason.
"""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID, uuid4

from nextnode.application.conversations.commands import CloseConversation, OpenConversation
from nextnode.application.conversations.ports import Clock, ConversationEvents, ConversationRepository
from nextnode.application.hiring.dto import LeadCandidacyView, lead_updated_frame
from nextnode.application.hiring.ports import HiringAccounts, LeadCandidacies, LeadProjects, UnitOfWork
from nextnode.application.ports import Actor
from nextnode.domain.accounts import Role
from nextnode.domain.conversations import Subject, SubjectKind
from nextnode.domain.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from nextnode.domain.hiring import (
    ANOTHER_HIRED,
    DECLINED_REASON,
    WITHDRAWN_REASON,
    LeadAlreadyHiredError,
    LeadCandidacy,
    LeadCandidacyKind,
    LeadCandidacyStatus,
)

PROJECT_NOT_FOUND = "Project not found."
CANDIDACY_NOT_FOUND = "Application or invitation not found."


def subject_of(candidacy: LeadCandidacy) -> Subject:
    kind = (
        SubjectKind.LEAD_APPLICATION
        if candidacy.kind is LeadCandidacyKind.APPLICATION
        else SubjectKind.LEAD_INVITATION
    )
    return Subject(kind, str(candidacy.id))


class HireLeadDeps:
    """The collaborators every Hire Lead use case shares."""

    def __init__(
        self,
        projects: LeadProjects,
        candidacies: LeadCandidacies,
        accounts: HiringAccounts,
        conversations: ConversationRepository,
        open_conversation: OpenConversation,
        close_conversation: CloseConversation,
        events: ConversationEvents,
        clock: Clock,
        uow: UnitOfWork,
        new_id: Callable[[], UUID] = uuid4,
    ) -> None:
        self.projects = projects
        self.candidacies = candidacies
        self.accounts = accounts
        self.conversations = conversations
        self.open_conversation = open_conversation
        self.close_conversation = close_conversation
        self.events = events
        self.clock = clock
        self.uow = uow
        self.new_id = new_id

    def conversation_id(self, candidacy: LeadCandidacy) -> str | None:
        conversation = self.conversations.find_by_subject(subject_of(candidacy))
        return str(conversation.id) if conversation else None

    def view(self, candidacy: LeadCandidacy, actor: Actor) -> LeadCandidacyView:
        return LeadCandidacyView.of(candidacy, actor.account_id, self.conversation_id(candidacy))

    def announce(self, candidacy: LeadCandidacy) -> None:
        frame = lead_updated_frame(candidacy, self.conversation_id(candidacy))
        self.events.publish(candidacy.participant_ids, frame)

    def close_conversation_of(self, candidacy: LeadCandidacy, reason: str) -> None:
        conversation = self.conversations.find_by_subject(subject_of(candidacy))
        if conversation is not None:
            self.close_conversation.execute(conversation.id, reason)

    def load_for_participant(self, actor: Actor, candidacy_id: UUID, *, lock: bool = False) -> LeadCandidacy:
        candidacy = (self.candidacies.get_for_update if lock else self.candidacies.get)(candidacy_id)
        if candidacy is None or not candidacy.involves(actor.account_id):
            raise NotFoundError(CANDIDACY_NOT_FOUND)
        return candidacy


def _require(actor: Actor, role: Role, action: str) -> int:
    if actor.account_id is None or actor.role is not role:
        raise ForbiddenError(f"Only {role.value}s can {action}.")
    return actor.account_id


def _refuse_duplicate(existing: list[LeadCandidacy], *, applying: bool) -> None:
    active = [c for c in existing if c.is_active]
    if any(c.kind is LeadCandidacyKind.INVITATION for c in active):
        raise ConflictError(
            "You've already been invited to lead this project. Answer the invitation in its conversation."
            if applying
            else "This developer already has an invitation to lead this project."
        )
    if active:
        raise ConflictError(
            "You've already applied to lead this project."
            if applying
            else "This developer has already applied to lead this project. Talk in their conversation."
        )
    if applying and any(c.kind is LeadCandidacyKind.APPLICATION for c in existing):
        raise ConflictError("You can apply to lead a project once.")


class ApplyToLead:
    def __init__(self, deps: HireLeadDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, note: str | None = None) -> LeadCandidacyView:
        developer_id = _require(actor, Role.DEVELOPER, "apply to lead a project")
        with self._d.uow.atomic():
            project = self._d.projects.get(project_id)
            if project is None:
                raise NotFoundError(PROJECT_NOT_FOUND)
            _refuse_duplicate(self._d.candidacies.for_developer(project_id, developer_id), applying=True)
            candidacy = self._d.candidacies.add(
                LeadCandidacy.apply(self._d.new_id(), project, developer_id, note)
            )
            self._d.open_conversation.execute(subject_of(candidacy), list(candidacy.participant_ids))
            self._d.announce(candidacy)
            return self._d.view(candidacy, actor)


class InviteToLead:
    def __init__(self, deps: HireLeadDeps) -> None:
        self._d = deps

    def execute(
        self, actor: Actor, project_id: int, developer_account_id: int, note: str | None = None
    ) -> LeadCandidacyView:
        client_id = _require(actor, Role.CLIENT, "invite a Team Lead")
        with self._d.uow.atomic():
            project = self._d.projects.get(project_id)
            if project is None or project.client_account_id != client_id:
                raise NotFoundError(PROJECT_NOT_FOUND)  # someone else's project looks missing
            if self._d.accounts.role_of(developer_account_id) is not Role.DEVELOPER:
                raise ValidationError(
                    "You can only invite a developer to lead.", {"developer_account_id": ["Not a developer."]}
                )
            existing = self._d.candidacies.for_developer(project_id, developer_account_id)
            _refuse_duplicate(existing, applying=False)
            candidacy = self._d.candidacies.add(
                LeadCandidacy.invite(self._d.new_id(), project, developer_account_id, note)
            )
            self._d.open_conversation.execute(subject_of(candidacy), list(candidacy.participant_ids))
            self._d.announce(candidacy)
            return self._d.view(candidacy, actor)


class _Answer:
    """Accept, decline or withdraw: the developer's own decision on one candidacy."""

    close_reason: str | None = None

    def __init__(self, deps: HireLeadDeps) -> None:
        self._d = deps

    def change(self, candidacy: LeadCandidacy, actor_id: int) -> LeadCandidacy:
        raise NotImplementedError

    def execute(self, actor: Actor, candidacy_id: UUID) -> LeadCandidacyView:
        with self._d.uow.atomic():
            candidacy = self._d.load_for_participant(actor, candidacy_id, lock=True)
            assert actor.account_id is not None
            # Once a Lead is hired every other candidacy is already closed, so
            # its state transition refuses a late answer on its own.
            changed = self.change(candidacy, actor.account_id)
            self._d.candidacies.save(changed)
            if self.close_reason:
                self._d.close_conversation_of(changed, self.close_reason)
            self._d.announce(changed)
            return self._d.view(changed, actor)


class AcceptLeadInvitation(_Answer):
    """Makes the developer a candidate. It does not hire them."""

    def change(self, candidacy: LeadCandidacy, actor_id: int) -> LeadCandidacy:
        return candidacy.accept(actor_id, self._d.clock.now())


class DeclineLeadInvitation(_Answer):
    close_reason = DECLINED_REASON

    def change(self, candidacy: LeadCandidacy, actor_id: int) -> LeadCandidacy:
        return candidacy.decline(actor_id, self._d.clock.now())


class WithdrawLeadApplication(_Answer):
    close_reason = WITHDRAWN_REASON

    def change(self, candidacy: LeadCandidacy, actor_id: int) -> LeadCandidacy:
        return candidacy.withdraw(actor_id, self._d.clock.now())


class HireTeamLead:
    """The client hires one candidate. Every other open candidacy for the project
    closes, with its conversation, saying another candidate was hired."""

    def __init__(self, deps: HireLeadDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, candidacy_id: UUID) -> LeadCandidacyView:
        with self._d.uow.atomic():
            found = self._d.load_for_participant(actor, candidacy_id)
            self._d.candidacies.lock_project(found.project_id)  # one hire at a time
            project = self._d.projects.get_for_update(found.project_id)
            if project is None:
                raise NotFoundError(PROJECT_NOT_FOUND)
            candidacy = self._d.load_for_participant(actor, candidacy_id)  # fresh, after the lock
            assert actor.account_id is not None
            if project.lead_account_id is not None or candidacy.status is LeadCandidacyStatus.CLOSED:
                raise LeadAlreadyHiredError()
            now = self._d.clock.now()
            hired = candidacy.hire(actor.account_id, now)
            self._d.candidacies.save(hired)
            self._d.projects.assign_lead(project.id, hired.developer_account_id)
            for other in self._d.candidacies.active_for_project(project.id):
                if other.id == hired.id:
                    continue
                closed = other.close_because_another_was_hired(now)
                self._d.candidacies.save(closed)
                self._d.close_conversation_of(closed, ANOTHER_HIRED)
                self._d.announce(closed)
            self._d.announce(hired)
            return self._d.view(hired, actor)


class GetLeadCandidacy:
    """One application or invitation, for its two people, with what the viewer may do."""

    def __init__(self, deps: HireLeadDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, candidacy_id: UUID) -> LeadCandidacyView:
        return self._d.view(self._d.load_for_participant(actor, candidacy_id), actor)
