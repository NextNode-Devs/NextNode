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
    status: str = "open"  # Stripe's session status: open | complete | expired


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

    def retrieve_checkout_session(self, session_id: str) -> CheckoutSession: ...

    def expire_checkout_session(self, session_id: str) -> None:
        """Close an open session so it can no longer be paid."""
        ...

    def parse_event(self, payload: bytes, signature: str | None) -> PaymentEvent:
        """Verify the signature, then parse. Raises ``InvalidWebhookError``."""
        ...


class PaymentRepository(Protocol):
    def get_for_update(self, payment_id: UUID) -> Payment | None: ...

    def save(self, payment: Payment) -> None: ...

    def has_other_completed_deposit(self, project_id: int, exclude: UUID) -> bool: ...

    def current_deposit(self, project_id: int) -> Payment | None:
        """The completed deposit if there is one, otherwise the most recent."""
        ...


class WebhookEventLog(Protocol):
    def record(self, event_id: str, event_type: str) -> bool:
        """Store the event id. False if it was already stored (a replay)."""
        ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]:
        """Everything inside commits together or not at all."""
        ...


@dataclass(frozen=True)
class DepositTerms:
    """What checkout needs to know about a project. Provided by #6 (accepted
    offer, ``Assigned``) on top of #3 (``Project``)."""

    project_id: int
    title: str
    client_user_id: str  # the owning client's Clerk user id
    is_client_project: bool
    is_assigned: bool  # the client accepted the Team Lead's offer
    offer_version_id: int | None
    accepted_total_cents: int | None


class DepositTermsSource(Protocol):
    def get_for_update(self, project_id: int) -> DepositTerms | None:
        """Locks the project until the transaction ends, so two checkouts for
        the same project run one after the other."""
        ...


class ProjectStarter(Protocol):
    def start_client_project(self, project_id: int, offer_version_id: int) -> None:
        """#6's start use case: team ``Locked -> Active``, project
        ``Assigned -> InProgress``, workspace chat created. Runs inside the
        webhook's transaction; raising rolls the payment change back."""
        ...
