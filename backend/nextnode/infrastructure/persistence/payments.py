"""Django adapters for the payment ports. ORM models never leave this module."""

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from django.db import IntegrityError, transaction

from nextnode.domain.payments import Payment, PaymentStatus, PaymentType
from nextnode.infrastructure.persistence.models import PaymentModel, StripeEventModel


def _to_entity(row: PaymentModel) -> Payment:
    return Payment(
        id=row.id,
        project_id=row.project_id,
        offer_version_id=row.offer_version_id,
        type=PaymentType(row.type),
        amount_cents=row.amount_cents,
        currency=row.currency,
        status=PaymentStatus(row.status),
        checkout_session_id=row.checkout_session_id,
        completed_at=row.completed_at,
    )


class DjangoPaymentRepository:
    def get_for_update(self, payment_id: UUID) -> Payment | None:
        row = PaymentModel.objects.select_for_update().filter(id=payment_id, deleted_at__isnull=True).first()
        return _to_entity(row) if row else None

    def save(self, payment: Payment) -> None:
        PaymentModel.objects.update_or_create(
            id=payment.id,
            defaults={
                "project_id": payment.project_id,
                "offer_version_id": payment.offer_version_id,
                "type": payment.type.value,
                "amount_cents": payment.amount_cents,
                "currency": payment.currency,
                "status": payment.status.value,
                "checkout_session_id": payment.checkout_session_id,
                "completed_at": payment.completed_at,
            },
        )

    def has_other_completed_deposit(self, project_id: int, exclude: UUID) -> bool:
        return (
            PaymentModel.objects.filter(
                project_id=project_id,
                type=PaymentModel.Type.DEPOSIT,
                status=PaymentModel.Status.COMPLETED,
                deleted_at__isnull=True,
            )
            .exclude(id=exclude)
            .exists()
        )


class DjangoWebhookEventLog:
    def record(self, event_id: str, event_type: str) -> bool:
        try:
            with transaction.atomic():
                StripeEventModel.objects.create(event_id=event_id, type=event_type)
        except IntegrityError:
            return False
        return True


class DjangoUnitOfWork:
    @contextmanager
    def atomic(self) -> Iterator[None]:
        with transaction.atomic():
            yield
