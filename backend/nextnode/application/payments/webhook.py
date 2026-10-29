"""HandlePaymentWebhook: the only path that changes a payment's status.

A browser redirect never confirms a payment; only a verified provider event
does. Each event is processed once (its id is stored in the same transaction
as the payment change), and a completed payment never goes back. A newly
completed deposit starts the project (#6) in that same transaction, and this
is the only code path that starts a client-funded project.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from nextnode.application.payments.ports import (
    PaymentEvent,
    PaymentGateway,
    PaymentRepository,
    ProjectStarter,
    UnitOfWork,
    WebhookEventLog,
)
from nextnode.domain.errors import ConflictError
from nextnode.domain.payments import Payment, PaymentMismatchError, PaymentStatus

logger = logging.getLogger(__name__)

SESSION_COMPLETED = "checkout.session.completed"
ASYNC_SUCCEEDED = "checkout.session.async_payment_succeeded"
ASYNC_FAILED = "checkout.session.async_payment_failed"
SESSION_EXPIRED = "checkout.session.expired"
HANDLED = frozenset({SESSION_COMPLETED, ASYNC_SUCCEEDED, ASYNC_FAILED, SESSION_EXPIRED})

Result = Literal["completed", "failed", "pending", "duplicate", "ignored"]


@dataclass(frozen=True)
class WebhookOutcome:
    event_id: str
    result: Result
    payment_id: str | None = None


class HandlePaymentWebhook:
    def __init__(
        self,
        gateway: PaymentGateway,
        payments: PaymentRepository,
        events: WebhookEventLog,
        uow: UnitOfWork,
        starter: ProjectStarter,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._gateway = gateway
        self._payments = payments
        self._events = events
        self._uow = uow
        self._starter = starter
        self._now = now

    def execute(self, payload: bytes, signature: str | None) -> WebhookOutcome:
        event = self._gateway.parse_event(payload, signature)
        with self._uow.atomic():
            if not self._events.record(event.event_id, event.type):
                return WebhookOutcome(event.event_id, "duplicate")
            if event.type not in HANDLED:
                return WebhookOutcome(event.event_id, "ignored")
            payment = self._payment_for(event)
            was_completed = payment.status is PaymentStatus.COMPLETED
            result = self._apply(event, payment)
            self._payments.save(payment)
            if result == "completed" and not was_completed:
                self._starter.start_client_project(payment.project_id, payment.offer_version_id)
        return WebhookOutcome(event.event_id, result, str(payment.id))

    def _payment_for(self, event: PaymentEvent) -> Payment:
        payment = None
        try:
            payment = self._payments.get_for_update(UUID(event.payment_id or ""))
        except ValueError:
            pass
        if payment is None:
            logger.warning("Payment event %s names no known payment", event.event_id)
            raise PaymentMismatchError("This event does not belong to a known payment.")
        try:
            payment.ensure_matches(
                amount_cents=event.amount_cents if event.amount_cents is not None else -1,
                currency=event.currency or "",
                checkout_session_id=event.checkout_session_id,
            )
        except PaymentMismatchError:
            logger.warning("Payment event %s does not match payment %s", event.event_id, payment.id)
            raise
        return payment

    def _apply(self, event: PaymentEvent, payment: Payment) -> Result:
        succeeded = event.type == ASYNC_SUCCEEDED or (event.type == SESSION_COMPLETED and event.paid)
        if succeeded:
            if self._payments.has_other_completed_deposit(payment.project_id, exclude=payment.id):
                logger.error("Project %s already has a completed deposit", payment.project_id)
                raise ConflictError("This project already has a completed deposit.")
            payment.complete(self._now())
            return "completed"
        if event.type == SESSION_COMPLETED:
            return "pending"  # an asynchronous method; the outcome arrives in a later event
        if payment.status is PaymentStatus.COMPLETED:
            logger.info("Ignoring late %s for completed payment %s", event.type, payment.id)
            return "ignored"
        payment.fail()
        return "failed"
