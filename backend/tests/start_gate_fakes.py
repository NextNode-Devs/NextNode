"""In-memory fakes for the start-gate ports (#6), on top of #3's ``InMemoryProjects``."""

from dataclasses import replace
from datetime import UTC, date, datetime

from nextnode.application.payments.status import DepositStatus
from nextnode.application.start_gate.commands import OfferCommand
from nextnode.application.start_gate.deps import StartGateDeps
from nextnode.application.start_gate.use_cases import StartGateUseCases
from nextnode.domain.errors import InvalidStateTransitionError
from nextnode.domain.projects import Project, ProjectDetails, ProjectKind, Team
from nextnode.domain.start_gate import FinalisedTimeline, Offer, OfferStatus
from tests.project_fakes import FixedClock, InMemoryProjects
from tests.team_fakes import CLIENT_ID, DEV_IDS, LEAD_ID, FakeUnitOfWork

TODAY = date(2026, 10, 31)  # FixedClock's day


class InMemoryOffers:
    def __init__(self) -> None:
        self.rows: dict[int, Offer] = {}

    def add(self, offer: Offer) -> Offer:
        stored = replace(offer, id=len(self.rows) + 1)
        self.rows[stored.id] = stored
        return stored

    def record_decision(self, offer: Offer) -> Offer:
        assert offer.id is not None
        if self.rows[offer.id].status is not OfferStatus.SENT:
            raise InvalidStateTransitionError("Already decided.")
        self.rows[offer.id] = offer
        return offer

    def get(self, offer_id: int) -> Offer | None:
        return self.rows.get(offer_id)

    def for_project(self, project_id: int) -> list[Offer]:
        return sorted((o for o in self.rows.values() if o.project_id == project_id), key=lambda o: o.version)


class InMemoryTimelines:
    def __init__(self) -> None:
        self.rows: dict[int, FinalisedTimeline] = {}

    def get(self, project_id: int) -> FinalisedTimeline | None:
        return self.rows.get(project_id)

    def add(self, timeline: FinalisedTimeline) -> FinalisedTimeline:
        self.rows[timeline.project_id] = timeline
        return timeline


class FakeDeposits:
    """#7's ``deposit_status``: whatever the test sets, ``none`` by default."""

    def __init__(self) -> None:
        self.status: dict[int, str] = {}

    def execute(self, project_id: int) -> DepositStatus:
        status = self.status.get(project_id, "none")
        if status == "none":
            return DepositStatus("none")
        return DepositStatus(status, 200_000, "cad", datetime(2026, 11, 1, tzinfo=UTC))  # type: ignore[arg-type]


class FakeWorkspace:
    def __init__(self) -> None:
        self.opened: dict[int, list[int]] = {}

    def open_for_team(self, project_id: int, participant_ids: list[int]) -> str:
        self.opened.setdefault(project_id, participant_ids)
        return f"workspace-{project_id}"

    def conversation_id_for(self, project_id: int) -> str | None:
        return f"workspace-{project_id}" if project_id in self.opened else None


class FakeRecruitment:
    def __init__(self) -> None:
        self.closed: list[int] = []

    def execute(self, project_id: int) -> list[str]:
        self.closed.append(project_id)
        return []


def offer(
    total_cents: int = 1_000_000, summary: str = "Five sprints: booking, payments, admin."
) -> OfferCommand:
    return OfferCommand(summary, total_cents, date(2026, 11, 9), date(2027, 2, 1))


class GateWorld:
    def __init__(self) -> None:
        self.projects = InMemoryProjects({CLIENT_ID: "Grace", LEAD_ID: "Ada"})
        self.offers = InMemoryOffers()
        self.timelines = InMemoryTimelines()
        self.deposits = FakeDeposits()
        self.workspace = FakeWorkspace()
        self.recruitment = FakeRecruitment()
        self.uc = StartGateUseCases(
            StartGateDeps(
                self.projects,
                self.offers,
                self.timelines,
                self.deposits,
                self.workspace,
                self.recruitment,
                FixedClock(),
                FakeUnitOfWork(),
                deposit_percent=20,
            )
        )

    def project(self, kind: ProjectKind = ProjectKind.CLIENT, *, size: int = 5, members: int = 4) -> int:
        """A project with a Lead, a set size and ``members`` approved developers."""
        budget = 200_000 if kind is ProjectKind.CLIENT else None
        details = ProjectDetails("Booking app", "A booking app.", (), date(2027, 1, 1), budget)
        owner = CLIENT_ID if kind is ProjectKind.CLIENT else LEAD_ID
        team = replace(Team.for_new_project(LEAD_ID), team_size=size, member_account_ids=DEV_IDS[:members])
        record = self.projects.add(Project.publish(kind, owner, details), team)
        assert record.project.id is not None
        return record.project.id

    def record(self, project_id: int):
        record = self.projects.get(project_id)
        assert record is not None
        return record
