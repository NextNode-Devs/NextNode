"""CI's ``PaymentGateway`` for the end-to-end deposit run (docs/proposals/ci.md).

Only ``STRIPE_FAKE_CHECKOUT`` selects it, and ``config.env`` refuses that in
production. Checkout skips Stripe: the session's URL is the success page, as
if the client had paid and been sent back. Nothing is confirmed by that: the
project starts only when a webhook signed with ``STRIPE_WEBHOOK_SECRET``
arrives, checked exactly as Stripe's would be.
"""

from __future__ import annotations

from nextnode.application.payments.ports import CheckoutRequest, CheckoutSession, PaymentEvent
from nextnode.infrastructure.payments.stripe_gateway import parse_signed_event

SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}"


class FakeCheckoutGateway:
    def __init__(self, webhook_secret: str) -> None:
        self._webhook_secret = webhook_secret
        # One server process in tests; the session only has to outlive a reuse check.
        self._sessions: dict[str, CheckoutSession] = {}

    def create_checkout_session(self, request: CheckoutRequest) -> CheckoutSession:
        session_id = f"cs_fake_{request.payment_id.hex}"
        url = request.success_url.replace(SESSION_PLACEHOLDER, session_id)
        session = CheckoutSession(id=session_id, url=url, status="open")
        self._sessions[session_id] = session
        return session

    def retrieve_checkout_session(self, session_id: str) -> CheckoutSession:
        # Unknown after a server restart: treat it as closed so a new one is made.
        return self._sessions.get(session_id) or CheckoutSession(id=session_id, url="", status="expired")

    def expire_checkout_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def parse_event(self, payload: bytes, signature: str | None) -> PaymentEvent:
        return parse_signed_event(payload, signature, self._webhook_secret)
