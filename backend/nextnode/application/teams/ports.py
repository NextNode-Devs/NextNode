"""Hire Devs ports. The adapters come from the issues that own the data:
#3 (teams and projects), #1 (accounts and roles), #4 (hiring conversations).
Tests use in-memory fakes."""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Protocol
from uuid import UUID

from nextnode.domain.teams import Candidacy, TeamRoster


class TeamRosterRepository(Protocol):
    def get_for_update(self, team_id: int) -> TeamRoster | None:
        """Locks the team until the transaction ends. Every change to a team's
        roster or candidacies happens under this lock, so spots fill one at a
        time and can never be over-filled."""
        ...

    def save(self, roster: TeamRoster) -> None: ...


class CandidacyRepository(Protocol):
    def get(self, candidacy_id: UUID) -> Candidacy | None: ...

    def find_pending(self, team_id: int, developer_user_id: str) -> Candidacy | None:
        """The developer's pending application or invitation for the team."""
        ...

    def pending_for_team(self, team_id: int) -> list[Candidacy]: ...

    def save(self, candidacy: Candidacy) -> None: ...


class DeveloperAccounts(Protocol):
    def is_developer(self, clerk_user_id: str) -> bool:
        """True for an onboarded Developer account (#1); False for a client,
        an unknown user or one who has not chosen a role yet."""
        ...


class HiringConversations(Protocol):
    """#4's conversation module, used for team applications and invitations."""

    def open_for_candidacy(
        self, candidacy_id: UUID, team_id: int, lead_user_id: str, developer_user_id: str
    ) -> None:
        """A conversation between the Team Lead and the developer."""
        ...

    def close_for_candidacy(self, candidacy_id: UUID, reason: str) -> None:
        """Makes the conversation read-only, showing ``reason``."""
        ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]:
        """Everything inside commits together or not at all."""
        ...
