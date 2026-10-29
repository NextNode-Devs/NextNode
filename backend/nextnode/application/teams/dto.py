"""What the Hire Devs use cases return. Never an entity or ORM model."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from nextnode.domain.teams import Candidacy, TeamRoster


@dataclass(frozen=True)
class RosterView:
    team_id: int
    project_id: int
    status: str
    team_size: int | None
    headcount: int
    developer_spots: int
    open_spots: int

    @classmethod
    def of(cls, roster: TeamRoster) -> RosterView:
        return cls(
            team_id=roster.team_id,
            project_id=roster.project_id,
            status=str(roster.status),
            team_size=roster.team_size,
            headcount=roster.headcount,
            developer_spots=roster.developer_spots,
            open_spots=roster.open_spots,
        )


@dataclass(frozen=True)
class CandidacyView:
    id: str
    team_id: int
    kind: str
    developer_user_id: str
    status: str
    closed_reason: str | None

    @classmethod
    def of(cls, candidacy: Candidacy) -> CandidacyView:
        return cls(
            id=str(candidacy.id),
            team_id=candidacy.team_id,
            kind=str(candidacy.kind),
            developer_user_id=candidacy.developer_user_id,
            status=str(candidacy.status),
            closed_reason=candidacy.closed_reason,
        )


@dataclass(frozen=True)
class RosterUpdate:
    """A roster change, and the candidacies it closed because the team filled up."""

    roster: RosterView
    closed_candidacy_ids: tuple[str, ...]

    @classmethod
    def of(cls, roster: TeamRoster, closed: Iterable[Candidacy]) -> RosterUpdate:
        return cls(RosterView.of(roster), tuple(str(c.id) for c in closed))


@dataclass(frozen=True)
class MembershipResult:
    candidacy: CandidacyView
    update: RosterUpdate
