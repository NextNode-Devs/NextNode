"""What the Hire Lead use cases need. ``LeadProjects`` is #3's to implement."""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Protocol
from uuid import UUID

from nextnode.domain.accounts import Role
from nextnode.domain.hiring import LeadCandidacy, LeadProject


class LeadProjects(Protocol):
    """#3's projects and teams, as Hire Lead sees them."""

    def get(self, project_id: int) -> LeadProject | None: ...

    def get_for_update(self, project_id: int) -> LeadProject | None:
        """Locks the project's team until the transaction ends (one hire at a time)."""
        ...

    def assign_lead(self, project_id: int, developer_account_id: int) -> None:
        """``Team.assign_lead``: the developer becomes the project's Team Lead."""
        ...


class LeadCandidacies(Protocol):
    def add(self, candidacy: LeadCandidacy) -> LeadCandidacy:
        """Raises ``ConflictError`` if the developer already has an open candidacy for the project."""
        ...

    def get(self, candidacy_id: UUID) -> LeadCandidacy | None: ...

    def get_for_update(self, candidacy_id: UUID) -> LeadCandidacy | None: ...

    def save(self, candidacy: LeadCandidacy) -> None:
        """Raises ``LeadAlreadyHiredError`` if a second hire for the project would be stored."""
        ...

    def lock_project(self, project_id: int) -> None:
        """Serialises hiring decisions for one project: locks its candidacies in a fixed
        order, so two simultaneous hires wait for each other instead of deadlocking."""
        ...

    def for_developer(self, project_id: int, developer_account_id: int) -> list[LeadCandidacy]: ...

    def for_account(self, account_id: int) -> list[LeadCandidacy]:
        """Every application and invitation the account is part of (as client or developer)."""
        ...

    def for_project(self, project_id: int) -> list[LeadCandidacy]:
        """Every application and invitation for the project, oldest first."""
        ...

    def active_for_project(self, project_id: int) -> list[LeadCandidacy]: ...


class HiringAccounts(Protocol):
    def role_of(self, account_id: int) -> Role | None: ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]: ...
