"""Stripe adapter for ``PaymentGateway``. The only module that imports the SDK.

Test mode only in Phase 1 (``config.env`` refuses live keys outside
production). Keys are backend-only and never logged.
"""

from __future__ import annotations

import json
from typing import Any

import stripe

from nextnode.application.payments.ports import (
    CheckoutRequest,
    CheckoutSession,
    InvalidWebhookError,
    PaymentEvent,
    PaymentsUnavailableError,
)

SIGNATURE_TOLERANCE_SECONDS = 300


class StripeGateway:
    def __init__(self, secret_key: str, webhook_secret: str, client: Any = None) -> None:
        self._webhook_secret = webhook_secret
        self._client = client or stripe.StripeClient(secret_key)

    def create_checkout_session(self, request: CheckoutRequest) -> CheckoutSession:
        session = self._client.v1.checkout.sessions.create(
            params={
                "mode": "payment",
                "line_items": [
                    {
                        "quantity": 1,
                        "price_data": {
                            "currency": request.currency,
                            "unit_amount": request.amount_cents,
                            "product_data": {"name": request.description},
                        },
                    }
                ],
                "client_reference_id": str(request.payment_id),
                "metadata": {"payment_id": str(request.payment_id)},
                "payment_intent_data": {"metadata": {"payment_id": str(request.payment_id)}},
                "success_url": request.success_url,
                "cancel_url": request.cancel_url,
            },
            # Retrying the same payment never creates a second session.
            options={"idempotency_key": f"deposit-checkout-{request.payment_id}"},
        )
        return CheckoutSession(id=session.id, url=session.url)

    def parse_event(self, payload: bytes, signature: str | None) -> PaymentEvent:
        try:
            stripe.WebhookSignature.verify_header(
                payload.decode("utf-8"), signature or "", self._webhook_secret, SIGNATURE_TOLERANCE_SECONDS
            )
        except (stripe.SignatureVerificationError, UnicodeDecodeError) as exc:
            raise InvalidWebhookError("The Stripe signature is missing or invalid.") from exc
        try:
            event = json.loads(payload)
            session = event["data"]["object"]
            return PaymentEvent(
                event_id=str(event["id"]),
                type=str(event["type"]),
                checkout_session_id=str(session.get("id", "")),
                payment_id=(session.get("metadata") or {}).get("payment_id"),
                amount_cents=session.get("amount_total"),
                currency=session.get("currency"),
                paid=session.get("payment_status") == "paid",
            )
        except (ValueError, KeyError, TypeError, AttributeError) as exc:
            raise InvalidWebhookError("The Stripe event could not be read.") from exc


class UnconfiguredPaymentGateway:
    """Used when STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set."""

    def create_checkout_session(self, request: CheckoutRequest) -> CheckoutSession:
        raise PaymentsUnavailableError("Payments are not configured on this server.")

    def parse_event(self, payload: bytes, signature: str | None) -> PaymentEvent:
        raise PaymentsUnavailableError("Payments are not configured on this server.")
