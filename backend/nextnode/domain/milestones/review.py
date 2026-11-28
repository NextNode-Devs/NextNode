"""Milestone delivery and client review (A2, #176; NN-16b #95; proposal FR6).

    Pending deposit → In progress → Under review → Completed
                          ↑              │
                          └── revision ──┘

- When the deposit is confirmed and the project starts, milestone 1 is in
  progress and the rest are not started (``begin_work``).
- The **Team Lead** submits a milestone in progress, saying what is ready and
  optionally linking to it (https only).
- The **client** approves it, or asks for a revision saying what to change,
  which sends it back to in progress.
- Approving starts the next milestone (``start_next``).

Every step writes one review event: the history is the audit trail of the
loop. Nothing is paid per milestone; approving the client's chosen milestone
(1 or 2) is when the planned deposit release happens (NN-37, shown "Planned").
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum
from urllib.parse import urlparse

from nextnode.domain.errors import InvalidStateTransitionError, ValidationError
from nextnode.domain.start_gate.milestones import MilestoneStatus, PlannedMilestone

NOTE_MAX = 2000
LINK_MAX = 500


class ReviewKind(StrEnum):
    SUBMITTED = "submitted"
    REVISION_REQUESTED = "revision_requested"
    APPROVED = "approved"


class ReviewAuthor(StrEnum):
    CLIENT = "client"
    LEAD = "lead"


@dataclass(frozen=True)
class MilestoneReview:
    milestone_id: int
    kind: ReviewKind
    note: str
    link_url: str | None
    author_account_id: int
    author_role: ReviewAuthor
    created_at: datetime
    id: int | None = None


def _note(note: str, *, required: str | None) -> str:
    text = note.strip()
    if required and not text:
        raise ValidationError(required, {"note": [required]})
    if len(text) > NOTE_MAX:
        message = f"Keep it under {NOTE_MAX:,} characters."
        raise ValidationError(message, {"note": [message]})
    return text


def _link(link: str | None) -> str | None:
    value = (link or "").strip()
    if not value:
        return None
    parsed = urlparse(value)
    if len(value) > LINK_MAX:
        message = f"Use a link under {LINK_MAX} characters."
    elif parsed.scheme != "https" or not parsed.netloc:
        message = "Use a full link that starts with https://."
    else:
        return value
    raise ValidationError(message, {"link_url": [message]})


def _expect(milestone: PlannedMilestone, status: MilestoneStatus, message: str) -> int:
    if milestone.status is not status:
        raise InvalidStateTransitionError(message)
    assert milestone.id is not None, "stored milestones always have an id"
    return milestone.id


def submit(
    milestone: PlannedMilestone, lead_id: int, note: str, link: str | None, at: datetime
) -> tuple[PlannedMilestone, MilestoneReview]:
    """The Team Lead: ``In progress -> Under review``."""
    milestone_id = _expect(
        milestone, MilestoneStatus.IN_PROGRESS, "Only a milestone in progress can be submitted."
    )
    text = _note(note, required="Say what is ready for the client to review.")
    review = MilestoneReview(
        milestone_id, ReviewKind.SUBMITTED, text, _link(link), lead_id, ReviewAuthor.LEAD, at
    )
    return replace(milestone, status=MilestoneStatus.UNDER_REVIEW, submitted_at=at), review


def approve(
    milestone: PlannedMilestone, client_id: int, note: str, at: datetime
) -> tuple[PlannedMilestone, MilestoneReview]:
    """The client: ``Under review -> Completed``. An approval needs no words."""
    milestone_id = _expect(
        milestone, MilestoneStatus.UNDER_REVIEW, "Only a milestone waiting for your check can be approved."
    )
    review = MilestoneReview(
        milestone_id,
        ReviewKind.APPROVED,
        _note(note, required=None),
        None,
        client_id,
        ReviewAuthor.CLIENT,
        at,
    )
    return replace(milestone, status=MilestoneStatus.COMPLETED, approved_at=at), review


def request_revision(
    milestone: PlannedMilestone, client_id: int, note: str, at: datetime
) -> tuple[PlannedMilestone, MilestoneReview]:
    """The client: ``Under review -> In progress``, saying what to change."""
    milestone_id = _expect(
        milestone, MilestoneStatus.UNDER_REVIEW, "Only a milestone waiting for your check can be sent back."
    )
    text = _note(note, required="Say what needs to change.")
    review = MilestoneReview(
        milestone_id, ReviewKind.REVISION_REQUESTED, text, None, client_id, ReviewAuthor.CLIENT, at
    )
    return replace(milestone, status=MilestoneStatus.IN_PROGRESS), review


def begin_work(milestones: list[PlannedMilestone]) -> list[PlannedMilestone]:
    """The deposit is confirmed: milestone 1 in progress, the rest not started.
    Only from a plan that hasn't begun; anything else is returned unchanged."""
    if not milestones or any(m.status is not MilestoneStatus.PENDING_DEPOSIT for m in milestones):
        return milestones
    return [
        replace(m, status=MilestoneStatus.IN_PROGRESS if m.sequence == 1 else MilestoneStatus.NOT_STARTED)
        for m in sorted(milestones, key=lambda m: m.sequence)
    ]


def start_next(milestones: list[PlannedMilestone]) -> list[PlannedMilestone]:
    """After an approval the first milestone not started yet moves to in
    progress, unless one is already being worked on or checked."""
    ordered = sorted(milestones, key=lambda m: m.sequence)
    busy = (MilestoneStatus.IN_PROGRESS, MilestoneStatus.UNDER_REVIEW)
    if any(m.status in busy for m in ordered):
        return ordered
    upcoming = next((m for m in ordered if m.status is MilestoneStatus.NOT_STARTED), None)
    return [replace(m, status=MilestoneStatus.IN_PROGRESS) if m is upcoming else m for m in ordered]
