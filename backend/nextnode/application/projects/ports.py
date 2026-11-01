"""What the project use cases (#3) need. Django adapters implement them; tests
use in-memory fakes."""

from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from nextnode.domain.projects import Project, ProjectKind, RequirementDocument, Team


@dataclass(frozen=True)
class ProjectRecord:
    """A project with its team and the names the pages show."""

    project: Project
    team: Team
    owner_name: str
    lead_name: str | None


@dataclass(frozen=True)
class ProjectQuery:
    kind: ProjectKind | None
    tech_keys: tuple[str, ...]  # a project must use every one of them
    needs_lead: bool
    open_spots: bool
    page: int  # 1-based


@dataclass(frozen=True)
class ProjectPage:
    records: list[ProjectRecord]
    total: int


class ProjectRepository(Protocol):
    def add(self, project: Project, team: Team) -> ProjectRecord:
        """Stores the project and its team together; returns them with ids."""
        ...

    def get(self, project_id: int) -> ProjectRecord | None: ...

    def get_for_update(self, project_id: int) -> ProjectRecord | None:
        """Locks the project and its team until the transaction ends."""
        ...

    def save(self, project: Project) -> ProjectRecord: ...

    def assign_lead(self, project_id: int, developer_account_id: int) -> None:
        """Stores ``Team.assign_lead``: the developer's approved Lead membership."""
        ...

    def save_team(self, team: Team) -> None:
        """Stores the team's size and status (#5, #6) and adds an approved membership for any new member."""
        ...

    def search(self, query: ProjectQuery, offset: int, limit: int) -> ProjectPage:
        """``Posted`` projects only, newest first then by id, so pages never overlap."""
        ...

    def owned_by(self, account_id: int) -> list[ProjectRecord]: ...

    def with_member(self, account_id: int) -> list[ProjectRecord]:
        """Projects the developer leads or is an approved member of."""
        ...


class DocumentRepository(Protocol):
    def add(self, document: RequirementDocument) -> RequirementDocument: ...

    def get(self, project_id: int, document_id: UUID) -> RequirementDocument | None: ...

    def for_project(self, project_id: int) -> list[RequirementDocument]: ...

    def count_for_project(self, project_id: int) -> int: ...


class FileStorage(Protocol):
    """Where document bytes live. Nothing serves this storage directly."""

    def save(self, key: str, content: bytes) -> None: ...

    def read(self, key: str) -> bytes: ...

    def delete(self, key: str) -> None:
        """Best effort; used to undo a save whose database row failed."""
        ...


@dataclass(frozen=True)
class FileGrant:
    """Who a download link was issued to, for which document, until when."""

    project_id: int
    document_id: UUID
    account_id: int
    expires_at: datetime


class InvalidLinkError(Exception):
    """The link was tampered with or is unreadable."""


class LinkSigner(Protocol):
    def sign(self, grant: FileGrant) -> str: ...

    def verify(self, token: str) -> FileGrant:
        """Checks the signature only (not expiry). Raises ``InvalidLinkError``."""
        ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]: ...
