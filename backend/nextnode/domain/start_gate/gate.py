"""The project start gate (#6; spec invariant 5).

Client-funded: the team is full and its proposal closed (``Locked``), the
client accepted the Team Lead's offer (``Assigned``) and Stripe confirmed the
deposit (#7, by verified webhook only). Developer-created: the team is full
and locked and the Team Lead finalised the timeline. Only then does the team
become ``Active`` and the project ``InProgress``.

``evaluate`` lists every condition, whether it is met and who acts next; the
start use cases call ``ensure_met`` so the domain, not a screen, refuses an
early start.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from nextnode.domain.errors import ConflictError
from nextnode.domain.projects import Project, ProjectStatus, Team, TeamStatus
from nextnode.domain.start_gate.offer import Offer, OfferStatus


class NextActor(StrEnum):
    LEAD = "lead"
    CLIENT = "client"
    STRIPE = "stripe"  # waiting for Stripe's webhook
    NOBODY = "nobody"  # the project has started


class StartConditionMissingError(ConflictError):
    code = "START_CONDITION_MISSING"


@dataclass(frozen=True)
class Condition:
    key: str
    label: str
    met: bool


@dataclass(frozen=True)
class GateStatus:
    conditions: tuple[Condition, ...]
    next_actor: NextActor
    next_step: str
    started: bool

    @property
    def missing(self) -> Condition | None:
        return next((condition for condition in self.conditions if not condition.met), None)

    def ensure_met(self) -> None:
        missing = self.missing
        if missing is not None:
            raise StartConditionMissingError(
                f"This project can't start yet. Missing: {missing.label}. {self.next_step}"
            )


TEAM_LOCKED = "team_locked"
OFFER_ACCEPTED = "offer_accepted"
DEPOSIT_CONFIRMED = "deposit_confirmed"
TIMELINE_FINALISED = "timeline_finalised"

_STARTED = "Work has started. The team has its workspace chat."


def _team_step(team: Team) -> str:
    if team.lead_account_id is None:
        return "The client hires a Team Lead first."
    if team.team_size is None:
        return "The Team Lead sets the team size and recruits developers."
    if not team.is_full:
        return f"The Team Lead fills the team: {team.headcount} of {team.team_size} people so far."
    return "The team is full. The Team Lead closes the project proposal."


def _team_locked(team: Team) -> Condition:
    return Condition(
        TEAM_LOCKED, "Team full and proposal closed", team.status in (TeamStatus.LOCKED, TeamStatus.ACTIVE)
    )


def evaluate_client(project: Project, team: Team, latest: Offer | None, deposit: str) -> GateStatus:
    """``deposit`` is #7's ``deposit_status(project).status``: none, pending, completed or failed."""
    started = project.status in (ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED)
    accepted = started or project.status is ProjectStatus.ASSIGNED
    conditions = (
        _team_locked(team),
        Condition(OFFER_ACCEPTED, "Offer accepted by the client", accepted),
        Condition(DEPOSIT_CONFIRMED, "Deposit confirmed by Stripe", started or deposit == "completed"),
    )
    if started:
        return GateStatus(conditions, NextActor.NOBODY, _STARTED, True)
    if not conditions[0].met:
        return GateStatus(
            conditions, NextActor.LEAD if team.lead_account_id else NextActor.CLIENT, _team_step(team), False
        )
    if not accepted:
        if latest is not None and latest.status is OfferStatus.SENT:
            step = f"The client reviews version {latest.version} of the offer."
            return GateStatus(conditions, NextActor.CLIENT, step, False)
        if latest is not None and latest.status is OfferStatus.DECLINED:
            step = f"The client declined version {latest.version}. The Team Lead sends a revised offer."
            return GateStatus(conditions, NextActor.LEAD, step, False)
        return GateStatus(conditions, NextActor.LEAD, "The Team Lead sends the client a signed offer.", False)
    if deposit == "pending":
        return GateStatus(conditions, NextActor.STRIPE, "Waiting for Stripe to confirm the deposit.", False)
    step = (
        "The client pays the deposit."
        if deposit != "failed"
        else ("The last deposit payment didn't go through. The client pays the deposit again.")
    )
    return GateStatus(conditions, NextActor.CLIENT, step, False)


def evaluate_developer(project: Project, team: Team, timeline_finalised: bool) -> GateStatus:
    started = project.status in (ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED)
    conditions = (
        _team_locked(team),
        Condition(TIMELINE_FINALISED, "Timeline finalised by the Team Lead", started or timeline_finalised),
    )
    if started:
        return GateStatus(conditions, NextActor.NOBODY, _STARTED, True)
    if not conditions[0].met:
        return GateStatus(conditions, NextActor.LEAD, _team_step(team), False)
    return GateStatus(conditions, NextActor.LEAD, "The Team Lead finalises the timeline to start.", False)
