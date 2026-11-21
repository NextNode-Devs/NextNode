"""Django adapters for the Assistant Lead and inactivity ports (NN-39). ORM
models never leave this module."""

from __future__ import annotations

from datetime import datetime

from django.db import IntegrityError, transaction
from django.db.models import Max

from nextnode.domain.conversations import SubjectKind
from nextnode.domain.errors import ConflictError
from nextnode.domain.projects import ActivityCheck, ActivityCheckStatus
from nextnode.infrastructure.persistence.models import (
    ActivityCheckModel,
    ConversationModel,
    MessageModel,
    ProjectModel,
    TeamMembershipModel,
)

APPROVED = TeamMembershipModel.Status.APPROVED
OPEN_STATUSES = (ProjectModel.Status.POSTED, ProjectModel.Status.IN_PROGRESS)


def _to_entity(row: ActivityCheckModel) -> ActivityCheck:
    return ActivityCheck(
        id=row.id,
        project_id=row.project_id,
        status=ActivityCheckStatus(row.status),
        started_at=row.started_at,
        answer_by=row.answer_by,
        ended_at=row.ended_at,
        answered_by_account_id=row.answered_by_id,
    )


class DjangoActivityChecks:
    def add(self, check: ActivityCheck) -> ActivityCheck:
        try:
            with transaction.atomic():
                row = ActivityCheckModel.objects.create(
                    project_id=check.project_id,
                    status=check.status.value,
                    started_at=check.started_at,
                    answer_by=check.answer_by,
                )
        except IntegrityError:
            raise ConflictError("This project's members have already been asked.") from None
        return _to_entity(row)

    def save(self, check: ActivityCheck) -> None:
        ActivityCheckModel.objects.filter(pk=check.id).update(
            status=check.status.value, ended_at=check.ended_at, answered_by_id=check.answered_by_account_id
        )

    def pending(self) -> list[ActivityCheck]:
        rows = ActivityCheckModel.objects.filter(status=ActivityCheckModel.Status.PENDING).order_by(
            "started_at"
        )
        return [_to_entity(row) for row in rows]

    def latest_for(self, project_id: int) -> ActivityCheck | None:
        row = ActivityCheckModel.objects.filter(project_id=project_id).order_by("-started_at", "-id").first()
        return _to_entity(row) if row else None


def _workspace(project_id: int) -> ConversationModel | None:
    return ConversationModel.objects.filter(
        subject_kind=SubjectKind.PROJECT_WORKSPACE.value, subject_id=str(project_id)
    ).first()


class DjangoLeadActivity:
    """Only the project's workspace chat counts as activity for now. Milestones
    will count too once they are built."""

    def open_developer_projects(self) -> list[int]:
        workspaces = ConversationModel.objects.filter(
            subject_kind=SubjectKind.PROJECT_WORKSPACE.value, status=ConversationModel.Status.OPEN
        ).values_list("subject_id", flat=True)
        ids = [int(value) for value in workspaces if value.isdigit()]
        return list(
            ProjectModel.objects.filter(
                pk__in=ids,
                kind=ProjectModel.Kind.DEVELOPER,
                status__in=OPEN_STATUSES,
                deleted_at__isnull=True,
            )
            .order_by("id")
            .values_list("pk", flat=True)
        )

    def last_active_at(self, project_id: int) -> datetime | None:
        workspace = _workspace(project_id)
        if workspace is None:
            return None
        lead = TeamMembershipModel.objects.filter(
            team__project_id=project_id, role=TeamMembershipModel.Role.LEAD, status=APPROVED
        ).values_list("account_id", flat=True)
        latest = MessageModel.objects.filter(conversation=workspace, author_id__in=lead).aggregate(
            at=Max("created_at")
        )["at"]
        return latest or workspace.created_at


def _on_team(project_id: object, account_id: int | None, roles: tuple[str, ...]) -> bool:
    if account_id is None or not str(project_id).isdigit():
        return False
    return TeamMembershipModel.objects.filter(
        team__project_id=int(project_id),
        team__project__deleted_at__isnull=True,
        account_id=account_id,
        status=APPROVED,
        role__in=roles,
    ).exists()


def is_team_participant(project_id: object, account_id: int | None) -> bool:
    """The Team Lead and the approved members (Assistant Lead included)."""
    return _on_team(project_id, account_id, tuple(TeamMembershipModel.Role))


def is_team_steward(project_id: object, account_id: int | None) -> bool:
    """The Team Lead or the Assistant Lead."""
    roles = (TeamMembershipModel.Role.LEAD, TeamMembershipModel.Role.ASSISTANT_LEAD)
    return _on_team(project_id, account_id, roles)
