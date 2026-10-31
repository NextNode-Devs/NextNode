"""Publishing and editing projects (#3).

A client publishes a brief; a developer publishes an idea and becomes its Team
Lead in the same transaction. Each role can create only its own kind (403).
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.accounts.ports import SkillRepository
from nextnode.application.conversations.ports import Clock
from nextnode.application.ports import Actor
from nextnode.application.projects.dto import ProjectView
from nextnode.application.projects.ports import ProjectRecord, ProjectRepository, UnitOfWork
from nextnode.domain.accounts import Role
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.projects import Project, ProjectDetails, ProjectKind, Team

PROJECT_NOT_FOUND = "We couldn't find that project."


@dataclass(frozen=True)
class ProjectCommand:
    title: str
    description: str
    tech_stack: list[str]
    target_delivery_date: date
    proposed_budget_cents: int | None = None


def require_role(actor: Actor, role: Role, action: str) -> int:
    if actor.account_id is None:
        raise ForbiddenError("Finish setting up your account first.")
    if actor.role is not role:
        raise ForbiddenError(f"Only {role.value}s can {action}.")
    return actor.account_id


class ProjectDeps:
    """The collaborators every project command shares."""

    def __init__(
        self,
        projects: ProjectRepository,
        skills: SkillRepository,
        policy: AccessPolicy,
        clock: Clock,
        uow: UnitOfWork,
    ) -> None:
        self.projects = projects
        self.skills = skills
        self.policy = policy
        self.clock = clock
        self.uow = uow

    def details(self, kind: ProjectKind, command: ProjectCommand) -> ProjectDetails:
        details = ProjectDetails.create(
            kind,
            title=command.title,
            description=command.description,
            tech_stack=command.tech_stack,
            target_delivery_date=command.target_delivery_date,
            proposed_budget_cents=command.proposed_budget_cents,
            today=self.clock.now().date(),
        )
        # A known skill keeps its first spelling, as on portfolios (#2).
        return replace(details, tech_stack=tuple(self.skills.upsert_many(list(details.tech_stack))))

    def view(self, record: ProjectRecord, actor: Actor) -> ProjectView:
        project_id = record.project.id
        assert project_id is not None
        readable = self.policy.allows(actor, "read", ResourceRef("project_document", project_id))
        return ProjectView.of(record, actor, can_read_documents=readable)


class PublishClientBrief:
    def __init__(self, deps: ProjectDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, command: ProjectCommand) -> ProjectView:
        client_id = require_role(actor, Role.CLIENT, "publish a project brief")
        with self._d.uow.atomic():
            details = self._d.details(ProjectKind.CLIENT, command)
            project = Project.publish(ProjectKind.CLIENT, client_id, details)
            record = self._d.projects.add(project, Team.for_new_project())
            return self._d.view(record, actor)


class ProposeProjectIdea:
    """The creating developer becomes the idea's Team Lead immediately."""

    def __init__(self, deps: ProjectDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, command: ProjectCommand) -> ProjectView:
        developer_id = require_role(actor, Role.DEVELOPER, "propose a project idea")
        with self._d.uow.atomic():
            details = self._d.details(ProjectKind.DEVELOPER, command)
            project = Project.publish(ProjectKind.DEVELOPER, developer_id, details)
            record = self._d.projects.add(project, Team.for_new_project(lead_account_id=developer_id))
            return self._d.view(record, actor)


class EditProject:
    """Only the owner, only while ``Posted`` and (client projects) before a Lead
    is hired; otherwise 409 with the reason."""

    def __init__(self, deps: ProjectDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, command: ProjectCommand) -> ProjectView:
        if actor.account_id is None:
            raise ForbiddenError("Finish setting up your account first.")
        with self._d.uow.atomic():
            record = self._d.projects.get_for_update(project_id)
            if record is None:
                raise NotFoundError(PROJECT_NOT_FOUND)
            project = record.project
            # Ownership and state are checked before the fields, so the reason
            # a non-owner or a locked project is refused is never a typo.
            project.edit(actor.account_id, project.details, has_lead=record.team.lead_account_id is not None)
            details = self._d.details(project.kind, command)
            edited = project.edit(actor.account_id, details, has_lead=record.team.lead_account_id is not None)
            return self._d.view(self._d.projects.save(edited), actor)
