"""Django adapters for the start-gate ports (#6) and for #7's
``DepositTermsSource``. ORM models never leave this module."""

from __future__ import annotations

from django.db import IntegrityError, transaction

from nextnode.application.payments.ports import DepositTerms
from nextnode.domain.errors import InvalidStateTransitionError
from nextnode.domain.start_gate import (
    FinalisedTimeline,
    MilestonePlan,
    MilestoneStatus,
    Offer,
    OfferOpenError,
    OfferStatus,
    OfferTerms,
    PlannedMilestone,
    Timeline,
)
from nextnode.infrastructure.persistence.milestone_models import MilestoneModel
from nextnode.infrastructure.persistence.models import ProjectModel, TeamModel
from nextnode.infrastructure.persistence.start_gate_models import OfferModel, ProjectTimelineModel


def _to_plan(row: OfferModel) -> MilestonePlan | None:
    if row.deposit_percent is None:
        return None
    milestones = tuple(
        PlannedMilestone(
            sequence=m.sequence,
            title=m.title,
            description=m.description,
            amount_cents=m.amount_cents,
            due_date=m.due_date,
            status=MilestoneStatus(m.status),
            id=m.id,
        )
        for m in sorted(row.milestones.all(), key=lambda m: m.sequence)
    )
    return MilestonePlan(row.deposit_percent, milestones)


def _offers():
    return OfferModel.objects.prefetch_related("milestones")


def _to_offer(row: OfferModel) -> Offer:
    return Offer(
        id=row.id,
        project_id=row.project_id,
        version=row.version,
        terms=OfferTerms(row.summary, row.total_cents, Timeline(row.start_date, row.delivery_date)),
        signed_by_account_id=row.signed_by_id,
        signed_at=row.signed_at,
        status=OfferStatus(row.status),
        decided_by_account_id=row.decided_by_id,
        decided_at=row.decided_at,
        decline_reason=row.decline_reason or None,
        plan=_to_plan(row),
        deposit_release_milestone=row.deposit_release_milestone,
    )


class DjangoOfferRepository:
    def add(self, offer: Offer) -> Offer:
        terms = offer.terms
        try:
            with transaction.atomic():
                row = OfferModel.objects.create(
                    project_id=offer.project_id,
                    version=offer.version,
                    summary=terms.summary,
                    total_cents=terms.total_cents,
                    start_date=terms.timeline.start_date,
                    delivery_date=terms.timeline.delivery_date,
                    signed_by_id=offer.signed_by_account_id,
                    signed_at=offer.signed_at,
                    deposit_percent=offer.plan.deposit_percent if offer.plan else None,
                )
                if offer.plan is not None:
                    MilestoneModel.objects.bulk_create(
                        MilestoneModel(
                            offer=row,
                            sequence=m.sequence,
                            title=m.title,
                            description=m.description,
                            amount_cents=m.amount_cents,
                            due_date=m.due_date,
                            status=m.status.value,
                        )
                        for m in offer.plan.milestones
                    )
        except IntegrityError:
            # Another version was signed at the same moment; the use case holds the
            # project lock, so this is a safety net.
            raise OfferOpenError(offer.version - 1) from None
        return _to_offer(_offers().get(pk=row.pk))

    def record_decision(self, offer: Offer) -> Offer:
        """Written only while the version is still ``sent``, so a decision is never overwritten."""
        updated = OfferModel.objects.filter(pk=offer.id, status=OfferModel.Status.SENT).update(
            status=offer.status.value,
            decided_by_id=offer.decided_by_account_id,
            decided_at=offer.decided_at,
            decline_reason=offer.decline_reason or "",
            deposit_release_milestone=offer.deposit_release_milestone,
        )
        if updated != 1:
            raise InvalidStateTransitionError("This version of the offer has already been decided.")
        return _to_offer(_offers().get(pk=offer.id))

    def get(self, offer_id: int) -> Offer | None:
        row = _offers().filter(pk=offer_id, project__deleted_at__isnull=True).first()
        return _to_offer(row) if row else None

    def for_project(self, project_id: int) -> list[Offer]:
        return [_to_offer(row) for row in _offers().filter(project_id=project_id).order_by("version")]


class DjangoTimelineRepository:
    def get(self, project_id: int) -> FinalisedTimeline | None:
        row = ProjectTimelineModel.objects.filter(project_id=project_id).first()
        if row is None:
            return None
        return FinalisedTimeline(
            row.project_id, Timeline(row.start_date, row.delivery_date), row.finalised_by_id, row.finalised_at
        )

    def add(self, timeline: FinalisedTimeline) -> FinalisedTimeline:
        ProjectTimelineModel.objects.create(
            project_id=timeline.project_id,
            start_date=timeline.timeline.start_date,
            delivery_date=timeline.timeline.delivery_date,
            finalised_by_id=timeline.finalised_by_account_id,
            finalised_at=timeline.finalised_at,
        )
        return timeline


class DjangoDepositTerms:
    """#7's ``DepositTermsSource``: the accepted offer of an ``Assigned`` client project."""

    def get_for_update(self, project_id: int) -> DepositTerms | None:
        # Project first, then its team: the same lock order as every start-gate action.
        row = (
            ProjectModel.objects.select_for_update(of=("self",))
            .select_related("owner")
            .filter(pk=project_id, deleted_at__isnull=True)
            .first()
        )
        if row is None:
            return None
        list(TeamModel.objects.select_for_update().filter(project_id=project_id).values_list("pk", flat=True))
        accepted = OfferModel.objects.filter(project_id=project_id, status=OfferModel.Status.ACCEPTED).first()
        return DepositTerms(
            project_id=row.id,
            title=row.title,
            client_user_id=row.owner.clerk_user_id,
            is_client_project=row.kind == ProjectModel.Kind.CLIENT,
            is_assigned=row.status == ProjectModel.Status.ASSIGNED,
            offer_version_id=accepted.id if accepted else None,
            accepted_total_cents=accepted.total_cents if accepted else None,
            agreed_deposit_percent=accepted.deposit_percent if accepted else None,
        )
