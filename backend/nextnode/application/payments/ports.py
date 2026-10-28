"""Payment ports. ``StripeGateway`` and the Django repositories implement them;
tests use in-memory fakes."""

from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from nextnode.domain.payments import Payment


class InvalidWebhookError(Exception):
    """The webhook cannot be trusted (missing or bad signature, unreadable
    body). Nothing is changed. The message is safe to show."""


class PaymentsUnavailableError(Exception):
    """Payments are not configured in this environment."""


@dataclass(frozen=True)
class CheckoutRequest:
    payment_id: UUID
    amount_cents: int
    currency: str
    description: str
    success_url: str
    cancel_url: str


@dataclass(frozen=True)
class CheckoutSession:
    id: str
    url: str


@dataclass(frozen=True)
class PaymentEvent:
    """A verified provider event, reduced to what the use cases need."""

    event_id: str
    type: str
    checkout_session_id: str
    payment_id: str | None
    amount_cents: int | None
    currency: str | None
    paid: bool


class PaymentGateway(Protocol):
    def create_checkout_session(self, request: CheckoutRequest) -> CheckoutSession: ...

    def parse_event(self, payload: bytes, signature: str | None) -> PaymentEvent:
        """Verify the signature, then parse. Raises ``InvalidWebhookError``."""
        ...


class PaymentRepository(Protocol):
    def get_for_update(self, payment_id: UUID) -> Payment | None: ...

    def save(self, payment: Payment) -> None: ...

    def has_other_completed_deposit(self, project_id: int, exclude: UUID) -> bool: ...


class WebhookEventLog(Protocol):
    def record(self, event_id: str, event_type: str) -> bool:
        """Store the event id. False if it was already stored (a replay)."""
        ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]:
        """Everything inside commits together or not at all."""
        ...
