"""The Payment entity (class diagram: Payment, PaymentType).

Phase 1 records a Stripe test-mode deposit and its status. It holds no funds:
no escrow, custody, transfers or payouts.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from nextnode.domain.errors import DomainError, InvalidStateTransitionError


class PaymentType(StrEnum):
    DEPOSIT = "deposit"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class PaymentMismatchError(DomainError):
    """A payment event does not describe the payment it names."""

    code = "PAYMENT_MISMATCH"


@dataclass
class Payment:
    id: UUID
    project_id: int
    offer_version_id: int
    type: PaymentType
    amount_cents: int
    currency: str
    status: PaymentStatus = PaymentStatus.PENDING
    checkout_session_id: str | None = None
    completed_at: datetime | None = None

    def ensure_matches(self, *, amount_cents: int, currency: str, checkout_session_id: str) -> None:
        if amount_cents != self.amount_cents or currency.lower() != self.currency:
            raise PaymentMismatchError("The paid amount or currency does not match this payment.")
        if self.checkout_session_id and checkout_session_id != self.checkout_session_id:
            raise PaymentMismatchError("The checkout session does not belong to this payment.")

    def complete(self, at: datetime) -> None:
        """Confirmed by a verified webhook. A completed payment is a receipt:
        it is never edited again."""
        if self.status is PaymentStatus.COMPLETED:
            return
        if self.status is not PaymentStatus.PENDING:
            raise InvalidStateTransitionError(f"A {self.status} payment cannot be completed.")
        self.status = PaymentStatus.COMPLETED
        self.completed_at = at

    def fail(self) -> None:
        if self.status is PaymentStatus.FAILED:
            return
        if self.status is not PaymentStatus.PENDING:
            raise InvalidStateTransitionError(f"A {self.status} payment cannot fail.")
        self.status = PaymentStatus.FAILED
