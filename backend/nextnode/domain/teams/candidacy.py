"""Applications to join a team and the Team Lead's invitations (Workflow B).

An application becomes membership when the Team Lead accepts it; an invitation
only when the invited developer accepts it. Both are Hire Devs records, never
the Hire Lead ones (#4). The team itself is ``domain/projects/team.py``.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from nextnode.domain.errors import ForbiddenError, InvalidStateTransitionError
from nextnode.domain.projects.team import Team

TEAM_FULL_REASON = "The team is full"
REJECTED_REASON = "The Team Lead turned down this application"
WITHDRAWN_REASON = "The developer withdrew their application"
DECLINED_REASON = "The developer declined the invitation"


class CandidacyClosedError(InvalidStateTransitionError):
    """The application or invitation was already decided or closed."""

    code = "CANDIDACY_CLOSED"


class CandidacyKind(StrEnum):
    APPLICATION = "application"  # the developer asked; the Team Lead accepts
    INVITATION = "invitation"  # the Team Lead asked; the developer accepts


class CandidacyStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"  # the Team Lead turned down the application
    WITHDRAWN = "withdrawn"  # the developer withdrew the application
    DECLINED = "declined"  # the developer declined the invitation
    CLOSED = "closed"  # the team filled up or recruitment closed


@dataclass(frozen=True)
class Candidacy:
    id: UUID
    project_id: int
    lead_account_id: int
    developer_account_id: int
    kind: CandidacyKind
    status: CandidacyStatus = CandidacyStatus.PENDING
    closed_reason: str = ""
    created_at: datetime | None = None
    decided_at: datetime | None = None

    @property
    def is_pending(self) -> bool:
        return self.status is CandidacyStatus.PENDING

    @property
    def participant_ids(self) -> tuple[int, int]:
        return (self.lead_account_id, self.developer_account_id)

    def involves(self, account_id: int | None) -> bool:
        return account_id is not None and account_id in self.participant_ids

    def accept(self, team: Team, actor_id: int, at: datetime) -> tuple[Candidacy, Team]:
        """Turns a pending candidacy into membership, taking one open spot. Only
        the side that did not ask may accept."""
        self._ensure_pending()
        if self.kind is CandidacyKind.APPLICATION and actor_id != team.lead_account_id:
            raise ForbiddenError("Only the Team Lead can accept an application to join the team.")
        if self.kind is CandidacyKind.INVITATION and actor_id != self.developer_account_id:
            raise ForbiddenError("Only the invited developer can accept this invitation.")
        joined = team.with_member(self.developer_account_id)
        return replace(self, status=CandidacyStatus.ACCEPTED, decided_at=at), joined

    def reject(self, actor_id: int, at: datetime) -> Candidacy:
        if actor_id != self.lead_account_id:
            raise ForbiddenError("Only the Team Lead can reject an application to join the team.")
        return self._end(CandidacyStatus.REJECTED, REJECTED_REASON, at)

    def withdraw(self, actor_id: int, at: datetime) -> Candidacy:
        if actor_id != self.developer_account_id:
            raise ForbiddenError("Only the developer can withdraw this application.")
        return self._end(CandidacyStatus.WITHDRAWN, WITHDRAWN_REASON, at)

    def decline(self, actor_id: int, at: datetime) -> Candidacy:
        if actor_id != self.developer_account_id:
            raise ForbiddenError("Only the invited developer can decline this invitation.")
        return self._end(CandidacyStatus.DECLINED, DECLINED_REASON, at)

    def close(self, reason: str, at: datetime) -> Candidacy:
        return self._end(CandidacyStatus.CLOSED, reason, at)

    def _end(self, status: CandidacyStatus, reason: str, at: datetime) -> Candidacy:
        self._ensure_pending()
        return replace(self, status=status, closed_reason=reason, decided_at=at)

    def _ensure_pending(self) -> None:
        if self.status is CandidacyStatus.ACCEPTED:
            raise CandidacyClosedError(f"This {self.kind} was already accepted.")
        if not self.is_pending:
            raise CandidacyClosedError(f"This {self.kind} is closed: {self.closed_reason}.")


def close_all(candidacies: Iterable[Candidacy], reason: str, at: datetime) -> list[Candidacy]:
    """Closes the pending ones, because the team filled up or recruitment closed."""
    return [candidacy.close(reason, at) for candidacy in candidacies if candidacy.is_pending]
