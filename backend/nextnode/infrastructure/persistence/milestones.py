"""Django adapter for A2's ``MilestoneStore`` (#176). ORM models never leave this module."""

from __future__ import annotations

from nextnode.domain.milestones import MilestoneReview, ReviewAuthor, ReviewKind
from nextnode.domain.start_gate import MilestoneStatus, PlannedMilestone
from nextnode.infrastructure.persistence.milestone_models import MilestoneModel, MilestoneReviewModel
from nextnode.infrastructure.persistence.start_gate_models import OfferModel


def _to_milestone(row: MilestoneModel) -> PlannedMilestone:
    return PlannedMilestone(
        sequence=row.sequence,
        title=row.title,
        description=row.description,
        amount_cents=row.amount_cents,
        due_date=row.due_date,
        status=MilestoneStatus(row.status),
        id=row.id,
        submitted_at=row.submitted_at,
        approved_at=row.approved_at,
    )


def _to_review(row: MilestoneReviewModel) -> MilestoneReview:
    return MilestoneReview(
        milestone_id=row.milestone_id,
        kind=ReviewKind(row.kind),
        note=row.note,
        link_url=row.link_url or None,
        author_account_id=row.author_id,
        author_role=ReviewAuthor(row.author_role),
        created_at=row.created_at,
        id=row.id,
    )


def _accepted(project_id: int):
    return MilestoneModel.objects.filter(
        offer__project_id=project_id,
        offer__status=OfferModel.Status.ACCEPTED,
        offer__project__deleted_at__isnull=True,
    )


class DjangoMilestoneStore:
    def project_of(self, milestone_id: int) -> int | None:
        return (
            MilestoneModel.objects.filter(pk=milestone_id, offer__project__deleted_at__isnull=True)
            .values_list("offer__project_id", flat=True)
            .first()
        )

    def accepted_plan(self, project_id: int, *, lock: bool = False) -> list[PlannedMilestone]:
        rows = _accepted(project_id).order_by("sequence")
        if lock:
            rows = rows.select_for_update(of=("self",))
        return [_to_milestone(row) for row in rows]

    def save(self, milestones: list[PlannedMilestone]) -> None:
        for m in milestones:
            MilestoneModel.objects.filter(pk=m.id).update(
                status=m.status.value, submitted_at=m.submitted_at, approved_at=m.approved_at
            )

    def add_review(self, review: MilestoneReview) -> MilestoneReview:
        row = MilestoneReviewModel.objects.create(
            milestone_id=review.milestone_id,
            kind=review.kind.value,
            note=review.note,
            link_url=review.link_url or "",
            author_id=review.author_account_id,
            author_role=review.author_role.value,
            created_at=review.created_at,
        )
        return _to_review(row)

    def reviews(self, project_id: int) -> list[MilestoneReview]:
        rows = MilestoneReviewModel.objects.filter(
            milestone__offer__project_id=project_id, milestone__offer__status=OfferModel.Status.ACCEPTED
        ).order_by("created_at", "id")
        return [_to_review(row) for row in rows]
