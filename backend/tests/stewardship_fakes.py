"""In-memory fakes for the Assistant Lead and inactivity ports (NN-39)."""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, timedelta

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.ports import Actor
from nextnode.application.stewardship.use_cases import StewardshipDeps, StewardshipUseCases
from nextnode.domain.errors import ConflictError
from nextnode.domain.projects import ActivityCheck, Project, ProjectDetails, ProjectKind, ProjectStatus, Team
from tests.project_fakes import FixedClock, InMemoryProjects
from tests.team_fakes import CLIENT_ID, DEV_IDS, LEAD_ID, FakeEvents, FakeNames, FakeUnitOfWork


class FakeActivityChecks:
    def __init__(self) -> None:
        self.rows: list[ActivityCheck] = []

    def add(self, check: ActivityCheck) -> ActivityCheck:
        if any(c.project_id == check.project_id and c.is_pending for c in self.rows):
            raise ConflictError("Already asked.")
        stored = replace(check, id=len(self.rows) + 1)
        self.rows.append(stored)
        return stored

    def save(self, check: ActivityCheck) -> None:
        self.rows = [check if c.id == check.id else c for c in self.rows]

    def pending(self) -> list[ActivityCheck]:
        return [c for c in self.rows if c.is_pending]

    def latest_for(self, project_id: int) -> ActivityCheck | None:
        mine = [c for c in self.rows if c.project_id == project_id]
        return mine[-1] if mine else None


class FakeLeadActivity:
    """Projects with a workspace chat, and when their Lead last wrote in it."""

    def __init__(self, projects: InMemoryProjects) -> None:
        self.projects = projects
        self.last: dict[int, datetime] = {}

    def open_developer_projects(self) -> list[int]:
        return [
            pid
            for pid, (project, _) in self.projects.rows.items()
            if pid in self.last and project.kind is ProjectKind.DEVELOPER and project.is_open
        ]

    def last_active_at(self, project_id: int) -> datetime | None:
        return self.last.get(project_id)


def policy_over(projects: InMemoryProjects) -> AccessPolicy:
    """The real rules' meaning over the fake: the team reads; the Lead or Assistant Lead stewards."""

    def team(resource: ResourceRef) -> Team | None:
        row = projects.rows.get(int(resource.id))
        return row[1] if row else None

    def participant(actor: Actor, resource: ResourceRef) -> bool:
        found = team(resource)
        return found is not None and (found.is_lead(actor.account_id) or found.is_member(actor.account_id))

    def steward(actor: Actor, resource: ResourceRef) -> bool:
        found = team(resource)
        return found is not None and found.is_steward(actor.account_id)

    policy = AccessPolicy()
    policy.register("project_team", "read", participant)
    policy.register("project_team", "steward", steward)
    return policy


class StewardshipWorld:
    """A developer project led by ``LEAD_ID`` with three members, its workspace
    chat opened at the clock's start."""

    def __init__(self) -> None:
        self.clock = FixedClock()
        self.projects = InMemoryProjects()
        self.checks = FakeActivityChecks()
        self.activity = FakeLeadActivity(self.projects)
        self.events = FakeEvents()
        self.uc = StewardshipUseCases(
            StewardshipDeps(
                self.projects,
                self.checks,
                self.activity,
                FakeNames(),
                self.events,
                policy_over(self.projects),
                self.clock,
                FakeUnitOfWork(),
            )
        )

    def project(self, kind: ProjectKind = ProjectKind.DEVELOPER, members: int = 3) -> int:
        details = ProjectDetails("Habit tracker", "A small open-source habit tracker.", (), date(2027, 1, 1))
        owner = LEAD_ID if kind is ProjectKind.DEVELOPER else CLIENT_ID
        record = self.projects.add(Project.publish(kind, owner, details), Team.for_new_project(LEAD_ID))
        project_id = record.project.id
        assert project_id is not None
        for account_id in DEV_IDS[:members]:
            self.projects.add_member(project_id, account_id)
        self.start(project_id)
        return project_id

    def start(self, project_id: int) -> None:
        """What the start gate does: InProgress, and the workspace chat opens now."""
        project, team = self.projects.rows[project_id]
        self.projects.rows[project_id] = (replace(project, status=ProjectStatus.IN_PROGRESS), team)
        self.activity.last[project_id] = self.clock.now()

    def lead_writes(self, project_id: int) -> None:
        self.activity.last[project_id] = self.clock.now()

    def after(self, days: float) -> datetime:
        self.clock.advance(days=days)
        return self.clock.now()

    def team(self, project_id: int) -> Team:
        return self.projects.rows[project_id][1]

    def status(self, project_id: int) -> ProjectStatus:
        return self.projects.rows[project_id][0].status

    def run(self):
        return self.uc.run_activity_checks.execute()


ONE_SECOND = timedelta(seconds=1)
