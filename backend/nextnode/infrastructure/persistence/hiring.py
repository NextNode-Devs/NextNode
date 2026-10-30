"""Django adapters for the Hire Lead ports. ORM models never leave this module."""

from __future__ import annotations

from uuid import UUID

from django.db import IntegrityError, transaction

from nextnode.domain.accounts import Role
from nextnode.domain.errors import ConflictError
from nextnode.domain.hiring import (
    LeadAlreadyHiredError,
    LeadCandidacy,
    LeadCandidacyKind,
    LeadCandidacyStatus,
)
from nextnode.infrastructure.persistence.models import AccountModel, LeadCandidacyModel

ACTIVE = ("invited", "candidate")


def _to_entity(row: LeadCandidacyModel) -> LeadCandidacy:
    return LeadCandidacy(
        id=row.id,
        project_id=row.project_id,
        client_account_id=row.client_id,
        developer_account_id=row.developer_id,
        kind=LeadCandidacyKind(row.kind),
        status=LeadCandidacyStatus(row.status),
        note=row.note,
        created_at=row.created_at,
        decided_at=row.decided_at,
    )


class DjangoLeadCandidacies:
    def add(self, candidacy: LeadCandidacy) -> LeadCandidacy:
        try:
            with transaction.atomic():
                row = LeadCandidacyModel.objects.create(
                    id=candidacy.id,
                    project_id=candidacy.project_id,
                    client_id=candidacy.client_account_id,
                    developer_id=candidacy.developer_account_id,
                    kind=candidacy.kind.value,
                    status=candidacy.status.value,
                    note=candidacy.note,
                )
        except IntegrityError:
            raise ConflictError(
                "This developer already has an open application or invitation here."
            ) from None
        return _to_entity(row)

    def get(self, candidacy_id: UUID) -> LeadCandidacy | None:
        row = LeadCandidacyModel.objects.filter(pk=candidacy_id).first()
        return _to_entity(row) if row else None

    def get_for_update(self, candidacy_id: UUID) -> LeadCandidacy | None:
        row = LeadCandidacyModel.objects.select_for_update().filter(pk=candidacy_id).first()
        return _to_entity(row) if row else None

    def save(self, candidacy: LeadCandidacy) -> None:
        try:
            with transaction.atomic():
                LeadCandidacyModel.objects.filter(pk=candidacy.id).update(
                    status=candidacy.status.value, decided_at=candidacy.decided_at
                )
        except IntegrityError:
            raise LeadAlreadyHiredError() from None  # another hire for this project won

    def lock_project(self, project_id: int) -> None:
        list(
            LeadCandidacyModel.objects.select_for_update()
            .filter(project_id=project_id)
            .order_by("id")
            .values_list("id", flat=True)
        )

    def for_developer(self, project_id: int, developer_account_id: int) -> list[LeadCandidacy]:
        rows = LeadCandidacyModel.objects.filter(project_id=project_id, developer_id=developer_account_id)
        return [_to_entity(row) for row in rows.order_by("created_at")]

    def active_for_project(self, project_id: int) -> list[LeadCandidacy]:
        rows = LeadCandidacyModel.objects.filter(project_id=project_id, status__in=ACTIVE)
        return [_to_entity(row) for row in rows.order_by("created_at")]


class DjangoHiringAccounts:
    def role_of(self, account_id: int) -> Role | None:
        role = AccountModel.objects.filter(pk=account_id).values_list("role", flat=True).first()
        return Role(role) if role else None
