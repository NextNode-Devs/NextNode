"""What the milestone review use cases return (A2, #176). The shapes are the
frontend's ``Milestone`` and ``MilestoneReview`` (``entities/milestone``)."""

from __future__ import annotations

from dataclasses import dataclass

from nextnode.application.start_gate.dto import MilestoneView
from nextnode.domain.milestones import MilestoneReview


@dataclass(frozen=True)
class ReviewView:
    id: int
    milestone_id: int
    kind: str  # submitted | revision_requested | approved
    note: str
    link_url: str | None
    author_name: str
    author_role: str  # client | lead
    created_at: str

    @classmethod
    def of(cls, review: MilestoneReview, names: dict[int, str]) -> ReviewView:
        assert review.id is not None
        return cls(
            id=review.id,
            milestone_id=review.milestone_id,
            kind=review.kind.value,
            note=review.note,
            link_url=review.link_url,
            author_name=names.get(review.author_account_id, ""),
            author_role=review.author_role.value,
            created_at=review.created_at.isoformat(),
        )


@dataclass(frozen=True)
class MilestoneBoardView:
    """``GET /api/projects/{id}/milestones/reviews/`` and every action's answer:
    the milestones as stored now, what the viewer may do on each, and the history."""

    project_id: int
    viewer_role: str  # client | lead | member
    milestones: list[MilestoneView]
    actions: dict[int, list[str]]  # milestone id -> submit | approve | request_revision
    reviews: list[ReviewView]  # oldest first
