"""What the Hire Devs use cases need. Teams are #3's ``ProjectRepository``,
accounts #1's ``AccountDirectory``, conversations #4's ``CandidacyConversations``."""

from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from nextnode.domain.teams import Candidacy


class CandidacyRepository(Protocol):
    def add(self, candidacy: Candidacy) -> Candidacy:
        """Raises ``DuplicateCandidacyError`` if the developer already has a
        pending candidacy for the project, or has already applied to it."""
        ...

    def get(self, candidacy_id: UUID) -> Candidacy | None: ...

    def save(self, candidacy: Candidacy) -> None: ...

    def find_pending(self, project_id: int, developer_account_id: int) -> Candidacy | None:
        """The developer's pending application or invitation for the project's team."""
        ...

    def has_applied(self, project_id: int, developer_account_id: int) -> bool:
        """Whether the developer ever applied, whatever became of it: once per team."""
        ...

    def pending_for_project(self, project_id: int) -> list[Candidacy]: ...

    def for_account(self, account_id: int) -> list[Candidacy]:
        """Every application and invitation the account is part of, newest first."""
        ...


@dataclass(frozen=True)
class TeamMemberRecord:
    account_id: int
    display_name: str
    role: str  # lead | member
    joined_at: datetime | None


class TeamMembers(Protocol):
    def for_project(self, project_id: int) -> list[TeamMemberRecord]:
        """The team's approved people, in the order they joined."""
        ...


class DeveloperAccounts(Protocol):
    def is_developer(self, clerk_user_id: str) -> bool:
        """True for an onboarded Developer account (#1)."""
        ...

    def is_developer_account(self, account_id: int) -> bool:
        """The same, for someone chosen by account id (a portfolio's owner)."""
        ...


class HiringConversations(Protocol):
    """#4's conversation module, used for team applications and invitations."""

    def open_for_candidacy(self, candidacy_id: UUID, lead_account_id: int, developer_account_id: int) -> None:
        """A conversation between the Team Lead and the developer."""
        ...

    def close_for_candidacy(self, candidacy_id: UUID, reason: str) -> None:
        """Makes the conversation read-only, showing ``reason``."""
        ...

    def conversation_id_for(self, candidacy_id: UUID) -> str | None: ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]:
        """Everything inside commits together or not at all."""
        ...
