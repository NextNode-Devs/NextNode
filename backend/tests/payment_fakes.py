"""In-memory fakes for the payment ports: no database, no Stripe."""

import copy
from contextlib import contextmanager
from dataclasses import replace
from uuid import UUID

from nextnode.application.payments.ports import (
    CheckoutRequest,
    CheckoutSession,
    DepositTerms,
    InvalidWebhookError,
    PaymentEvent,
    PaymentsUnavailableError,
)
from nextnode.domain.payments import Payment, PaymentStatus


class FakeGateway:
    """Returns the event it is given; a bad signature raises like the real one."""

    def __init__(self) -> None:
        self.next_event: PaymentEvent | None = None
        self.created: list[CheckoutRequest] = []
        self.sessions: dict[str, CheckoutSession] = {}
        self.expired: list[str] = []

    def parse_event(self, payload: bytes, signature: str | None) -> PaymentEvent:
        if signature != "valid":
            raise InvalidWebhookError("The Stripe signature is missing or invalid.")
        assert self.next_event is not None
        return self.next_event

    def create_checkout_session(self, request: CheckoutRequest) -> CheckoutSession:
        self.created.append(request)
        session = CheckoutSession(f"cs_test_{len(self.created)}", f"https://stripe.test/{len(self.created)}")
        self.sessions[session.id] = session
        return session

    def retrieve_checkout_session(self, session_id: str) -> CheckoutSession:
        return self.sessions[session_id]

    def expire_checkout_session(self, session_id: str) -> None:
        self.expired.append(session_id)
        self.sessions[session_id] = replace(self.sessions[session_id], status="expired")


class InMemoryStore:
    def __init__(self) -> None:
        self.payments: dict[UUID, Payment] = {}
        self.events: set[str] = set()


class FakePayments:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def get_for_update(self, payment_id: UUID) -> Payment | None:
        payment = self.store.payments.get(payment_id)
        return copy.deepcopy(payment) if payment else None

    def save(self, payment: Payment) -> None:
        self.store.payments[payment.id] = copy.deepcopy(payment)

    def has_other_completed_deposit(self, project_id: int, exclude: UUID) -> bool:
        return any(
            p.project_id == project_id and p.status is PaymentStatus.COMPLETED and p.id != exclude
            for p in self.store.payments.values()
        )

    def current_deposit(self, project_id: int) -> Payment | None:
        deposits = [p for p in self.store.payments.values() if p.project_id == project_id]
        completed = [p for p in deposits if p.status is PaymentStatus.COMPLETED]
        found = (completed or deposits[-1:] or [None])[0]  # dicts keep insertion order
        return copy.deepcopy(found) if found else None


class FakeEvents:
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    def record(self, event_id: str, event_type: str) -> bool:
        if event_id in self.store.events:
            return False
        self.store.events.add(event_id)
        return True


class FakeUnitOfWork:
    """Rolls the store back when the block raises, like a database transaction."""

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store

    @contextmanager
    def atomic(self):
        snapshot = copy.deepcopy(self.store.__dict__)
        try:
            yield
        except BaseException:
            self.store.__dict__ = snapshot
            raise


class FakeProjects:
    """Stands in for #6: deposit terms per project, and a record of starts."""

    def __init__(self) -> None:
        self.terms: dict[int, DepositTerms] = {}
        self.started: list[tuple[int, int]] = []
        self.fail_start = False

    def get_for_update(self, project_id: int) -> DepositTerms | None:
        return self.terms.get(project_id)

    def start_client_project(self, project_id: int, offer_version_id: int) -> None:
        if self.fail_start:
            raise RuntimeError("start refused")
        self.started.append((project_id, offer_version_id))


class UnavailableProjects:
    """Projects or the start gate cannot be reached (e.g. the database is down)."""

    MESSAGE = "Projects are unavailable right now."

    def get_for_update(self, project_id: int) -> DepositTerms | None:
        raise PaymentsUnavailableError(self.MESSAGE)

    def start_client_project(self, project_id: int, offer_version_id: int) -> None:
        raise PaymentsUnavailableError(self.MESSAGE)
