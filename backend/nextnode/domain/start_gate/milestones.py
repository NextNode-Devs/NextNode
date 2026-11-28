"""The milestone plan on an offer version (A1, #175; NN-16a #94; stakeholder Q1).

Rules (Team Lead, 17 Nov 2026; Phase 2 decisions):

- an offer with a plan has **3 to 10 milestones**, numbered 1, 2, 3 … in order;
- their amounts add up to the offer total **exactly**;
- each is due after the start date and after the one before it, and none
  after the delivery date;
- the deposit is a term of the offer: **20 %** by default, or 25, 30, 35 or 40
  if the client and the Lead agree;
- when the client accepts, they choose **milestone 1 or 2** as the one whose
  approval releases the deposit (released, as a planned flow, by NN-37).

Nothing is paid per milestone: the deposit at the start and one final payment
on approval. A plan is optional on the API so the Phase 1 offer form keeps
working; a plan sent with the offer is held to every rule above.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from nextnode.domain.errors import ValidationError
from nextnode.domain.payments import deposit_for
from nextnode.domain.projects.budget import format_cad
from nextnode.domain.start_gate.timeline import Timeline

MIN_MILESTONES = 3
MAX_MILESTONES = 10
TITLE_MAX = 120
DESCRIPTION_MAX = 1000
DEFAULT_DEPOSIT_PERCENT = 20
DEPOSIT_PERCENT_OPTIONS = (20, 25, 30, 35, 40)
RELEASE_CHOICES = (1, 2)
FIELD = "milestones"


class MilestoneStatus(StrEnum):
    """FR6, plus ``not_started`` for later milestones once the deposit is paid.
    A1 creates every milestone ``pending_deposit``; A2 (#176) moves them."""

    PENDING_DEPOSIT = "pending_deposit"
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    UNDER_REVIEW = "under_review"
    COMPLETED = "completed"


@dataclass(frozen=True)
class MilestoneDraft:
    """One row as the Team Lead writes it; its number is its place in the list."""

    title: str
    description: str
    amount_cents: int
    due_date: date


@dataclass(frozen=True)
class PlannedMilestone:
    sequence: int
    title: str
    description: str
    amount_cents: int
    due_date: date
    status: MilestoneStatus = MilestoneStatus.PENDING_DEPOSIT
    id: int | None = None
    submitted_at: datetime | None = None  # A2: the Lead's latest submission
    approved_at: datetime | None = None  # A2: the client's approval


def _row_errors(index: int, row: MilestoneDraft, title: str, description: str) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    prefix = f"{FIELD}.{index}"
    if not title:
        errors[f"{prefix}.title"] = ["Give this milestone a title."]
    elif len(title) > TITLE_MAX:
        errors[f"{prefix}.title"] = [f"Up to {TITLE_MAX} characters."]
    if len(description) > DESCRIPTION_MAX:
        errors[f"{prefix}.description"] = [f"Up to {DESCRIPTION_MAX:,} characters."]
    if row.amount_cents <= 0:
        errors[f"{prefix}.amount_cents"] = ["Enter an amount above zero."]
    return errors


@dataclass(frozen=True)
class MilestonePlan:
    deposit_percent: int
    milestones: tuple[PlannedMilestone, ...]

    @classmethod
    def create(
        cls, rows: list[MilestoneDraft], *, total_cents: int, timeline: Timeline, deposit_percent: int
    ) -> MilestonePlan:
        errors: dict[str, list[str]] = {}
        if deposit_percent not in DEPOSIT_PERCENT_OPTIONS:
            options = ", ".join(f"{p} %" for p in DEPOSIT_PERCENT_OPTIONS)
            errors["deposit_percent"] = [f"Choose one of {options}."]
        if not MIN_MILESTONES <= len(rows) <= MAX_MILESTONES:
            message = f"An offer needs {MIN_MILESTONES} to {MAX_MILESTONES} milestones; this has {len(rows)}."
            raise ValidationError(message, {FIELD: [message], **errors})

        planned: list[PlannedMilestone] = []
        previous_due = timeline.start_date
        for index, row in enumerate(rows):
            title, description = " ".join(row.title.split()), row.description.strip()
            errors.update(_row_errors(index, row, title, description))
            due_field = f"{FIELD}.{index}.due_date"
            if row.due_date <= previous_due:
                errors[due_field] = [
                    "Must be after the start date."
                    if index == 0
                    else "Must be due after the milestone before it."
                ]
            elif row.due_date > timeline.delivery_date:
                errors[due_field] = ["Can't be after the delivery date."]
            previous_due = max(previous_due, row.due_date)
            planned.append(PlannedMilestone(index + 1, title, description, row.amount_cents, row.due_date))

        added = sum(row.amount_cents for row in rows)
        if added != total_cents and not any(key.endswith("amount_cents") for key in errors):
            errors[FIELD] = [
                f"The milestones add up to {format_cad(added)}; the offer total is {format_cad(total_cents)}."
            ]
        if errors:
            raise ValidationError(
                errors[FIELD][0] if FIELD in errors else "Some milestones need attention.", errors
            )
        return cls(deposit_percent, tuple(planned))

    def deposit_cents(self, total_cents: int) -> int:
        """The deposit this plan agrees, with the same rounding as the live deposit (#7)."""
        return deposit_for(total_cents, self.deposit_percent)


def ensure_release_choice(plan: MilestonePlan | None, choice: int | None) -> int | None:
    """The client's choice when accepting: required (1 or 2) when the offer has
    a plan, and refused when it has none."""
    if plan is None:
        if choice is not None:
            raise ValidationError(
                "This offer has no milestones, so there is no milestone to choose.",
                {"deposit_release_milestone": ["This offer has no milestones."]},
            )
        return None
    if choice not in RELEASE_CHOICES:
        message = "Choose milestone 1 or 2: the deposit is paid to the team when you approve it."
        raise ValidationError(message, {"deposit_release_milestone": [message]})
    return choice
