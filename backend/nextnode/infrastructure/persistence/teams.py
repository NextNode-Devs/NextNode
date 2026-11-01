"""Django adapter for Hire Devs' ``CandidacyRepository``. ORM models never leave this module."""

from __future__ import annotations

from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Q

from nextnode.domain.teams import Candidacy, CandidacyKind, CandidacyStatus, DuplicateCandidacyError
from nextnode.infrastructure.persistence.models import TeamCandidacyModel


def _to_entity(row: TeamCandidacyModel) -> Candidacy:
    return Candidacy(
        id=row.id,
        project_id=row.project_id,
        lead_account_id=row.lead_id,
        developer_account_id=row.developer_id,
        kind=CandidacyKind(row.kind),
        status=CandidacyStatus(row.status),
        closed_reason=row.closed_reason,
        created_at=row.created_at,
        decided_at=row.decided_at,
    )


class DjangoTeamCandidacies:
    def add(self, candidacy: Candidacy) -> Candidacy:
        try:
            with transaction.atomic():
                row = TeamCandidacyModel.objects.create(
                    id=candidacy.id,
                    project_id=candidacy.project_id,
                    lead_id=candidacy.lead_account_id,
                    developer_id=candidacy.developer_account_id,
                    kind=candidacy.kind.value,
                    status=candidacy.status.value,
                )
        except IntegrityError:
            raise DuplicateCandidacyError(
                "This developer already has an application or invitation for this team."
            ) from None
        return _to_entity(row)

    def get(self, candidacy_id: UUID) -> Candidacy | None:
        row = TeamCandidacyModel.objects.filter(pk=candidacy_id).first()
        return _to_entity(row) if row else None

    def save(self, candidacy: Candidacy) -> None:
        TeamCandidacyModel.objects.filter(pk=candidacy.id).update(
            status=candidacy.status.value,
            closed_reason=candidacy.closed_reason,
            decided_at=candidacy.decided_at,
        )

    def find_pending(self, project_id: int, developer_account_id: int) -> Candidacy | None:
        row = TeamCandidacyModel.objects.filter(
            project_id=project_id, developer_id=developer_account_id, status="pending"
        ).first()
        return _to_entity(row) if row else None

    def has_applied(self, project_id: int, developer_account_id: int) -> bool:
        return TeamCandidacyModel.objects.filter(
            project_id=project_id, developer_id=developer_account_id, kind="application"
        ).exists()

    def pending_for_project(self, project_id: int) -> list[Candidacy]:
        rows = TeamCandidacyModel.objects.filter(project_id=project_id, status="pending")
        return [_to_entity(row) for row in rows.order_by("created_at")]

    def for_account(self, account_id: int) -> list[Candidacy]:
        rows = TeamCandidacyModel.objects.filter(Q(lead_id=account_id) | Q(developer_id=account_id))
        return [_to_entity(row) for row in rows.order_by("-created_at")]
