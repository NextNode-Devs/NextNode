"""Applications to join a team and the Team Lead's invitations (Workflow B).

An application becomes membership when the Team Lead accepts it; an
invitation only when the invited developer accepts it. Both are Hire Devs
records, never the Hire Lead ones (#4).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from nextnode.domain.errors import ForbiddenError
from nextnode.domain.teams.errors import CandidacyClosedError
from nextnode.domain.teams.roster import TeamRoster

TEAM_FULL_REASON = "The team is full"


class CandidacyKind(StrEnum):
    APPLICATION = "application"  # the developer asked; the Team Lead accepts
    INVITATION = "invitation"  # the Team Lead asked; the developer accepts


class CandidacyStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    CLOSED = "closed"


@dataclass
class Candidacy:
    id: UUID
    team_id: int
    kind: CandidacyKind
    developer_user_id: str
    status: CandidacyStatus = CandidacyStatus.PENDING
    closed_reason: str | None = None

    @property
    def is_pending(self) -> bool:
        return self.status is CandidacyStatus.PENDING

    def ensure_pending(self) -> None:
        if self.status is CandidacyStatus.ACCEPTED:
            raise CandidacyClosedError(f"This {self.kind} was already accepted.")
        if self.status is CandidacyStatus.CLOSED:
            raise CandidacyClosedError(f"This {self.kind} is closed: {self.closed_reason}.")

    def ensure_can_accept(self, roster: TeamRoster, user_id: str) -> None:
        """Only the side that did not ask may accept."""
        if self.kind is CandidacyKind.APPLICATION and user_id != roster.lead_user_id:
            raise ForbiddenError("Only the Team Lead can accept an application to join the team.")
        if self.kind is CandidacyKind.INVITATION and user_id != self.developer_user_id:
            raise ForbiddenError("Only the invited developer can accept this invitation.")

    def close(self, reason: str) -> None:
        self.ensure_pending()
        self.status = CandidacyStatus.CLOSED
        self.closed_reason = reason


def accept(candidacy: Candidacy, roster: TeamRoster, accepted_by: str) -> None:
    """Turns a pending candidacy into membership, taking one open spot."""
    candidacy.ensure_pending()
    candidacy.ensure_can_accept(roster, accepted_by)
    roster.add_member(candidacy.developer_user_id)
    candidacy.status = CandidacyStatus.ACCEPTED


def close_pending_if_full(roster: TeamRoster, candidacies: Iterable[Candidacy]) -> list[Candidacy]:
    """Once every spot is filled, the other pending applications and
    invitations close. Returns the ones it closed."""
    if not roster.is_full:
        return []
    closed = [c for c in candidacies if c.team_id == roster.team_id and c.is_pending]
    for candidacy in closed:
        candidacy.close(TEAM_FULL_REASON)
    return closed
