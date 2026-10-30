"""Stripe adapter for ``PaymentGateway``. The only module that imports the SDK.

Test mode only in Phase 1 (``config.env`` refuses live keys outside
production). Keys are backend-only and never logged.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import stripe

from nextnode.application.payments.ports import (
    CheckoutRequest,
    CheckoutSession,
    InvalidWebhookError,
    PaymentEvent,
    PaymentsUnavailableError,
)
from nextnode.domain.errors import ConflictError

logger = logging.getLogger(__name__)

SIGNATURE_TOLERANCE_SECONDS = 300
# Tags deposit sessions in the Stripe Dashboard (fixed label + 8 random letters).
INTEGRATION_IDENTIFIER = "nextnode-deposit-qkvrmtzh"


@contextmanager
def _stripe_errors(action: str) -> Iterator[None]:
    """Stripe failures reach the client as 503 without Stripe's message, which
    can name request details; the type and request id are logged instead."""
    try:
        yield
    except stripe.StripeError as exc:
        logger.warning("Stripe %s failed: %s (request %s)", action, type(exc).__name__, exc.request_id)
        raise PaymentsUnavailableError("Stripe could not be reached. Try again in a moment.") from exc


class StripeGateway:
    def __init__(self, secret_key: str, webhook_secret: str, client: Any = None) -> None:
        self._webhook_secret = webhook_secret
        self._client = client or stripe.StripeClient(secret_key)

    def create_checkout_session(self, request: CheckoutRequest) -> CheckoutSession:
        with _stripe_errors("checkout create"):
            session = self._create(request)
        return CheckoutSession(id=session.id, url=session.url, status=session.status)

    def retrieve_checkout_session(self, session_id: str) -> CheckoutSession:
        with _stripe_errors("checkout retrieve"):
            session = self._client.v1.checkout.sessions.retrieve(session_id)
        return CheckoutSession(id=session.id, url=session.url or "", status=session.status)

    def expire_checkout_session(self, session_id: str) -> None:
        try:
            self._client.v1.checkout.sessions.expire(session_id)
        except stripe.InvalidRequestError as exc:
            # Only an open session can be expired: it was paid or closed meanwhile.
            logger.info("Checkout %s could not be expired (request %s)", session_id, exc.request_id)
            raise ConflictError(
                "This checkout changed while you were paying. Check again in a minute."
            ) from exc
        except stripe.StripeError as exc:
            logger.warning(
                "Stripe checkout expire failed: %s (request %s)", type(exc).__name__, exc.request_id
            )
            raise PaymentsUnavailableError("Stripe could not be reached. Try again in a moment.") from exc

    def _create(self, request: CheckoutRequest) -> Any:
        return self._client.v1.checkout.sessions.create(
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
                "integration_identifier": INTEGRATION_IDENTIFIER,
            },
            # Retrying the same payment never creates a second session.
            options={"idempotency_key": f"deposit-checkout-{request.payment_id}"},
        )

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

    def retrieve_checkout_session(self, session_id: str) -> CheckoutSession:
        raise PaymentsUnavailableError("Payments are not configured on this server.")

    def expire_checkout_session(self, session_id: str) -> None:
        raise PaymentsUnavailableError("Payments are not configured on this server.")

    def parse_event(self, payload: bytes, signature: str | None) -> PaymentEvent:
        raise PaymentsUnavailableError("Payments are not configured on this server.")
