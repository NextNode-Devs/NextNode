"""Django adapter for portfolio certificates (NN-34). ORM models never leave this module."""

from __future__ import annotations

from uuid import UUID

from nextnode.domain.accounts.certificates import Certificate
from nextnode.infrastructure.persistence.models import CertificateModel


def _to_entity(row: CertificateModel) -> Certificate:
    return Certificate(
        id=row.id,
        account_id=row.developer_id,
        storage_key=row.storage_key,
        filename=row.filename,
        size_bytes=row.size_bytes,
        uploaded_at=row.uploaded_at,
    )


class DjangoCertificates:
    def add(self, certificate: Certificate) -> Certificate:
        row = CertificateModel.objects.create(
            id=certificate.id,
            developer_id=certificate.account_id,
            storage_key=certificate.storage_key,
            filename=certificate.filename,
            size_bytes=certificate.size_bytes,
            uploaded_at=certificate.uploaded_at,
        )
        return _to_entity(row)

    def get(self, account_id: int, certificate_id: UUID) -> Certificate | None:
        row = CertificateModel.objects.filter(pk=certificate_id, developer_id=account_id).first()
        return _to_entity(row) if row else None

    def for_account(self, account_id: int) -> list[Certificate]:
        return [_to_entity(row) for row in CertificateModel.objects.filter(developer_id=account_id)]

    def count_for_account(self, account_id: int) -> int:
        return CertificateModel.objects.filter(developer_id=account_id).count()

    def delete(self, certificate_id: UUID) -> None:
        CertificateModel.objects.filter(pk=certificate_id).delete()
