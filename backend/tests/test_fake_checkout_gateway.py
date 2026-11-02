"""CI's checkout stand-in: no Stripe call, but webhooks are verified like Stripe's."""

from uuid import uuid4

import pytest

from nextnode.application.payments.ports import CheckoutRequest, InvalidWebhookError
from nextnode.infrastructure.payments.fake_checkout import FakeCheckoutGateway
from tests.stripe_helpers import TEST_WEBHOOK_SECRET, checkout_event, sign


def request() -> CheckoutRequest:
    return CheckoutRequest(
        payment_id=uuid4(),
        amount_cents=200_000,
        currency="cad",
        description="Deposit (20%): Shop",
        success_url="http://app.test/projects/7/deposit/return?session_id={CHECKOUT_SESSION_ID}",
        cancel_url="http://app.test/projects/7/deposit/cancelled",
    )


def test_checkout_returns_straight_to_the_success_page_and_is_reused_while_open():
    gateway = FakeCheckoutGateway(TEST_WEBHOOK_SECRET)
    session = gateway.create_checkout_session(request())
    assert session.id.startswith("cs_fake_") and session.status == "open"
    assert session.url == f"http://app.test/projects/7/deposit/return?session_id={session.id}"
    assert gateway.retrieve_checkout_session(session.id) == session


def test_an_expired_or_unknown_session_is_not_open():
    gateway = FakeCheckoutGateway(TEST_WEBHOOK_SECRET)
    session = gateway.create_checkout_session(request())
    gateway.expire_checkout_session(session.id)
    assert gateway.retrieve_checkout_session(session.id).status == "expired"
    assert gateway.retrieve_checkout_session("cs_fake_unknown").status == "expired"


def test_a_signed_event_is_parsed():
    payload = checkout_event("pay-1", amount=200_000)
    event = FakeCheckoutGateway(TEST_WEBHOOK_SECRET).parse_event(payload, sign(payload))
    assert (event.type, event.payment_id, event.amount_cents, event.paid) == (
        "checkout.session.completed",
        "pay-1",
        200_000,
        True,
    )


@pytest.mark.parametrize("signature", [None, "t=1,v1=bad", sign(b"{}", "whsec_other")])
def test_a_missing_or_wrong_signature_is_refused(signature):
    with pytest.raises(InvalidWebhookError):
        FakeCheckoutGateway(TEST_WEBHOOK_SECRET).parse_event(checkout_event("pay-1"), signature)
