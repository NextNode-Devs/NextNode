"""StripeGateway against locally signed payloads and a stub client. No network."""

import time
from types import SimpleNamespace
from uuid import uuid4

import pytest

from nextnode.application.payments.ports import CheckoutRequest, InvalidWebhookError
from nextnode.infrastructure.payments.stripe_gateway import StripeGateway
from tests.stripe_helpers import TEST_WEBHOOK_SECRET, checkout_event, sign


class StubSessions:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def create(self, params, options):
        self.calls.append({"params": params, "options": options})
        return SimpleNamespace(id="cs_test_new", url="https://checkout.stripe.com/c/pay/cs_test_new")


@pytest.fixture
def sessions() -> StubSessions:
    return StubSessions()


@pytest.fixture
def gateway(sessions) -> StripeGateway:
    client = SimpleNamespace(v1=SimpleNamespace(checkout=SimpleNamespace(sessions=sessions)))
    return StripeGateway("sk_test_unused", TEST_WEBHOOK_SECRET, client=client)


def test_verified_event_is_parsed(gateway):
    payment_id = str(uuid4())
    payload = checkout_event(payment_id, amount=200_000)
    event = gateway.parse_event(payload, sign(payload))
    assert (event.event_id, event.type, event.checkout_session_id) == (
        "evt_test_1",
        "checkout.session.completed",
        "cs_test_1",
    )
    assert (event.payment_id, event.amount_cents, event.currency, event.paid) == (
        payment_id,
        200_000,
        "cad",
        True,
    )


@pytest.mark.parametrize(
    "signature",
    [
        None,
        "",
        "t=1,v1=deadbeef",
        "garbage",
    ],
)
def test_missing_or_malformed_signature_is_rejected(gateway, signature):
    with pytest.raises(InvalidWebhookError, match="signature"):
        gateway.parse_event(checkout_event("p"), signature)


def test_signature_from_another_secret_is_rejected(gateway):
    payload = checkout_event("p")
    with pytest.raises(InvalidWebhookError):
        gateway.parse_event(payload, sign(payload, secret="whsec_someone_else"))


def test_tampered_payload_is_rejected(gateway):
    signature = sign(checkout_event("p", amount=30_000))
    with pytest.raises(InvalidWebhookError):
        gateway.parse_event(checkout_event("p", amount=1), signature)


def test_old_signature_is_rejected(gateway):
    payload = checkout_event("p")
    with pytest.raises(InvalidWebhookError):
        gateway.parse_event(payload, sign(payload, timestamp=int(time.time()) - 3600))


def test_signed_but_unreadable_event_is_rejected(gateway):
    payload = b'{"id": "evt_1"}'
    with pytest.raises(InvalidWebhookError, match="could not be read"):
        gateway.parse_event(payload, sign(payload))


def test_checkout_session_is_created_in_cad_with_payment_metadata_and_idempotency(gateway, sessions):
    payment_id = uuid4()
    session = gateway.create_checkout_session(
        CheckoutRequest(
            payment_id=payment_id,
            amount_cents=30_000,
            currency="cad",
            description="Project deposit (test mode)",
            success_url="http://localhost:3000/projects/7/deposit/success",
            cancel_url="http://localhost:3000/projects/7/deposit/cancel",
        )
    )
    assert session.id == "cs_test_new"
    [call] = sessions.calls
    params = call["params"]
    assert params["mode"] == "payment"
    assert params["line_items"][0]["price_data"]["currency"] == "cad"
    assert params["line_items"][0]["price_data"]["unit_amount"] == 30_000
    assert params["metadata"] == {"payment_id": str(payment_id)}
    assert params["success_url"].endswith("/deposit/success")
    assert call["options"] == {"idempotency_key": f"deposit-checkout-{payment_id}"}
