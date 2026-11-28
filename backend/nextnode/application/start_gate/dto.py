"""What the start-gate use cases return. Never an entity or ORM model.

Amounts are whole CAD cents. Every deposit figure here is computed on the
server with #7's ``deposit_for``; the browser never computes or sends one.
"""

from __future__ import annotations

from dataclasses import dataclass

from nextnode.application.payments.status import DepositStatus
from nextnode.application.projects.dto import PersonView
from nextnode.domain.payments import CURRENCY, deposit_for
from nextnode.domain.start_gate import FinalisedTimeline, GateStatus, MilestonePlan, Offer, PlannedMilestone

CLOSE_PROPOSAL = "close_proposal"
SEND_OFFER = "send_offer"
DECIDE_OFFER = "decide_offer"
PAY_DEPOSIT = "pay_deposit"
FINALIZE_TIMELINE = "finalize_timeline"


@dataclass(frozen=True)
class MilestoneView:
    """The frontend's ``Milestone`` (``entities/milestone``); ``submitted_at``
    and ``approved_at`` come from the review loop (A2, #176)."""

    id: int
    project_id: int
    sequence: int
    title: str
    description: str
    amount_cents: int
    due_date: str
    status: str
    submitted_at: str | None
    approved_at: str | None

    @classmethod
    def of(cls, milestone: PlannedMilestone, project_id: int) -> MilestoneView:
        assert milestone.id is not None, "stored milestones always have an id"
        return cls(
            id=milestone.id,
            project_id=project_id,
            sequence=milestone.sequence,
            title=milestone.title,
            description=milestone.description,
            amount_cents=milestone.amount_cents,
            due_date=milestone.due_date.isoformat(),
            status=milestone.status.value,
            submitted_at=milestone.submitted_at.isoformat() if milestone.submitted_at else None,
            approved_at=milestone.approved_at.isoformat() if milestone.approved_at else None,
        )


@dataclass(frozen=True)
class MilestonePlanView:
    """The frontend's ``MilestonePlan``. ``deposit_cents`` is the deposit this
    plan agrees, which is what checkout charges once the client accepts."""

    project_id: int
    offer_id: int
    offer_version: int
    offer_status: str
    total_cents: int
    deposit_percent: int
    deposit_cents: int
    deposit_release_milestone: int | None
    milestones: list[MilestoneView]

    @classmethod
    def of(cls, offer: Offer, plan: MilestonePlan) -> MilestonePlanView:
        assert offer.id is not None
        return cls(
            project_id=offer.project_id,
            offer_id=offer.id,
            offer_version=offer.version,
            offer_status=offer.status.value,
            total_cents=offer.terms.total_cents,
            deposit_percent=plan.deposit_percent,
            deposit_cents=plan.deposit_cents(offer.terms.total_cents),
            deposit_release_milestone=offer.deposit_release_milestone,
            milestones=[MilestoneView.of(m, offer.project_id) for m in plan.milestones],
        )


@dataclass(frozen=True)
class OfferView:
    id: int
    version: int
    status: str  # sent | accepted | declined
    summary: str
    total_cents: int
    deposit_cents: int  # due at initiation, from the server's rule
    currency: str
    start_date: str
    delivery_date: str
    signed_by: PersonView
    signed_at: str
    decided_by: PersonView | None
    decided_at: str | None
    decline_reason: str | None
    milestone_plan: MilestonePlanView | None  # A1; None on a version sent without one

    @classmethod
    def of(cls, offer: Offer, lead_name: str, client_name: str, deposit_percent: int) -> OfferView:
        assert offer.id is not None, "stored offers always have an id"
        decider = offer.decided_by_account_id
        return cls(
            id=offer.id,
            version=offer.version,
            status=offer.status.value,
            summary=offer.terms.summary,
            total_cents=offer.terms.total_cents,
            # What checkout charges: the plan's agreed %, else the default (A1).
            deposit_cents=deposit_for(
                offer.terms.total_cents, offer.plan.deposit_percent if offer.plan else deposit_percent
            ),
            currency=CURRENCY,
            start_date=offer.terms.timeline.start_date.isoformat(),
            delivery_date=offer.terms.timeline.delivery_date.isoformat(),
            signed_by=PersonView(offer.signed_by_account_id, lead_name),
            signed_at=offer.signed_at.isoformat(),
            decided_by=PersonView(decider, client_name) if decider is not None else None,
            decided_at=offer.decided_at.isoformat() if offer.decided_at else None,
            decline_reason=offer.decline_reason,
            milestone_plan=MilestonePlanView.of(offer, offer.plan) if offer.plan else None,
        )


@dataclass(frozen=True)
class ConditionView:
    key: str
    label: str
    met: bool


@dataclass(frozen=True)
class DepositView:
    """#7's ``DepositStatus``; the deposit-result page reads this shape."""

    status: str
    amount_cents: int | None
    currency: str | None
    completed_at: str | None

    @classmethod
    def of(cls, deposit: DepositStatus) -> DepositView:
        completed = deposit.completed_at.isoformat() if deposit.completed_at else None
        return cls(deposit.status, deposit.amount_cents, deposit.currency, completed)


@dataclass(frozen=True)
class TimelineView:
    start_date: str
    delivery_date: str
    finalised_at: str

    @classmethod
    def of(cls, timeline: FinalisedTimeline) -> TimelineView:
        return cls(
            timeline.timeline.start_date.isoformat(),
            timeline.timeline.delivery_date.isoformat(),
            timeline.finalised_at.isoformat(),
        )


@dataclass(frozen=True)
class StartGateView:
    """``GET /api/projects/{id}/start/``: each condition, who acts next and
    what the viewer may do. Client-project fields are ``None`` on developer
    ideas and the reverse; the workspace chat id only reaches team members."""

    project_id: int
    kind: str
    project_status: str
    team_status: str
    conditions: list[ConditionView]
    next_actor: str  # lead | client | stripe | nobody
    next_step: str
    started: bool
    viewer_role: str  # client | lead | member
    actions: list[str]
    proposed_budget_cents: int | None
    deposit_percent: int | None
    offers: list[OfferView] | None  # newest first
    deposit: DepositView | None
    timeline: TimelineView | None
    workspace_conversation_id: str | None

    @staticmethod
    def conditions_of(gate: GateStatus) -> list[ConditionView]:
        return [ConditionView(c.key, c.label, c.met) for c in gate.conditions]


@dataclass(frozen=True)
class DepositPreview:
    total_cents: int
    deposit_cents: int
    deposit_percent: int
    currency: str
