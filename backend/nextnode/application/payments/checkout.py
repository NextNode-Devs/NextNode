"""StartDepositCheckout: the client opens Stripe Checkout for the deposit.

The amount comes from the accepted offer on the server, never the request.
Creating a session changes no project state; only a verified webhook does.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID, uuid4

from nextnode.application.payments.ports import (
    CheckoutRequest,
    DepositTerms,
    DepositTermsSource,
    PaymentGateway,
    PaymentRepository,
    UnitOfWork,
)
from nextnode.application.ports import Actor
from nextnode.domain.errors import ConflictError, InvalidStateTransitionError, NotFoundError
from nextnode.domain.payments import CURRENCY, Payment, PaymentStatus, PaymentType, deposit_for

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DepositCheckout:
    checkout_url: str
    payment_id: str
    amount_cents: int
    currency: str


class StartDepositCheckout:
    def __init__(
        self,
        terms: DepositTermsSource,
        payments: PaymentRepository,
        gateway: PaymentGateway,
        uow: UnitOfWork,
        *,
        deposit_percent: int,
        frontend_origin: str,
        new_id: Callable[[], UUID] = uuid4,
    ) -> None:
        self._terms = terms
        self._payments = payments
        self._gateway = gateway
        self._uow = uow
        self._percent = deposit_percent
        self._origin = frontend_origin.rstrip("/")
        self._new_id = new_id

    def execute(self, actor: Actor, project_id: int) -> DepositCheckout:
        with self._uow.atomic():
            terms = self._terms.get_for_update(project_id)
            # Someone else's project and a developer project look the same: not found.
            if terms is None or not terms.is_client_project or terms.client_user_id != actor.clerk_user_id:
                raise NotFoundError("Project not found.")
            if not terms.is_assigned or terms.offer_version_id is None or terms.accepted_total_cents is None:
                raise InvalidStateTransitionError(
                    "The deposit can be paid once you have accepted the Team Lead's offer."
                )
            amount = deposit_for(terms.accepted_total_cents, self._percent)

            current = self._payments.current_deposit(project_id)
            if current is not None and current.status is PaymentStatus.COMPLETED:
                raise ConflictError("This project's deposit is already paid.")
            if current is not None and current.status is PaymentStatus.PENDING:
                reused = self._reuse_or_close(current, terms.offer_version_id, amount)
                if reused is not None:
                    return reused

            payment = Payment(
                id=self._new_id(),
                project_id=project_id,
                offer_version_id=terms.offer_version_id,
                type=PaymentType.DEPOSIT,
                amount_cents=amount,
                currency=CURRENCY,
            )
            session = self._gateway.create_checkout_session(self._request(payment, terms))
            payment.checkout_session_id = session.id
            self._payments.save(payment)
        return DepositCheckout(session.url, str(payment.id), amount, CURRENCY)

    def _reuse_or_close(self, pending: Payment, offer_version_id: int, amount: int) -> DepositCheckout | None:
        """An open session for the same offer and amount is reused. Anything
        else is closed first, so an outdated amount can never be paid."""
        assert pending.checkout_session_id is not None
        session = self._gateway.retrieve_checkout_session(pending.checkout_session_id)
        if session.status == "complete":
            raise ConflictError("A payment for this deposit is being confirmed. Check again in a minute.")
        unchanged = pending.offer_version_id == offer_version_id and pending.amount_cents == amount
        if session.status == "open" and unchanged:
            return DepositCheckout(session.url, str(pending.id), pending.amount_cents, pending.currency)
        if session.status == "open":
            logger.info("Closing outdated checkout for payment %s", pending.id)
            self._gateway.expire_checkout_session(session.id)
        pending.fail()
        self._payments.save(pending)
        return None

    def _request(self, payment: Payment, terms: DepositTerms) -> CheckoutRequest:
        project_url = f"{self._origin}/projects/{terms.project_id}/deposit"
        return CheckoutRequest(
            payment_id=payment.id,
            amount_cents=payment.amount_cents,
            currency=payment.currency,
            description=f"Deposit ({self._percent}%): {terms.title}"[:200],
            # Stripe fills in {CHECKOUT_SESSION_ID}. Returning here confirms nothing.
            success_url=f"{project_url}/return?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{project_url}/cancelled",
        )
