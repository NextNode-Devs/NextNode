from __future__ import annotations

from dataclasses import dataclass

from nextnode.domain.hiring import LeadCandidacy, LeadCandidacyKind, LeadCandidacyStatus


@dataclass(frozen=True)
class LeadActions:
    """What the viewer may do now; the UI shows only these buttons."""

    accept: bool
    decline: bool
    withdraw: bool
    hire: bool


@dataclass(frozen=True)
class LeadCandidacyView:
    id: str
    project_id: int
    client_account_id: int
    developer_account_id: int
    kind: str
    status: str
    note: str
    conversation_id: str | None
    created_at: str | None
    decided_at: str | None
    actions: LeadActions

    @classmethod
    def of(
        cls, candidacy: LeadCandidacy, viewer_id: int | None, conversation_id: str | None
    ) -> LeadCandidacyView:
        return cls(
            id=str(candidacy.id),
            project_id=candidacy.project_id,
            client_account_id=candidacy.client_account_id,
            developer_account_id=candidacy.developer_account_id,
            kind=candidacy.kind.value,
            status=candidacy.status.value,
            note=candidacy.note,
            conversation_id=conversation_id,
            created_at=candidacy.created_at.isoformat() if candidacy.created_at else None,
            decided_at=candidacy.decided_at.isoformat() if candidacy.decided_at else None,
            actions=actions_for(candidacy, viewer_id),
        )


def actions_for(candidacy: LeadCandidacy, viewer_id: int | None) -> LeadActions:
    developer = viewer_id == candidacy.developer_account_id
    client = viewer_id == candidacy.client_account_id
    invited = candidacy.status is LeadCandidacyStatus.INVITED
    candidate = candidacy.status is LeadCandidacyStatus.CANDIDATE
    return LeadActions(
        accept=developer and invited,
        decline=developer and invited,
        withdraw=developer and candidate and candidacy.kind is LeadCandidacyKind.APPLICATION,
        hire=client and candidate,
    )


def lead_updated_frame(candidacy: LeadCandidacy, conversation_id: str | None) -> dict:
    """Both people refetch the candidacy on this; actions differ per viewer."""
    return {
        "type": "lead.updated",
        "candidacy_id": str(candidacy.id),
        "conversation_id": conversation_id,
        "status": candidacy.status.value,
    }
