"""The collaborators every start-gate use case shares, and the steps they repeat."""

from __future__ import annotations

from dataclasses import dataclass

from nextnode.application.conversations.ports import Clock
from nextnode.application.payments.status import DepositStatus
from nextnode.application.ports import Actor
from nextnode.application.projects.ports import ProjectRecord, ProjectRepository, UnitOfWork
from nextnode.application.start_gate.dto import (
    CLOSE_PROPOSAL,
    DECIDE_OFFER,
    FINALIZE_TIMELINE,
    PAY_DEPOSIT,
    SEND_OFFER,
    DepositView,
    OfferView,
    StartGateView,
    TimelineView,
)
from nextnode.application.start_gate.ports import (
    DepositStatusReader,
    OfferRepository,
    RecruitmentCloser,
    TimelineRepository,
    WorkspaceChats,
)
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.projects import ProjectStatus, TeamStatus
from nextnode.domain.start_gate import (
    GateStatus,
    Offer,
    OfferStatus,
    evaluate_client,
    evaluate_developer,
    latest_offer,
)

PROJECT_NOT_FOUND = "We couldn't find that project."
NOT_INVOLVED = "Only this project's client and team can see how it starts."


@dataclass(frozen=True)
class GateState:
    """A project with everything its gate depends on, read in one place."""

    record: ProjectRecord
    offers: list[Offer]
    deposit: DepositStatus | None  # None on developer ideas
    gate: GateStatus


class StartGateDeps:
    def __init__(
        self,
        projects: ProjectRepository,
        offers: OfferRepository,
        timelines: TimelineRepository,
        deposits: DepositStatusReader,
        workspace: WorkspaceChats,
        recruitment: RecruitmentCloser,
        clock: Clock,
        uow: UnitOfWork,
        *,
        deposit_percent: int,
    ) -> None:
        self.projects = projects
        self.offers = offers
        self.timelines = timelines
        self.deposits = deposits
        self.workspace = workspace
        self.recruitment = recruitment
        self.clock = clock
        self.uow = uow
        self.deposit_percent = deposit_percent

    # --- loading -------------------------------------------------------------------

    def load(self, project_id: int, *, lock: bool = True) -> ProjectRecord:
        """The project and its team, locked until the transaction ends unless ``lock`` is false."""
        record = (self.projects.get_for_update if lock else self.projects.get)(project_id)
        if record is None:
            raise NotFoundError(PROJECT_NOT_FOUND)
        return record

    def state(self, record: ProjectRecord) -> GateState:
        project, team = record.project, record.team
        assert project.id is not None
        if not project.is_client_project:
            finalised = self.timelines.get(project.id) is not None
            return GateState(record, [], None, evaluate_developer(project, team, finalised))
        offers = self.offers.for_project(project.id)
        deposit = self.deposits.execute(project.id)
        gate = evaluate_client(project, team, latest_offer(offers), deposit.status)
        return GateState(record, offers, deposit, gate)

    # --- who is asking -------------------------------------------------------------

    @staticmethod
    def role_of(record: ProjectRecord, actor: Actor) -> str | None:
        """client, lead or member; ``None`` for anyone else. A developer idea's
        owner is its Team Lead, so they are ``lead``."""
        team = record.team
        if team.is_lead(actor.account_id):
            return "lead"
        if team.is_member(actor.account_id):
            return "member"
        if record.project.is_client_project and actor.account_id == record.project.owner_account_id:
            return "client"
        return None

    def require_involved(self, record: ProjectRecord, actor: Actor) -> str:
        role = self.role_of(record, actor)
        if role is None:
            raise ForbiddenError(NOT_INVOLVED)
        return role

    # --- starting --------------------------------------------------------------------

    def start(self, state: GateState) -> None:
        """Team ``Locked -> Active``, project ``-> InProgress`` and the team's
        workspace chat, together. The gate refuses first if anything is missing."""
        state.gate.ensure_met()
        record = state.record
        project = record.project.start()
        team = record.team.activate()
        assert project.id is not None
        self.projects.save(project)
        self.projects.save_team(team)
        self.workspace.open_for_team(project.id, list(team.participant_ids))

    # --- the view -----------------------------------------------------------------------

    def view(self, record: ProjectRecord, actor: Actor) -> StartGateView:
        """Re-reads the gate after a change, so the answer is what is stored."""
        role = self.require_involved(record, actor)
        state = self.state(record)
        project, team = record.project, record.team
        assert project.id is not None
        client = project.is_client_project
        timeline = None if client else self.timelines.get(project.id)
        return StartGateView(
            project_id=project.id,
            kind=project.kind.value,
            project_status=project.status.value,
            team_status=team.status.value,
            conditions=StartGateView.conditions_of(state.gate),
            next_actor=state.gate.next_actor.value,
            next_step=state.gate.next_step,
            started=state.gate.started,
            viewer_role=role,
            actions=self._actions(state, role),
            proposed_budget_cents=project.details.proposed_budget_cents if client else None,
            deposit_percent=self.deposit_percent if client else None,
            offers=[
                OfferView.of(offer, record.lead_name or "", record.owner_name, self.deposit_percent)
                for offer in reversed(state.offers)
            ]
            if client
            else None,
            deposit=DepositView.of(state.deposit) if state.deposit else None,
            timeline=TimelineView.of(timeline) if timeline else None,
            workspace_conversation_id=self.workspace.conversation_id_for(project.id)
            if role != "client"
            else None,
        )

    @staticmethod
    def _actions(state: GateState, role: str) -> list[str]:
        """What the viewer may do now. Every action re-checks on the server."""
        project, team = state.record.project, state.record.team
        latest = latest_offer(state.offers)
        locked = team.status is TeamStatus.LOCKED
        if role == "lead" and team.status is TeamStatus.OPEN and team.is_full:
            return [CLOSE_PROPOSAL]
        if role == "lead" and locked and not project.is_client_project:
            return [FINALIZE_TIMELINE]
        offer_closed = latest is None or latest.status is OfferStatus.DECLINED
        if role == "lead" and locked and project.status in (ProjectStatus.POSTED, ProjectStatus.OFFER_SENT):
            return [SEND_OFFER] if offer_closed else []
        if role == "client" and latest is not None and latest.is_open:
            return [DECIDE_OFFER]
        paid = state.deposit is not None and state.deposit.confirmed
        if role == "client" and project.status is ProjectStatus.ASSIGNED and not paid:
            return [PAY_DEPOSIT]
        return []
