from datetime import UTC, datetime
from uuid import uuid4

import pytest

from nextnode.domain.errors import InvalidStateTransitionError, ValidationError
from nextnode.domain.payments import (
    Payment,
    PaymentMismatchError,
    PaymentStatus,
    PaymentType,
    deposit_for,
)
from nextnode.domain.projects import MIN_PROJECT_BUDGET_CENTS, ensure_meets_minimum_budget

NOW = datetime(2026, 10, 28, tzinfo=UTC)


def make_payment(**overrides) -> Payment:
    fields = {
        "id": uuid4(),
        "project_id": 1,
        "offer_version_id": 1,
        "type": PaymentType.DEPOSIT,
        "amount_cents": 30_000,
        "currency": "cad",
        "checkout_session_id": "cs_test_1",
    }
    return Payment(**{**fields, **overrides})


@pytest.mark.parametrize(
    ("total", "expected"),
    [
        (1_000_000, 200_000),  # CAD 10,000.00 -> CAD 2,000.00
        (150_000, 30_000),  # CAD 1,500.00 -> CAD 300.00
        (150_003, 30_001),  # 30,000.6 cents rounds up
        (150_002, 30_000),  # 30,000.4 cents rounds down
    ],
)
def test_deposit_is_twenty_percent_in_whole_cents(total, expected):
    assert deposit_for(total, 20) == expected


def test_half_a_cent_rounds_up():
    # 150,005 * 30 % = 45,001.5 cents
    assert deposit_for(150_005, 30) == 45_002


def test_deposit_percent_is_a_parameter():
    assert deposit_for(1_000_000, 25) == 250_000


@pytest.mark.parametrize("percent", [0, 101, -5])
def test_deposit_percent_must_be_between_1_and_100(percent):
    with pytest.raises(ValidationError, match="between 1 and 100"):
        deposit_for(1_000_000, percent)


def test_deposit_refuses_totals_below_the_minimum_budget():
    with pytest.raises(ValidationError, match=r"at least CAD 1,500\.00; this one is CAD 1,499\.99") as exc:
        deposit_for(MIN_PROJECT_BUDGET_CENTS - 1, 20)
    assert exc.value.fields == {"total": ["Must be at least CAD 1,500.00."]}


def test_minimum_budget_accepts_exactly_the_minimum_and_names_the_field():
    ensure_meets_minimum_budget(MIN_PROJECT_BUDGET_CENTS)
    with pytest.raises(ValidationError) as exc:
        ensure_meets_minimum_budget(0, field="budget")
    assert "budget" in exc.value.fields


def test_pending_payment_completes_once_and_stays_completed():
    payment = make_payment()
    payment.complete(NOW)
    payment.complete(datetime(2027, 1, 1, tzinfo=UTC))
    assert payment.status is PaymentStatus.COMPLETED
    assert payment.completed_at == NOW


def test_completed_payment_never_fails():
    payment = make_payment()
    payment.complete(NOW)
    with pytest.raises(InvalidStateTransitionError):
        payment.fail()
    assert payment.status is PaymentStatus.COMPLETED


def test_failed_payment_cannot_complete():
    payment = make_payment()
    payment.fail()
    payment.fail()
    with pytest.raises(InvalidStateTransitionError):
        payment.complete(NOW)
    assert payment.status is PaymentStatus.FAILED


@pytest.mark.parametrize(
    "event",
    [
        {"amount_cents": 29_999, "currency": "cad", "checkout_session_id": "cs_test_1"},
        {"amount_cents": 30_000, "currency": "usd", "checkout_session_id": "cs_test_1"},
        {"amount_cents": 30_000, "currency": "cad", "checkout_session_id": "cs_test_other"},
    ],
)
def test_mismatched_amount_currency_or_session_is_refused(event):
    with pytest.raises(PaymentMismatchError):
        make_payment().ensure_matches(**event)


def test_matching_event_passes_and_currency_case_is_ignored():
    make_payment().ensure_matches(amount_cents=30_000, currency="CAD", checkout_session_id="cs_test_1")
