"""What the Assistant Lead and inactivity use cases (NN-39) need. Projects and
teams are #3's ``ProjectRepository``; live updates go through #4's ``ConversationEvents``."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from nextnode.domain.projects import ActivityCheck


class ActivityChecks(Protocol):
    def add(self, check: ActivityCheck) -> ActivityCheck:
        """Raises ``ConflictError`` if the project already has a pending check."""
        ...

    def save(self, check: ActivityCheck) -> None: ...

    def pending(self) -> list[ActivityCheck]:
        """Every check still waiting for an answer, oldest first."""
        ...

    def latest_for(self, project_id: int) -> ActivityCheck | None:
        """The project's most recent check, pending or ended."""
        ...


class LeadActivity(Protocol):
    def open_developer_projects(self) -> list[int]:
        """Developer projects still ``Posted`` or ``InProgress`` whose workspace chat is open."""
        ...

    def last_active_at(self, project_id: int) -> datetime | None:
        """The Lead's latest message in the project's workspace chat, else when
        the chat opened; ``None`` while the project has no workspace chat."""
        ...
