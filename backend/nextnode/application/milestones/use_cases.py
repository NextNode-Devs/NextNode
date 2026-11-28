"""Milestone delivery and client review (A2, #176).

Each action locks the project (and its team) first, then the milestones, the
same order as every start-gate action, so two reviews never interleave. Only
a project in progress has milestones to work on. The other side is notified.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from nextnode.application.conversations.ports import AccountNames, Clock
from nextnode.application.milestones.dto import MilestoneBoardView, ReviewView
from nextnode.application.milestones.ports import MilestoneStore
from nextnode.application.ports import Actor, Notification, NotificationCategory, NotificationSender
from nextnode.application.projects.ports import ProjectRecord, ProjectRepository, UnitOfWork
from nextnode.application.start_gate.dto import MilestoneView
from nextnode.domain import milestones as loop
from nextnode.domain.errors import ConflictError, ForbiddenError, NotFoundError
from nextnode.domain.milestones import MilestoneReview
from nextnode.domain.projects import ProjectStatus
from nextnode.domain.start_gate import MilestoneStatus, PlannedMilestone

NOT_FOUND = "We couldn't find that milestone."
SUBMIT, APPROVE, REVISE = "submit", "approve", "request_revision"


@dataclass(frozen=True)
class MilestoneDeps:
    projects: ProjectRepository
    store: MilestoneStore
    names: AccountNames
    notifications: NotificationSender
    clock: Clock
    uow: UnitOfWork


def role_of(record: ProjectRecord, actor: Actor) -> str | None:
    if record.team.is_lead(actor.account_id):
        return "lead"
    if record.team.is_member(actor.account_id):
        return "member"
    if record.project.is_client_project and actor.account_id == record.project.owner_account_id:
        return "client"
    return None


def _actions(milestone: PlannedMilestone, role: str) -> list[str]:
    if role == "lead" and milestone.status is MilestoneStatus.IN_PROGRESS:
        return [SUBMIT]
    if role == "client" and milestone.status is MilestoneStatus.UNDER_REVIEW:
        return [APPROVE, REVISE]
    return []


def board(d: MilestoneDeps, record: ProjectRecord, role: str) -> MilestoneBoardView:
    project_id = record.project.id
    assert project_id is not None
    plan = d.store.accepted_plan(project_id)
    reviews = d.store.reviews(project_id)
    names = d.names.names(sorted({r.author_account_id for r in reviews}))
    return MilestoneBoardView(
        project_id=project_id,
        viewer_role=role,
        milestones=[MilestoneView.of(m, project_id) for m in plan],
        actions={m.id: _actions(m, role) for m in plan if m.id is not None},
        reviews=[ReviewView.of(r, names) for r in reviews],
    )


class GetMilestoneBoard:
    """The milestones, what the viewer may do and the review history (client, Lead, members)."""

    def __init__(self, deps: MilestoneDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> MilestoneBoardView:
        record = self._d.projects.get(project_id)
        role = role_of(record, actor) if record else None
        if record is None or role is None:
            raise NotFoundError("We couldn't find that project.")
        return board(self._d, record, role)


class BeginMilestones:
    """The start gate's hook (#6): when a client project starts on a confirmed
    deposit, milestone 1 is in progress and the rest are not started."""

    def __init__(self, store: MilestoneStore) -> None:
        self._store = store

    def begin(self, project_id: int) -> None:
        plan = self._store.accepted_plan(project_id, lock=True)
        started = loop.begin_work(plan)
        if started != plan:
            self._store.save(started)


class _Review:
    """Shared by the three actions: find the milestone, check the viewer and
    the project, apply one step, store it with its review, notify, answer."""

    role = ""  # who may take this step: lead | client
    refused = ""  # told to anyone else on the project

    def __init__(self, deps: MilestoneDeps) -> None:
        self._d = deps

    def _run(self, actor: Actor, milestone_id: int, note: str, link: str | None) -> MilestoneBoardView:
        d = self._d
        with d.uow.atomic():
            project_id = d.store.project_of(milestone_id)
            record = d.projects.get_for_update(project_id) if project_id is not None else None
            role = role_of(record, actor) if record else None
            if record is None or role is None:
                raise NotFoundError(NOT_FOUND)
            assert project_id is not None and actor.account_id is not None
            if role != self.role:
                raise ForbiddenError(self.refused)
            if record.project.status is not ProjectStatus.IN_PROGRESS:
                raise ConflictError("Milestones can be worked on once the project has started.")
            plan = d.store.accepted_plan(project_id, lock=True)
            milestone = next((m for m in plan if m.id == milestone_id), None)
            if milestone is None:
                raise NotFoundError(NOT_FOUND)
            now = d.clock.now()
            changed, review = self._step(milestone, actor.account_id, note, link, now)
            plan = [changed if m.id == milestone_id else m for m in plan]
            if changed.status is MilestoneStatus.COMPLETED:
                plan = loop.start_next(plan)
            d.store.save(plan)
            stored = d.store.add_review(review)
            self._notify(record, changed, stored)
            return board(d, d.projects.get(project_id) or record, role)

    def _step(
        self, milestone: PlannedMilestone, actor_id: int, note: str, link: str | None, at: datetime
    ) -> tuple[PlannedMilestone, MilestoneReview]:
        raise NotImplementedError

    def _notify(self, record: ProjectRecord, milestone: PlannedMilestone, review: MilestoneReview) -> None:
        project_id = record.project.id
        title = record.project.details.title
        if review.author_role is loop.ReviewAuthor.LEAD:
            recipients = [record.project.owner_account_id]
            heading, body = "Ready for your check", f"Milestone {milestone.sequence} of {title} is ready."
        else:
            recipients = [record.team.lead_account_id] if record.team.lead_account_id else []
            done = review.kind is loop.ReviewKind.APPROVED
            heading = "Milestone approved" if done else "Changes requested"
            body = (
                f"The client {'approved' if done else 'asked for changes to'} milestone {milestone.sequence}."
            )
        for recipient in recipients:
            self._d.notifications.send(
                Notification(
                    recipient,
                    NotificationCategory.PROJECTS,
                    f"milestone_{review.kind.value}",
                    heading,
                    body,
                    f"/projects/{project_id}/milestones",
                )
            )


class SubmitMilestone(_Review):
    """The Team Lead submits a milestone in progress for the client's check."""

    role, refused = "lead", "Only the Team Lead submits milestone work."

    def execute(self, actor: Actor, milestone_id: int, note: str, link: str | None) -> MilestoneBoardView:
        return self._run(actor, milestone_id, note, link)

    def _step(self, milestone, actor_id, note, link, at):
        return loop.submit(milestone, actor_id, note, link, at)


class ApproveMilestone(_Review):
    """The client approves a milestone waiting for their check; the next one starts."""

    role, refused = "client", "Only the client approves milestone work."

    def execute(self, actor: Actor, milestone_id: int, note: str = "") -> MilestoneBoardView:
        return self._run(actor, milestone_id, note, None)

    def _step(self, milestone, actor_id, note, link, at):
        return loop.approve(milestone, actor_id, note, at)


class RequestRevision(_Review):
    """The client sends a milestone back to the team, saying what to change."""

    role, refused = "client", "Only the client can ask for changes to milestone work."

    def execute(self, actor: Actor, milestone_id: int, note: str) -> MilestoneBoardView:
        return self._run(actor, milestone_id, note, None)

    def _step(self, milestone, actor_id, note, link, at):
        return loop.request_revision(milestone, actor_id, note, at)


class MilestoneUseCases:
    def __init__(self, deps: MilestoneDeps) -> None:
        self.board = GetMilestoneBoard(deps)
        self.submit = SubmitMilestone(deps)
        self.approve = ApproveMilestone(deps)
        self.request_revision = RequestRevision(deps)
        self.begin = BeginMilestones(deps.store)
