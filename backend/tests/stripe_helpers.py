"""Builds Stripe-shaped webhook payloads signed with a generated test secret,
the way Stripe signs them. No network, no real Stripe account."""

import hashlib
import hmac
import json
import time

TEST_WEBHOOK_SECRET = "whsec_generated_for_tests"


def checkout_event(
    payment_id: str,
    *,
    event_id: str = "evt_test_1",
    type: str = "checkout.session.completed",
    session_id: str = "cs_test_1",
    amount: int = 30_000,
    currency: str = "cad",
    payment_status: str = "paid",
) -> bytes:
    return json.dumps(
        {
            "id": event_id,
            "object": "event",
            "type": type,
            "data": {
                "object": {
                    "id": session_id,
                    "object": "checkout.session",
                    "amount_total": amount,
                    "currency": currency,
                    "payment_status": payment_status,
                    "metadata": {"payment_id": payment_id},
                }
            },
        }
    ).encode()


def sign(payload: bytes, secret: str = TEST_WEBHOOK_SECRET, timestamp: int | None = None) -> str:
    timestamp = int(time.time()) if timestamp is None else timestamp
    digest = hmac.new(secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"
