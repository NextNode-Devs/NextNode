"""What the start-gate use cases (#6) need. Django adapters implement them;
tests use in-memory fakes."""

from __future__ import annotations

from typing import Protocol

from nextnode.application.payments.status import DepositStatus
from nextnode.domain.start_gate import FinalisedTimeline, Offer


class OfferRepository(Protocol):
    def add(self, offer: Offer) -> Offer:
        """Stores a new signed version; returns it with its id."""
        ...

    def record_decision(self, offer: Offer) -> Offer:
        """Stores the client's decision on an open version. A version is decided
        once: storing a second decision is refused."""
        ...

    def get(self, offer_id: int) -> Offer | None: ...

    def for_project(self, project_id: int) -> list[Offer]:
        """Every version, oldest first."""
        ...


class TimelineRepository(Protocol):
    def get(self, project_id: int) -> FinalisedTimeline | None: ...

    def add(self, timeline: FinalisedTimeline) -> FinalisedTimeline: ...


class DepositStatusReader(Protocol):
    """#7's ``deposit_status(project)`` (``DepositStatusQuery``)."""

    def execute(self, project_id: int) -> DepositStatus: ...


class WorkspaceChats(Protocol):
    def open_for_team(self, project_id: int, participant_ids: list[int]) -> str:
        """The team's one workspace conversation, opened (or found); its id."""
        ...

    def conversation_id_for(self, project_id: int) -> str | None: ...


class RecruitmentCloser(Protocol):
    """#5's ``CloseRecruitment``: closes every pending candidacy, live."""

    def execute(self, project_id: int) -> list[str]: ...
