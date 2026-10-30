"""The webhook endpoint end to end: real signature check (generated test
secret), real PostgreSQL, no Stripe account."""

from uuid import uuid4

import pytest
from django.db import IntegrityError, transaction

from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.payments.pending_dependencies import ProjectsNotReady
from nextnode.infrastructure.payments.stripe_gateway import StripeGateway, UnconfiguredPaymentGateway
from nextnode.infrastructure.persistence.models import PaymentModel, StripeEventModel
from tests.payment_fakes import FakeProjects
from tests.stripe_helpers import TEST_WEBHOOK_SECRET, checkout_event, sign

URL = "/api/payments/stripe/webhook/"
pytestmark = pytest.mark.django_db


@pytest.fixture
def projects() -> FakeProjects:
    return FakeProjects()


@pytest.fixture(autouse=True)
def stripe_gateway(projects):
    with override_container(
        payment_gateway=StripeGateway("sk_test_unused", TEST_WEBHOOK_SECRET), project_starter=projects
    ):
        yield


@pytest.fixture
def payment() -> PaymentModel:
    return PaymentModel.objects.create(
        project_id=7,
        offer_version_id=3,
        type="deposit",
        amount_cents=30_000,
        currency="cad",
        checkout_session_id="cs_test_1",
    )


def post(api, payload: bytes, signature: str | None = "sign"):
    headers = {}
    if signature == "sign":
        headers["HTTP_STRIPE_SIGNATURE"] = sign(payload)
    elif signature is not None:
        headers["HTTP_STRIPE_SIGNATURE"] = signature
    return api.post(URL, data=payload, content_type="application/json", **headers)


def test_signed_paid_event_completes_the_payment(api, payment):
    response = post(api, checkout_event(str(payment.id)))
    assert response.status_code == 200
    assert response.json()["data"] == {
        "event_id": "evt_test_1",
        "result": "completed",
        "payment_id": str(payment.id),
    }
    payment.refresh_from_db()
    assert payment.status == "completed" and payment.completed_at is not None


def test_confirmed_deposit_starts_the_project(api, payment, projects):
    post(api, checkout_event(str(payment.id)))
    assert projects.started == [(7, 3)]


def test_without_the_start_gate_a_paid_event_is_refused_and_changes_nothing(api, payment):
    """Until #6 merges, nothing can mark a deposit paid without starting the
    project; Stripe keeps retrying the event."""
    with override_container(project_starter=ProjectsNotReady()):
        response = post(api, checkout_event(str(payment.id)))
    assert response.status_code == 503
    payment.refresh_from_db()
    assert payment.status == "pending"
    assert not StripeEventModel.objects.exists()


def test_no_clerk_token_or_csrf_token_is_needed(api, payment):
    api.enforce_csrf_checks = True
    assert post(api, checkout_event(str(payment.id))).status_code == 200


@pytest.mark.parametrize("signature", [None, "t=1,v1=forged"])
def test_missing_or_invalid_signature_gets_400_and_changes_nothing(api, payment, signature):
    response = post(api, checkout_event(str(payment.id)), signature=signature)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_WEBHOOK"
    payment.refresh_from_db()
    assert payment.status == "pending"
    assert not StripeEventModel.objects.exists()


def test_replayed_event_is_processed_once(api, payment):
    payload = checkout_event(str(payment.id))
    assert post(api, payload).json()["data"]["result"] == "completed"
    second = post(api, payload)
    assert second.status_code == 200
    assert second.json()["data"]["result"] == "duplicate"
    assert StripeEventModel.objects.count() == 1


def test_mismatched_amount_is_rejected(api, payment):
    response = post(api, checkout_event(str(payment.id), amount=100))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "PAYMENT_MISMATCH"
    payment.refresh_from_db()
    assert payment.status == "pending"
    assert not StripeEventModel.objects.exists()


def test_unknown_payment_is_rejected(api, payment):
    response = post(api, checkout_event(str(uuid4())))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "PAYMENT_MISMATCH"


def test_late_expiry_does_not_revert_a_completed_payment(api, payment):
    post(api, checkout_event(str(payment.id)))
    late = checkout_event(str(payment.id), event_id="evt_test_2", type="checkout.session.expired")
    assert post(api, late).json()["data"]["result"] == "ignored"
    payment.refresh_from_db()
    assert payment.status == "completed"


def test_declined_then_expired_session_fails_the_payment(api, payment):
    payload = checkout_event(
        str(payment.id), type="checkout.session.expired", payment_status="unpaid", event_id="evt_test_3"
    )
    assert post(api, payload).json()["data"]["result"] == "failed"
    payment.refresh_from_db()
    assert payment.status == "failed"


def test_payments_unconfigured_answers_503(api, payment):
    with override_container(payment_gateway=UnconfiguredPaymentGateway()):
        response = post(api, checkout_event(str(payment.id)))
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PAYMENTS_UNAVAILABLE"


def test_database_allows_one_completed_deposit_per_project(payment):
    PaymentModel.objects.filter(id=payment.id).update(status="completed")
    with pytest.raises(IntegrityError), transaction.atomic():
        PaymentModel.objects.create(
            project_id=7,
            offer_version_id=4,
            type="deposit",
            amount_cents=30_000,
            currency="cad",
            status="completed",
        )


@pytest.mark.parametrize(("field", "value"), [("currency", "usd"), ("amount_cents", 0)])
def test_database_refuses_non_cad_or_zero_payments(field, value):
    fields = {
        "project_id": 1,
        "offer_version_id": 1,
        "type": "deposit",
        "amount_cents": 100,
        "currency": "cad",
    }
    with pytest.raises(IntegrityError), transaction.atomic():
        PaymentModel.objects.create(**{**fields, field: value})
