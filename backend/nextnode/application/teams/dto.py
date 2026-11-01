"""What the Hire Devs use cases return, and the socket frame they publish."""

from __future__ import annotations

from dataclasses import dataclass

from nextnode.domain.teams import Candidacy, CandidacyKind, Team

TEAM_UPDATED = "team.updated"


@dataclass(frozen=True)
class RosterView:
    """A team's numbers, and the candidacies this change closed."""

    project_id: int
    size: int | None
    status: str
    headcount: int
    developer_spots: int
    open_spots: int
    closed_candidacy_ids: list[str]

    @classmethod
    def of(cls, project_id: int, team: Team, closed: list[Candidacy]) -> RosterView:
        return cls(
            project_id=project_id,
            size=team.team_size,
            status=team.status.value,
            headcount=team.headcount,
            developer_spots=team.developer_spots,
            open_spots=team.open_spots,
            closed_candidacy_ids=[str(candidacy.id) for candidacy in closed],
        )


@dataclass(frozen=True)
class CandidacyActions:
    """What the viewer may do now; the UI shows only these buttons."""

    accept: bool
    reject: bool
    withdraw: bool
    decline: bool


@dataclass(frozen=True)
class CandidacyView:
    id: str
    project_id: int
    lead_account_id: int
    developer_account_id: int
    kind: str
    status: str
    closed_reason: str
    conversation_id: str | None
    created_at: str | None
    decided_at: str | None
    actions: CandidacyActions

    @classmethod
    def of(cls, candidacy: Candidacy, viewer_id: int | None, conversation_id: str | None) -> CandidacyView:
        return cls(
            id=str(candidacy.id),
            project_id=candidacy.project_id,
            lead_account_id=candidacy.lead_account_id,
            developer_account_id=candidacy.developer_account_id,
            kind=candidacy.kind.value,
            status=candidacy.status.value,
            closed_reason=candidacy.closed_reason,
            conversation_id=conversation_id,
            created_at=candidacy.created_at.isoformat() if candidacy.created_at else None,
            decided_at=candidacy.decided_at.isoformat() if candidacy.decided_at else None,
            actions=actions_for(candidacy, viewer_id),
        )


def actions_for(candidacy: Candidacy, viewer_id: int | None) -> CandidacyActions:
    developer = candidacy.is_pending and viewer_id == candidacy.developer_account_id
    lead = candidacy.is_pending and viewer_id == candidacy.lead_account_id
    application = candidacy.kind is CandidacyKind.APPLICATION
    return CandidacyActions(
        accept=lead if application else developer,
        reject=lead and application,
        withdraw=developer and application,
        decline=developer and not application,
    )


def team_updated_frame(candidacy: Candidacy, conversation_id: str | None) -> dict:
    """Both people refetch on this; what each may do differs."""
    return {
        "type": TEAM_UPDATED,
        "project_id": candidacy.project_id,
        "candidacy_id": str(candidacy.id),
        "conversation_id": conversation_id,
        "status": candidacy.status.value,
    }
