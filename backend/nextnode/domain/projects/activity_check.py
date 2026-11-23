"""Inactivity on developer projects (NN-39; Phase 2 decisions, 17 Nov 2026).

When a developer project's Team Lead has not written in the project chat for
``LEAD_INACTIVE_DAYS``, NextNode asks the members "Is this project still
active?" and hides the project from the open-projects feed while it waits. The
first member to confirm becomes Assistant Lead (if there is none yet). If
nobody answers within ``ANSWER_DAYS``, the project is closed. Client projects
are never checked.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from enum import StrEnum

from nextnode.domain.errors import ConflictError, ForbiddenError
from nextnode.domain.projects.team import Team

LEAD_INACTIVE_DAYS = 30
ANSWER_DAYS = 7

QUESTION = "Is this project still active?"


class ActivityCheckStatus(StrEnum):
    PENDING = "pending"  # waiting for a member to answer
    CONFIRMED = "confirmed"  # a member said it is still active
    LEAD_RETURNED = "lead_returned"  # the Lead wrote in the chat, or answered themselves
    CLOSED = "closed"  # nobody answered in time, or the project was closed meanwhile


def inactive_since(last_active_at: datetime, now: datetime) -> bool:
    """Whether the Lead has been silent for the whole threshold."""
    return now - last_active_at >= timedelta(days=LEAD_INACTIVE_DAYS)


@dataclass(frozen=True)
class ActivityCheck:
    id: int | None
    project_id: int
    status: ActivityCheckStatus
    started_at: datetime
    answer_by: datetime
    ended_at: datetime | None = None
    answered_by_account_id: int | None = None

    @classmethod
    def ask(cls, project_id: int, now: datetime) -> ActivityCheck:
        return cls(
            id=None,
            project_id=project_id,
            status=ActivityCheckStatus.PENDING,
            started_at=now,
            answer_by=now + timedelta(days=ANSWER_DAYS),
        )

    @property
    def is_pending(self) -> bool:
        return self.status is ActivityCheckStatus.PENDING

    def is_overdue(self, now: datetime) -> bool:
        return self.is_pending and now >= self.answer_by

    def confirm(self, team: Team, account_id: int, now: datetime) -> ActivityCheck:
        """A member (or the Lead) answers "yes, still active" before the deadline."""
        self._ensure_open(now)
        if team.is_lead(account_id):
            return self._end(ActivityCheckStatus.LEAD_RETURNED, now, account_id)
        if not team.is_member(account_id):
            raise ForbiddenError("Only this project's team can answer.")
        return self._end(ActivityCheckStatus.CONFIRMED, now, account_id)

    def lead_returned(self, now: datetime) -> ActivityCheck:
        return self._end(ActivityCheckStatus.LEAD_RETURNED, now, None)

    def expire(self, now: datetime) -> ActivityCheck:
        """Nobody answered within ``ANSWER_DAYS``: the project is closed."""
        if not self.is_overdue(now):
            raise ConflictError("Members still have time to answer.")
        return self._end(ActivityCheckStatus.CLOSED, now, None)

    def cancel(self, now: datetime) -> ActivityCheck:
        """The project was closed by its Lead or Assistant Lead while waiting."""
        return self._end(ActivityCheckStatus.CLOSED, now, None)

    def _ensure_open(self, now: datetime) -> None:
        if not self.is_pending:
            raise ConflictError("This activity check has already been answered.")
        if now >= self.answer_by:
            raise ConflictError("The time to answer has passed.")

    def _end(self, status: ActivityCheckStatus, now: datetime, account_id: int | None) -> ActivityCheck:
        if not self.is_pending:
            raise ConflictError("This activity check has already ended.")
        return replace(self, status=status, ended_at=now, answered_by_account_id=account_id)
