"""What the milestone review use cases (A2, #176) need. The Django adapter
implements it; tests use an in-memory fake."""

from __future__ import annotations

from typing import Protocol

from nextnode.domain.milestones import MilestoneReview
from nextnode.domain.start_gate import PlannedMilestone


class MilestoneStore(Protocol):
    def project_of(self, milestone_id: int) -> int | None:
        """The project a milestone belongs to, or ``None`` if there is no such milestone."""
        ...

    def accepted_plan(self, project_id: int, *, lock: bool = False) -> list[PlannedMilestone]:
        """The milestones of the project's accepted offer, in order (empty when
        there is none). ``lock`` holds them until the transaction ends."""
        ...

    def save(self, milestones: list[PlannedMilestone]) -> None:
        """Stores each milestone's status, ``submitted_at`` and ``approved_at``."""
        ...

    def add_review(self, review: MilestoneReview) -> MilestoneReview: ...

    def reviews(self, project_id: int) -> list[MilestoneReview]:
        """Every review event on the project's accepted plan, oldest first."""
        ...
