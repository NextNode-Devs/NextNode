"""What the project use cases return. Never an entity or ORM model.

``proposed_budget_cents`` is ``None`` for developer ideas; the API leaves the
key out for them entirely (``presentation/api/projects.py``)."""

from __future__ import annotations

from dataclasses import dataclass

from nextnode.application.accounts.dto import SkillView
from nextnode.application.ports import Actor
from nextnode.application.projects.ports import ProjectRecord
from nextnode.domain.accounts import Role
from nextnode.domain.projects import ProjectKind, ProjectStatus, RequirementDocument, TeamStatus

APPLY_TO_LEAD = "apply_to_lead"  # rendered by #4
APPLY_TO_JOIN = "apply_to_join"  # rendered by #5


@dataclass(frozen=True)
class PersonView:
    account_id: int
    display_name: str


@dataclass(frozen=True)
class TeamView:
    id: int
    status: str
    size: int | None  # None until the Team Lead sets it (#5)
    headcount: int
    open_spots: int


@dataclass(frozen=True)
class ViewerView:
    """The viewer's relation to the project. Drives which controls the UI
    shows; every action re-checks on the server."""

    is_owner: bool
    is_lead: bool
    is_member: bool
    can_edit: bool
    can_upload_documents: bool
    can_read_documents: bool


@dataclass(frozen=True)
class ProjectCardView:
    id: int
    kind: str
    status: str
    title: str
    tech_stack: list[SkillView]
    target_delivery_date: str
    proposed_budget_cents: int | None
    owner: PersonView
    lead: PersonView | None
    needs_lead: bool
    open_spots: int
    created_at: str | None

    @classmethod
    def of(cls, record: ProjectRecord) -> ProjectCardView:
        project, team = record.project, record.team
        details = project.details
        return cls(
            id=_id(project.id),
            kind=project.kind.value,
            status=project.status.value,
            title=details.title,
            tech_stack=[SkillView.of(skill) for skill in details.tech_stack],
            target_delivery_date=details.target_delivery_date.isoformat(),
            proposed_budget_cents=details.proposed_budget_cents,
            owner=PersonView(project.owner_account_id, record.owner_name),
            lead=_lead(record),
            needs_lead=needs_lead(record),
            open_spots=team.open_spots,
            created_at=project.created_at.isoformat() if project.created_at else None,
        )


@dataclass(frozen=True)
class MyProjectView:
    """A row on the dashboard: the project and the viewer's part in it."""

    project: ProjectCardView
    my_role: str  # owner | lead | member


@dataclass(frozen=True)
class ProjectView:
    id: int
    kind: str
    status: str
    title: str
    description: str
    tech_stack: list[SkillView]
    target_delivery_date: str
    proposed_budget_cents: int | None
    owner: PersonView
    lead: PersonView | None
    team: TeamView
    viewer: ViewerView
    viewer_actions: list[str]
    created_at: str | None

    @classmethod
    def of(cls, record: ProjectRecord, actor: Actor, *, can_read_documents: bool) -> ProjectView:
        project, team = record.project, record.team
        details = project.details
        is_owner = actor.account_id == project.owner_account_id
        editable = project.status is ProjectStatus.POSTED and not (
            project.is_client_project and team.lead_account_id is not None
        )
        return cls(
            id=_id(project.id),
            kind=project.kind.value,
            status=project.status.value,
            title=details.title,
            description=details.description,
            tech_stack=[SkillView.of(skill) for skill in details.tech_stack],
            target_delivery_date=details.target_delivery_date.isoformat(),
            proposed_budget_cents=details.proposed_budget_cents,
            owner=PersonView(project.owner_account_id, record.owner_name),
            lead=_lead(record),
            team=TeamView(_id(team.id), team.status.value, team.team_size, team.headcount, team.open_spots),
            viewer=ViewerView(
                is_owner=is_owner,
                is_lead=team.is_lead(actor.account_id),
                is_member=team.is_member(actor.account_id),
                can_edit=is_owner and editable,
                can_upload_documents=is_owner
                and project.is_client_project
                and project.status is ProjectStatus.POSTED,
                can_read_documents=can_read_documents,
            ),
            viewer_actions=viewer_actions(record, actor),
            created_at=project.created_at.isoformat() if project.created_at else None,
        )


def needs_lead(record: ProjectRecord) -> bool:
    project = record.project
    return (
        project.kind is ProjectKind.CLIENT
        and project.status is ProjectStatus.POSTED
        and record.team.lead_account_id is None
    )


def viewer_actions(record: ProjectRecord, actor: Actor) -> list[str]:
    """The one primary action the detail page offers. Never "Apply to lead" on
    a developer idea: ``needs_lead`` is false for every idea."""
    team = record.team
    if actor.role is not Role.DEVELOPER or actor.account_id == record.project.owner_account_id:
        return []
    if needs_lead(record):
        return [APPLY_TO_LEAD]
    on_team = team.is_lead(actor.account_id) or team.is_member(actor.account_id)
    if team.status is TeamStatus.OPEN and team.open_spots > 0 and not on_team:
        return [APPLY_TO_JOIN]
    return []


@dataclass(frozen=True)
class ProjectListView:
    results: list[ProjectCardView]
    page: int
    page_size: int
    total: int
    total_pages: int


@dataclass(frozen=True)
class DocumentView:
    id: str
    filename: str
    type: str
    size_bytes: int
    uploaded_at: str | None

    @classmethod
    def of(cls, document: RequirementDocument) -> DocumentView:
        return cls(
            id=str(document.id),
            filename=document.filename,
            type=document.type.value,
            size_bytes=document.size_bytes,
            uploaded_at=document.uploaded_at.isoformat() if document.uploaded_at else None,
        )


@dataclass(frozen=True)
class DocumentLinkView:
    token: str  # the API turns it into an absolute URL
    expires_at: str


@dataclass(frozen=True)
class DocumentDownload:
    filename: str
    content_type: str
    content: bytes


def _lead(record: ProjectRecord) -> PersonView | None:
    lead_id = record.team.lead_account_id
    return PersonView(lead_id, record.lead_name or "") if lead_id is not None else None


def _id(value: int | None) -> int:
    assert value is not None, "stored records always have an id"
    return value
