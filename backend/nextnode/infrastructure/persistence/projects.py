"""Django adapters for the project ports (#3) and for Hire Lead's
``LeadProjects`` (#4). ORM models never leave this module."""

from __future__ import annotations

from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, F, OuterRef, Prefetch, Q, QuerySet

from nextnode.application.projects.ports import ProjectPage, ProjectQuery, ProjectRecord
from nextnode.domain.accounts import SkillName
from nextnode.domain.hiring import LeadAlreadyHiredError, LeadProject
from nextnode.domain.projects import (
    DocumentType,
    Project,
    ProjectDetails,
    ProjectKind,
    ProjectStatus,
    RequirementDocument,
    Team,
    TeamStatus,
)
from nextnode.infrastructure.persistence.models import (
    ProjectModel,
    RequirementDocumentModel,
    SkillModel,
    TeamMembershipModel,
    TeamModel,
)

APPROVED = TeamMembershipModel.Status.APPROVED
LEAD = TeamMembershipModel.Role.LEAD
MEMBER = TeamMembershipModel.Role.MEMBER


def _approved_memberships() -> Prefetch:
    return Prefetch(
        "team__memberships",
        queryset=TeamMembershipModel.objects.filter(status=APPROVED)
        .select_related("account")
        .order_by("created_at", "id"),
        to_attr="approved",
    )


def _rows() -> QuerySet[ProjectModel]:
    return (
        ProjectModel.objects.filter(deleted_at__isnull=True)
        .select_related("owner", "team")
        .prefetch_related("tech_stack", _approved_memberships())
    )


def _to_record(row: ProjectModel) -> ProjectRecord:
    team_row = row.team
    approved = getattr(team_row, "approved", None)
    if approved is None:  # not prefetched (a fresh row after a save)
        approved = list(
            team_row.memberships.filter(status=APPROVED)
            .select_related("account")
            .order_by("created_at", "id")
        )
    lead = next((m for m in approved if m.role == LEAD), None)
    project = Project(
        id=row.id,
        kind=ProjectKind(row.kind),
        owner_account_id=row.owner_id,
        status=ProjectStatus(row.status),
        details=ProjectDetails(
            title=row.title,
            description=row.description,
            tech_stack=tuple(
                SkillName(s.key, s.label) for s in sorted(row.tech_stack.all(), key=lambda s: s.key)
            ),
            target_delivery_date=row.target_delivery_date,
            proposed_budget_cents=row.proposed_budget_cents,
        ),
        created_at=row.created_at,
    )
    team = Team(
        id=team_row.id,
        project_id=row.id,
        status=TeamStatus(team_row.status),
        lead_account_id=lead.account_id if lead else None,
        team_size=team_row.team_size,
        member_account_ids=tuple(m.account_id for m in approved if m.role != LEAD),
    )
    return ProjectRecord(project, team, row.owner.display_name, lead.account.display_name if lead else None)


def _set_details(row: ProjectModel, details: ProjectDetails) -> None:
    row.title = details.title
    row.description = details.description
    row.target_delivery_date = details.target_delivery_date
    row.proposed_budget_cents = details.proposed_budget_cents


def _lead_exists() -> Exists:
    return Exists(
        TeamMembershipModel.objects.filter(team__project=OuterRef("pk"), role=LEAD, status=APPROVED)
    )


class DjangoProjectRepository:
    def add(self, project: Project, team: Team) -> ProjectRecord:
        with transaction.atomic():
            row = ProjectModel(kind=project.kind.value, owner_id=project.owner_account_id)
            _set_details(row, project.details)
            row.status = project.status.value
            row.save()
            row.tech_stack.set(SkillModel.objects.filter(key__in=[s.key for s in project.details.tech_stack]))
            team_row = TeamModel.objects.create(project=row, status=team.status.value)
            if team.lead_account_id is not None:
                TeamMembershipModel.objects.create(team=team_row, account_id=team.lead_account_id, role=LEAD)
        stored = self.get(row.id)
        assert stored is not None
        return stored

    def get(self, project_id: int) -> ProjectRecord | None:
        row = _rows().filter(pk=project_id).first()
        return _to_record(row) if row else None

    def get_for_update(self, project_id: int) -> ProjectRecord | None:
        # Project first, then its team: the same order everywhere, so no deadlock.
        locked = ProjectModel.objects.select_for_update().filter(pk=project_id, deleted_at__isnull=True)
        if not list(locked.values_list("pk", flat=True)):
            return None
        list(TeamModel.objects.select_for_update().filter(project_id=project_id).values_list("pk", flat=True))
        return self.get(project_id)

    def save(self, project: Project) -> ProjectRecord:
        assert project.id is not None
        with transaction.atomic():
            row = ProjectModel.objects.select_for_update().get(pk=project.id)
            _set_details(row, project.details)
            row.status = project.status.value
            row.save()
            row.tech_stack.set(SkillModel.objects.filter(key__in=[s.key for s in project.details.tech_stack]))
        stored = self.get(project.id)
        assert stored is not None
        return stored

    def assign_lead(self, project_id: int, developer_account_id: int) -> None:
        record = self.get_for_update(project_id)
        if record is None:
            raise LookupError(f"Project {project_id} does not exist.")
        record.team.assign_lead(developer_account_id)  # the domain rule: one Lead per project
        try:
            with transaction.atomic():
                TeamMembershipModel.objects.create(
                    team_id=record.team.id, account_id=developer_account_id, role=LEAD
                )
        except IntegrityError:
            raise LeadAlreadyHiredError() from None

    def save_team(self, team: Team) -> None:
        with transaction.atomic():
            TeamModel.objects.filter(pk=team.id).update(team_size=team.team_size)
            stored = set(
                TeamMembershipModel.objects.filter(team_id=team.id).values_list("account", flat=True)
            )
            for account_id in team.member_account_ids:
                if account_id not in stored:
                    TeamMembershipModel.objects.create(team_id=team.id, account_id=account_id, role=MEMBER)

    def search(self, query: ProjectQuery, offset: int, limit: int) -> ProjectPage:
        rows = ProjectModel.objects.filter(deleted_at__isnull=True, status=ProjectModel.Status.POSTED)
        if query.kind is not None:
            rows = rows.filter(kind=query.kind.value)
        for key in query.tech_keys:
            # One join per technology: a project must use every selected one.
            rows = rows.filter(tech_stack__key=key)
        if query.needs_lead:
            rows = rows.filter(kind=ProjectModel.Kind.CLIENT).exclude(_lead_exists())
        if query.open_spots:
            rows = rows.annotate(
                headcount=Count("team__memberships", filter=Q(team__memberships__status=APPROVED))
            ).filter(
                team__status=TeamModel.Status.OPEN,
                team__team_size__isnull=False,
                team__team_size__gt=F("headcount"),
            )
        ids = rows.values("pk")
        total = ProjectModel.objects.filter(pk__in=ids).count()
        page = _rows().filter(pk__in=ids).order_by("-created_at", "-id")[offset : offset + limit]
        return ProjectPage([_to_record(row) for row in page], total)

    def owned_by(self, account_id: int) -> list[ProjectRecord]:
        return [_to_record(row) for row in _rows().filter(owner_id=account_id).order_by("-created_at")]

    def with_member(self, account_id: int) -> list[ProjectRecord]:
        member_of = TeamMembershipModel.objects.filter(account_id=account_id, status=APPROVED).values(
            "team__project_id"
        )
        rows = _rows().filter(Q(owner_id=account_id) | Q(pk__in=member_of)).order_by("-created_at")
        return [_to_record(row) for row in rows]


def is_document_reader(project_id: object, account_id: int | None) -> bool:
    """The owning client, the Team Lead and approved members of a client
    project. Applicants, invitees and candidates have no approved membership."""
    if account_id is None or not str(project_id).isdigit():
        return False
    project = Q(pk=int(project_id), kind=ProjectModel.Kind.CLIENT, deleted_at__isnull=True)
    on_team = Q(team__memberships__account_id=account_id, team__memberships__status=APPROVED)
    return ProjectModel.objects.filter(project & (Q(owner_id=account_id) | on_team)).exists()


def _to_document(row: RequirementDocumentModel) -> RequirementDocument:
    return RequirementDocument(
        id=row.id,
        project_id=row.project_id,
        storage_key=row.storage_key,
        filename=row.filename,
        type=DocumentType(row.type),
        size_bytes=row.size_bytes,
        uploaded_by_account_id=row.uploaded_by_id,
        uploaded_at=row.uploaded_at,
    )


class DjangoDocumentRepository:
    def add(self, document: RequirementDocument) -> RequirementDocument:
        row = RequirementDocumentModel.objects.create(
            id=document.id,
            project_id=document.project_id,
            storage_key=document.storage_key,
            filename=document.filename,
            type=document.type.value,
            size_bytes=document.size_bytes,
            uploaded_by_id=document.uploaded_by_account_id,
        )
        return _to_document(row)

    def get(self, project_id: int, document_id: UUID) -> RequirementDocument | None:
        row = RequirementDocumentModel.objects.filter(project_id=project_id, pk=document_id).first()
        return _to_document(row) if row else None

    def for_project(self, project_id: int) -> list[RequirementDocument]:
        return [_to_document(row) for row in RequirementDocumentModel.objects.filter(project_id=project_id)]

    def count_for_project(self, project_id: int) -> int:
        return RequirementDocumentModel.objects.filter(project_id=project_id).count()


class DjangoLeadProjects:
    """#4's ``LeadProjects`` over #3's projects and teams."""

    def __init__(self, projects: DjangoProjectRepository | None = None) -> None:
        self._projects = projects or DjangoProjectRepository()

    @staticmethod
    def _lead_project(record: ProjectRecord | None) -> LeadProject | None:
        if record is None:
            return None
        project = record.project
        assert project.id is not None
        return LeadProject(
            id=project.id,
            client_account_id=project.owner_account_id,
            client_funded=project.is_client_project,
            status=project.status.value,
            lead_account_id=record.team.lead_account_id,
            title=project.details.title,
        )

    def get(self, project_id: int) -> LeadProject | None:
        return self._lead_project(self._projects.get(project_id))

    def get_for_update(self, project_id: int) -> LeadProject | None:
        return self._lead_project(self._projects.get_for_update(project_id))

    def assign_lead(self, project_id: int, developer_account_id: int) -> None:
        self._projects.assign_lead(project_id, developer_account_id)
