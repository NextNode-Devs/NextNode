"""In-memory fakes for the Hire Lead ports, including a stand-in for #3's projects."""

from __future__ import annotations

from dataclasses import replace
from uuid import UUID

from nextnode.domain.accounts import Role
from nextnode.domain.errors import ConflictError
from nextnode.domain.hiring import LeadAlreadyHiredError, LeadCandidacy, LeadCandidacyStatus, LeadProject


class FakeLeadProjects:
    """Stands in for #3's Project + Team until they exist."""

    def __init__(self) -> None:
        self.projects: dict[int, LeadProject] = {}

    def put(self, project: LeadProject) -> None:
        self.projects[project.id] = project

    def get(self, project_id: int) -> LeadProject | None:
        return self.projects.get(project_id)

    get_for_update = get

    def assign_lead(self, project_id: int, developer_account_id: int) -> None:
        self.projects[project_id] = replace(self.projects[project_id], lead_account_id=developer_account_id)


class FakeCandidacies:
    def __init__(self, clock) -> None:
        self.rows: dict[UUID, LeadCandidacy] = {}
        self.clock = clock

    def add(self, candidacy: LeadCandidacy) -> LeadCandidacy:
        if self.for_developer(candidacy.project_id, candidacy.developer_account_id) and any(
            c.is_active for c in self.for_developer(candidacy.project_id, candidacy.developer_account_id)
        ):
            raise ConflictError("Already open.")
        stored = replace(candidacy, created_at=self.clock.now())
        self.rows[stored.id] = stored
        return stored

    def get(self, candidacy_id: UUID) -> LeadCandidacy | None:
        return self.rows.get(candidacy_id)

    get_for_update = get

    def save(self, candidacy: LeadCandidacy) -> None:
        hired = LeadCandidacyStatus.HIRED
        if candidacy.status is hired and any(
            c.status is hired and c.project_id == candidacy.project_id and c.id != candidacy.id
            for c in self.rows.values()
        ):
            raise LeadAlreadyHiredError()
        self.rows[candidacy.id] = candidacy

    def lock_project(self, project_id: int) -> None:
        pass

    def for_developer(self, project_id: int, developer_account_id: int) -> list[LeadCandidacy]:
        return [
            c
            for c in self.rows.values()
            if c.project_id == project_id and c.developer_account_id == developer_account_id
        ]

    def for_account(self, account_id: int) -> list[LeadCandidacy]:
        mine = [c for c in self.rows.values() if account_id in (c.client_account_id, c.developer_account_id)]
        return mine[::-1]  # newest first

    def for_project(self, project_id: int) -> list[LeadCandidacy]:
        return [c for c in self.rows.values() if c.project_id == project_id]

    def active_for_project(self, project_id: int) -> list[LeadCandidacy]:
        return [c for c in self.rows.values() if c.project_id == project_id and c.is_active]


class FakeHiringAccounts:
    def __init__(self, roles: dict[int, Role]) -> None:
        self.roles = roles

    def role_of(self, account_id: int) -> Role | None:
        return self.roles.get(account_id)
