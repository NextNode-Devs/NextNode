"""HandlePaymentWebhook with in-memory fakes: no database, no Stripe."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from nextnode.application.payments.ports import InvalidWebhookError, PaymentEvent
from nextnode.application.payments.webhook import HandlePaymentWebhook
from nextnode.domain.errors import ConflictError, InvalidStateTransitionError
from nextnode.domain.payments import Payment, PaymentMismatchError, PaymentStatus, PaymentType
from tests.payment_fakes import (
    FakeEvents,
    FakeGateway,
    FakePayments,
    FakeProjects,
    FakeUnitOfWork,
    InMemoryStore,
)

NOW = datetime(2026, 10, 28, 12, tzinfo=UTC)


@pytest.fixture
def store() -> InMemoryStore:
    return InMemoryStore()


@pytest.fixture
def gateway() -> FakeGateway:
    return FakeGateway()


@pytest.fixture
def projects() -> FakeProjects:
    return FakeProjects()


@pytest.fixture
def handle(store, gateway, projects) -> HandlePaymentWebhook:
    return HandlePaymentWebhook(
        gateway, FakePayments(store), FakeEvents(store), FakeUnitOfWork(store), projects, now=lambda: NOW
    )


def add_payment(store: InMemoryStore, **overrides) -> Payment:
    payment = Payment(
        **{
            "id": uuid4(),
            "project_id": 7,
            "offer_version_id": 3,
            "type": PaymentType.DEPOSIT,
            "amount_cents": 30_000,
            "currency": "cad",
            "checkout_session_id": "cs_test_1",
            **overrides,
        }
    )
    store.payments[payment.id] = payment
    return payment


def event(payment: Payment | None, **overrides) -> PaymentEvent:
    fields = {
        "event_id": "evt_1",
        "type": "checkout.session.completed",
        "checkout_session_id": "cs_test_1",
        "payment_id": str(payment.id) if payment else None,
        "amount_cents": 30_000,
        "currency": "cad",
        "paid": True,
    }
    return PaymentEvent(**{**fields, **overrides})


def status_of(store, payment) -> PaymentStatus:
    return store.payments[payment.id].status


def test_paid_checkout_completes_the_payment(handle, store, gateway):
    payment = add_payment(store)
    gateway.next_event = event(payment)
    outcome = handle.execute(b"{}", "valid")
    assert (outcome.result, outcome.payment_id) == ("completed", str(payment.id))
    assert status_of(store, payment) is PaymentStatus.COMPLETED
    assert store.payments[payment.id].completed_at == NOW


def test_invalid_signature_changes_nothing(handle, store, gateway):
    payment = add_payment(store)
    gateway.next_event = event(payment)
    for signature in (None, "forged"):
        with pytest.raises(InvalidWebhookError):
            handle.execute(b"{}", signature)
    assert status_of(store, payment) is PaymentStatus.PENDING
    assert store.events == set()


def test_replayed_event_is_processed_once(handle, store, gateway):
    payment = add_payment(store)
    gateway.next_event = event(payment)
    handle.execute(b"{}", "valid")
    store.payments[payment.id].completed_at = None  # would be re-set if processed again
    assert handle.execute(b"{}", "valid").result == "duplicate"
    assert store.payments[payment.id].completed_at is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"amount_cents": 1},
        {"currency": "usd"},
        {"checkout_session_id": "cs_test_someone_else"},
        {"payment_id": str(uuid4())},
        {"payment_id": "not-a-uuid"},
        {"payment_id": None},
        {"amount_cents": None},
    ],
)
def test_mismatched_event_is_rejected_and_not_recorded(handle, store, gateway, overrides):
    payment = add_payment(store)
    gateway.next_event = event(payment, **overrides)
    with pytest.raises(PaymentMismatchError):
        handle.execute(b"{}", "valid")
    assert status_of(store, payment) is PaymentStatus.PENDING
    assert store.events == set()  # a corrected redelivery can still be processed


def test_unpaid_completed_session_waits_for_the_async_result(handle, store, gateway):
    payment = add_payment(store)
    gateway.next_event = event(payment, paid=False)
    assert handle.execute(b"{}", "valid").result == "pending"
    assert status_of(store, payment) is PaymentStatus.PENDING

    gateway.next_event = event(payment, event_id="evt_2", type="checkout.session.async_payment_succeeded")
    assert handle.execute(b"{}", "valid").result == "completed"
    assert status_of(store, payment) is PaymentStatus.COMPLETED


@pytest.mark.parametrize("event_type", ["checkout.session.async_payment_failed", "checkout.session.expired"])
def test_failed_or_expired_session_fails_a_pending_payment(handle, store, gateway, event_type):
    payment = add_payment(store)
    gateway.next_event = event(payment, type=event_type, paid=False)
    assert handle.execute(b"{}", "valid").result == "failed"
    assert status_of(store, payment) is PaymentStatus.FAILED


def test_completed_payment_never_reverts_on_a_late_event(handle, store, gateway):
    payment = add_payment(store)
    gateway.next_event = event(payment)
    handle.execute(b"{}", "valid")
    gateway.next_event = event(payment, event_id="evt_late", type="checkout.session.expired", paid=False)
    assert handle.execute(b"{}", "valid").result == "ignored"
    assert status_of(store, payment) is PaymentStatus.COMPLETED


def test_paid_event_for_a_failed_payment_is_refused(handle, store, gateway):
    payment = add_payment(store, status=PaymentStatus.FAILED)
    gateway.next_event = event(payment)
    with pytest.raises(InvalidStateTransitionError):
        handle.execute(b"{}", "valid")
    assert store.events == set()


def test_a_project_gets_only_one_completed_deposit(handle, store, gateway):
    add_payment(store, status=PaymentStatus.COMPLETED, checkout_session_id="cs_test_0")
    second = add_payment(store)
    gateway.next_event = event(second)
    with pytest.raises(ConflictError, match="already has a completed deposit"):
        handle.execute(b"{}", "valid")
    assert status_of(store, second) is PaymentStatus.PENDING


def test_unhandled_event_types_are_recorded_and_ignored(handle, store, gateway):
    gateway.next_event = event(None, type="customer.created")
    assert handle.execute(b"{}", "valid").result == "ignored"
    assert store.events == {"evt_1"}


def test_confirmed_deposit_starts_the_project_once(handle, store, gateway, projects):
    payment = add_payment(store)
    gateway.next_event = event(payment)
    handle.execute(b"{}", "valid")
    assert projects.started == [(7, 3)]

    handle.execute(b"{}", "valid")  # replay
    gateway.next_event = event(payment, event_id="evt_2", type="checkout.session.async_payment_succeeded")
    handle.execute(b"{}", "valid")  # a second success event for the same payment
    assert projects.started == [(7, 3)]


@pytest.mark.parametrize(
    "overrides",
    [
        {"paid": False},
        {"type": "checkout.session.async_payment_failed", "paid": False},
        {"type": "checkout.session.expired", "paid": False},
    ],
)
def test_unpaid_failed_or_expired_events_start_nothing(handle, store, gateway, projects, overrides):
    payment = add_payment(store)
    gateway.next_event = event(payment, **overrides)
    handle.execute(b"{}", "valid")
    assert projects.started == []


def test_a_failed_start_rolls_the_payment_back_so_stripe_retries(handle, store, gateway, projects):
    payment = add_payment(store)
    gateway.next_event = event(payment)
    projects.fail_start = True
    with pytest.raises(RuntimeError):
        handle.execute(b"{}", "valid")
    assert status_of(store, payment) is PaymentStatus.PENDING
    assert store.events == set()

    projects.fail_start = False
    assert handle.execute(b"{}", "valid").result == "completed"  # Stripe's retry
    assert projects.started == [(7, 3)]
