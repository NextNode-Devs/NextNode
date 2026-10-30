"""StartDepositCheckout and DepositStatusQuery with in-memory fakes: no
database, no Stripe, no #6 (its terms and start are faked)."""

from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID

import pytest

from nextnode.application.payments.checkout import StartDepositCheckout
from nextnode.application.payments.ports import DepositTerms
from nextnode.application.payments.status import DepositStatusQuery
from nextnode.application.ports import Actor
from nextnode.domain.errors import (
    ConflictError,
    InvalidStateTransitionError,
    NotFoundError,
    ValidationError,
)
from nextnode.domain.payments import PaymentStatus
from tests.payment_fakes import FakeGateway, FakePayments, FakeProjects, FakeUnitOfWork, InMemoryStore

CLIENT = Actor(clerk_user_id="user_client", session_id="sess_1")


def terms(**overrides) -> DepositTerms:
    fields = {
        "project_id": 7,
        "title": "Inventory app",
        "client_user_id": CLIENT.clerk_user_id,
        "is_client_project": True,
        "is_assigned": True,
        "offer_version_id": 3,
        "accepted_total_cents": 1_000_000,
    }
    return DepositTerms(**{**fields, **overrides})


@pytest.fixture
def store() -> InMemoryStore:
    return InMemoryStore()


@pytest.fixture
def gateway() -> FakeGateway:
    return FakeGateway()


@pytest.fixture
def projects() -> FakeProjects:
    fake = FakeProjects()
    fake.terms[7] = terms()
    return fake


def checkout_with(store, gateway, projects, percent: int = 20, first_id: int = 1) -> StartDepositCheckout:
    ids = (UUID(int=n) for n in range(first_id, first_id + 10))
    return StartDepositCheckout(
        projects,
        FakePayments(store),
        gateway,
        FakeUnitOfWork(store),
        deposit_percent=percent,
        frontend_origin="http://localhost:3000/",
        new_id=lambda: next(ids),
    )


@pytest.fixture
def checkout(store, gateway, projects) -> StartDepositCheckout:
    return checkout_with(store, gateway, projects)


@pytest.mark.parametrize(("total", "deposit"), [(1_000_000, 200_000), (150_000, 30_000)])
def test_deposit_is_computed_from_the_accepted_offer(checkout, store, gateway, projects, total, deposit):
    projects.terms[7] = terms(accepted_total_cents=total)
    result = checkout.execute(CLIENT, 7)
    assert (result.amount_cents, result.currency) == (deposit, "cad")
    assert result.checkout_url == "https://stripe.test/1"
    [request] = gateway.created
    assert request.amount_cents == deposit
    assert request.success_url == (
        "http://localhost:3000/projects/7/deposit/return?session_id={CHECKOUT_SESSION_ID}"
    )
    assert request.cancel_url == "http://localhost:3000/projects/7/deposit/cancelled"
    payment = store.payments[UUID(result.payment_id)]
    assert (payment.status, payment.checkout_session_id, payment.offer_version_id) == (
        PaymentStatus.PENDING,
        "cs_test_1",
        3,
    )


def test_creating_a_checkout_starts_nothing(checkout, projects):
    checkout.execute(CLIENT, 7)
    assert projects.started == []


@pytest.mark.parametrize(
    "case",
    ["missing", "other_client", "developer_project"],
)
def test_only_the_projects_client_can_pay_and_others_get_not_found(checkout, projects, gateway, case):
    if case == "missing":
        projects.terms.clear()
    elif case == "other_client":
        projects.terms[7] = terms(client_user_id="user_someone_else")
    else:
        projects.terms[7] = terms(is_client_project=False, offer_version_id=None, accepted_total_cents=None)
    with pytest.raises(NotFoundError):
        checkout.execute(CLIENT, 7)
    assert gateway.created == []


def test_project_must_be_assigned(checkout, projects, gateway):
    projects.terms[7] = terms(is_assigned=False)
    with pytest.raises(InvalidStateTransitionError, match="accepted the Team Lead's offer"):
        checkout.execute(CLIENT, 7)
    assert gateway.created == []


def test_total_below_the_minimum_budget_is_refused(checkout, projects, gateway):
    projects.terms[7] = terms(accepted_total_cents=149_999)
    with pytest.raises(ValidationError, match=r"at least CAD 1,500\.00"):
        checkout.execute(CLIENT, 7)
    assert gateway.created == []


def test_an_open_session_is_reused(checkout, gateway):
    first = checkout.execute(CLIENT, 7)
    second = checkout.execute(CLIENT, 7)
    assert second == first
    assert len(gateway.created) == 1


def test_an_expired_session_gets_a_new_payment(checkout, store, gateway):
    first = checkout.execute(CLIENT, 7)
    gateway.sessions["cs_test_1"] = replace(gateway.sessions["cs_test_1"], status="expired")
    second = checkout.execute(CLIENT, 7)
    assert second.payment_id != first.payment_id
    assert store.payments[UUID(first.payment_id)].status is PaymentStatus.FAILED
    assert gateway.expired == []


def test_a_changed_deposit_percent_closes_the_old_session(store, gateway, projects):
    checkout_with(store, gateway, projects, percent=20).execute(CLIENT, 7)
    result = checkout_with(store, gateway, projects, percent=25, first_id=50).execute(CLIENT, 7)
    assert result.amount_cents == 250_000
    assert gateway.expired == ["cs_test_1"]
    assert [p.status for p in store.payments.values()] == [PaymentStatus.FAILED, PaymentStatus.PENDING]


def test_a_paid_session_awaiting_its_webhook_is_not_replaced(checkout, gateway):
    checkout.execute(CLIENT, 7)
    gateway.sessions["cs_test_1"] = replace(gateway.sessions["cs_test_1"], status="complete")
    with pytest.raises(ConflictError, match="being confirmed"):
        checkout.execute(CLIENT, 7)
    assert len(gateway.created) == 1


def test_no_second_deposit_after_one_is_completed(checkout, store, gateway):
    first = checkout.execute(CLIENT, 7)
    store.payments[UUID(first.payment_id)].status = PaymentStatus.COMPLETED
    with pytest.raises(ConflictError, match="already paid"):
        checkout.execute(CLIENT, 7)
    assert len(gateway.created) == 1


def test_deposit_status_reports_none_pending_and_completed(checkout, store):
    status = DepositStatusQuery(FakePayments(store))
    assert status.execute(7).status == "none"

    first = checkout.execute(CLIENT, 7)
    assert (status.execute(7).status, status.execute(7).amount_cents) == ("pending", 200_000)

    payment = store.payments[UUID(first.payment_id)]
    payment.complete(datetime(2026, 10, 28, tzinfo=UTC))
    result = status.execute(7)
    assert result.confirmed and result.completed_at is not None
