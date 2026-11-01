"""The start-gate actions (#6): close the proposal, send and decide offers,
finalise a developer idea's timeline, and start a project.

Every action locks the project and its team first (the same order as #5), so
two requests never interleave. Each returns the gate as stored afterwards.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from nextnode.application.ports import Actor
from nextnode.application.start_gate.deps import StartGateDeps
from nextnode.application.start_gate.dto import StartGateView
from nextnode.domain.errors import ConflictError, ForbiddenError, InvalidStateTransitionError, NotFoundError
from nextnode.domain.start_gate import FinalisedTimeline, Offer, OfferTerms, Timeline, accepted_offer

OFFER_NOT_FOUND = "We couldn't find that offer."


def _account(actor: Actor) -> int:
    if actor.account_id is None:
        raise ForbiddenError("Finish setting up your account first.")
    return actor.account_id


class CloseProposal:
    """The Team Lead closes a full team's proposal: ``Open -> Locked``, and
    recruitment stops (any candidacy still waiting is closed, live)."""

    def __init__(self, deps: StartGateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> StartGateView:
        actor_id = _account(actor)
        with self._d.uow.atomic():
            record = self._d.load(project_id)
            self._d.projects.save_team(record.team.close_proposal(actor_id))
            self._d.recruitment.execute(project_id)
            return self._d.view(self._d.load(project_id), actor)


@dataclass(frozen=True)
class OfferCommand:
    summary: str
    total_cents: int
    start_date: date
    delivery_date: date


class SendOffer:
    """The Team Lead signs the next version of the offer: ``-> OfferSent``.
    Only on a client project whose proposal is closed, one open version at a time."""

    def __init__(self, deps: StartGateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, command: OfferCommand) -> StartGateView:
        actor_id = _account(actor)
        with self._d.uow.atomic():
            record = self._d.load(project_id)
            record.team.ensure_lead(actor_id, "send the offer")
            assert record.project.id is not None
            previous = self._d.offers.for_project(record.project.id)
            # Refuses developer ideas and later states; a revision keeps the project OfferSent.
            project = record.project.revise_offer() if previous else record.project.send_offer()
            record.team.ensure_locked()
            terms = OfferTerms.create(
                summary=command.summary,
                total_cents=command.total_cents,
                start_date=command.start_date,
                delivery_date=command.delivery_date,
                today=self._d.clock.now().date(),
            )
            offer = Offer.sign(project.id, previous, terms, actor_id, self._d.clock.now())
            self._d.offers.add(offer)
            self._d.projects.save(project)
            return self._d.view(self._d.load(project_id), actor)


class _Decide:
    """Shared by accept and decline: only the project's client decides, and
    only the open version. Anyone outside the project gets 404."""

    def __init__(self, deps: StartGateDeps) -> None:
        self._d = deps

    def _decide(self, actor: Actor, offer_id: int, reason: str | None) -> StartGateView:
        actor_id = _account(actor)
        with self._d.uow.atomic():
            found = self._d.offers.get(offer_id)
            if found is None:
                raise NotFoundError(OFFER_NOT_FOUND)
            record = self._d.load(found.project_id)
            if self._d.role_of(record, actor) is None:
                raise NotFoundError(OFFER_NOT_FOUND)
            offer = self._d.offers.get(offer_id)  # read again under the project lock
            assert offer is not None
            owner = record.project.owner_account_id
            now = self._d.clock.now()
            if reason is None:
                decided = offer.accept(actor_id, owner, now)
                self._d.projects.save(record.project.accept_offer())
            else:
                decided = offer.decline(actor_id, owner, reason, now)
            self._d.offers.record_decision(decided)
            return self._d.view(self._d.load(found.project_id), actor)


class AcceptOffer(_Decide):
    """The client accepts: the version, user and time are recorded and the project becomes ``Assigned``."""

    def execute(self, actor: Actor, offer_id: int) -> StartGateView:
        return self._decide(actor, offer_id, None)


class DeclineOffer(_Decide):
    """The client declines with a reason; the team stays ``Locked`` and the Lead may send a revision."""

    def execute(self, actor: Actor, offer_id: int, reason: str) -> StartGateView:
        return self._decide(actor, offer_id, reason)


class FinalizeTimeline:
    """A developer idea's Team Lead finalises the timeline, which starts the
    project: no offer, agreement or payment exists for it."""

    def __init__(self, deps: StartGateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, start_date: date, delivery_date: date) -> StartGateView:
        actor_id = _account(actor)
        with self._d.uow.atomic():
            record = self._d.load(project_id)
            record.team.ensure_lead(actor_id, "finalise the timeline")
            if record.project.is_client_project:
                raise InvalidStateTransitionError(
                    "A client project's timeline is part of its offer. "
                    "It starts when Stripe confirms the deposit."
                )
            record.team.ensure_locked()
            assert record.project.id is not None
            if self._d.timelines.get(record.project.id) is not None:
                raise ConflictError("This project's timeline is already finalised.")
            today = self._d.clock.now()
            timeline = Timeline.create(start_date, delivery_date, today.date())
            self._d.timelines.add(FinalisedTimeline(record.project.id, timeline, actor_id, today))
            self._d.start(self._d.state(record))
            return self._d.view(self._d.load(project_id), actor)


class StartProject:
    """A direct start request from the client or the team. It never bypasses
    the gate: anything missing is refused (409) naming the condition. A client
    project starts only from #7's confirmed-deposit webhook."""

    def __init__(self, deps: StartGateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> StartGateView:
        _account(actor)
        with self._d.uow.atomic():
            record = self._d.load(project_id)
            self._d.require_involved(record, actor)
            state = self._d.state(record)
            if state.gate.started:
                raise InvalidStateTransitionError("This project has already started.")
            state.gate.ensure_met()
            if record.project.is_client_project:
                raise ConflictError("A client project starts automatically when Stripe confirms the deposit.")
            self._d.start(state)
            return self._d.view(self._d.load(project_id), actor)


class StartClientProject:
    """#7's ``ProjectStarter``: called only by the payment webhook, in its
    transaction, after a deposit is newly confirmed. Raising rolls the payment
    change back, so Stripe retries."""

    def __init__(self, deps: StartGateDeps) -> None:
        self._d = deps

    def start_client_project(self, project_id: int, offer_version_id: int) -> None:
        with self._d.uow.atomic():
            state = self._d.state(self._d.load(project_id))
            accepted = accepted_offer(state.offers)
            if accepted is None or accepted.id != offer_version_id:
                raise ConflictError(
                    "The deposit was paid for an offer that is not this project's accepted offer."
                )
            self._d.start(state)
