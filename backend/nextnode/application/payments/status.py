"""DepositStatusQuery: ``deposit_status(project)`` for #6's start-gate status.

It answers for a project id and checks no access itself: #6's gate use case
authorizes the actor before asking.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from nextnode.application.payments.ports import PaymentRepository

Status = Literal["none", "pending", "completed", "failed"]


@dataclass(frozen=True)
class DepositStatus:
    status: Status
    amount_cents: int | None = None
    currency: str | None = None
    completed_at: datetime | None = None

    @property
    def confirmed(self) -> bool:
        return self.status == "completed"


class DepositStatusQuery:
    def __init__(self, payments: PaymentRepository) -> None:
        self._payments = payments

    def execute(self, project_id: int) -> DepositStatus:
        payment = self._payments.current_deposit(project_id)
        if payment is None:
            return DepositStatus("none")
        return DepositStatus(
            payment.status.value, payment.amount_cents, payment.currency, payment.completed_at
        )
