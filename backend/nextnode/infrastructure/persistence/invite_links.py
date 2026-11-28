"""Django adapter for A4's ``InviteLinkRepository`` (#178). ORM models never leave this module."""

from __future__ import annotations

from nextnode.domain.teams.invite_link import InviteLink
from nextnode.infrastructure.persistence.invite_link_models import InviteLinkModel


def _to_link(row: InviteLinkModel) -> InviteLink:
    return InviteLink(
        project_id=row.project_id,
        token=row.token,
        created_by_account_id=row.created_by_id,
        created_at=row.created_at,
        expires_at=row.expires_at,
        used_at=row.used_at,
        used_by_account_id=row.used_by_id,
        revoked_at=row.revoked_at,
        id=row.id,
    )


class DjangoInviteLinkRepository:
    def add(self, link: InviteLink) -> InviteLink:
        row = InviteLinkModel.objects.create(
            project_id=link.project_id,
            token=link.token,
            created_by_id=link.created_by_account_id,
            created_at=link.created_at,
            expires_at=link.expires_at,
        )
        return _to_link(row)

    def save(self, link: InviteLink) -> None:
        InviteLinkModel.objects.filter(pk=link.id).update(
            used_at=link.used_at, used_by_id=link.used_by_account_id, revoked_at=link.revoked_at
        )

    def live_for_project(self, project_id: int) -> list[InviteLink]:
        rows = InviteLinkModel.objects.filter(
            project_id=project_id, used_at__isnull=True, revoked_at__isnull=True
        )
        return [_to_link(row) for row in rows]

    def for_project(self, project_id: int) -> list[InviteLink]:
        return [_to_link(row) for row in InviteLinkModel.objects.filter(project_id=project_id)]

    def by_token(self, token: str) -> InviteLink | None:
        row = InviteLinkModel.objects.filter(token=token, project__deleted_at__isnull=True).first()
        return _to_link(row) if row else None
