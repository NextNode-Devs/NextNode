"""Finding projects (#3): search, detail, and the dashboard's "my projects".

Every search parameter arrives as raw text from the URL and is checked here, so
the same URL always means the same search."""

from __future__ import annotations

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.ports import Actor
from nextnode.application.projects.commands import PROJECT_NOT_FOUND, ProjectDeps
from nextnode.application.projects.dto import MyProjectView, ProjectCardView, ProjectListView, ProjectView
from nextnode.application.projects.ports import ProjectQuery, ProjectRepository
from nextnode.domain.accounts import Role
from nextnode.domain.errors import ForbiddenError, NotFoundError, ValidationError
from nextnode.domain.projects import ProjectKind

PAGE_SIZE = 20
MAX_TECH_FILTERS = 10


def _flag(raw: str | None, name: str) -> bool:
    value = (raw or "").strip().lower()
    if value not in ("", "true"):
        raise ValidationError("Unknown filter.", {name: ['Use "true" or leave it out.']})
    return value == "true"


def parse_query(
    kind: str | None, tech: str | None, needs_lead: str | None, open_spots: str | None, page: str | None
) -> ProjectQuery:
    kind_value = (kind or "").strip().lower()
    if kind_value not in ("", *ProjectKind):
        raise ValidationError(
            "Unknown project kind.", {"kind": ['Use "client", "developer" or leave it out.']}
        )

    keys: list[str] = []
    for raw in (tech or "").split(","):
        key = " ".join(raw.split()).casefold()
        if key and key not in keys:
            keys.append(key)
    if len(keys) > MAX_TECH_FILTERS:
        raise ValidationError(
            "Too many technologies selected.", {"tech": [f"Filter by at most {MAX_TECH_FILTERS}."]}
        )

    number = (page or "").strip() or "1"
    if not number.isdigit() or int(number) < 1:
        raise ValidationError("Unknown page.", {"page": ["Use a page number of 1 or more."]})

    return ProjectQuery(
        kind=ProjectKind(kind_value) if kind_value else None,
        tech_keys=tuple(sorted(keys)),
        needs_lead=_flag(needs_lead, "needs_lead"),
        open_spots=_flag(open_spots, "open_spots"),
        page=int(number),
    )


class SearchProjects:
    """Any signed-in, onboarded user may search ``Posted`` projects."""

    def __init__(self, projects: ProjectRepository, policy: AccessPolicy) -> None:
        self._projects = projects
        self._policy = policy

    def execute(
        self,
        actor: Actor,
        *,
        kind: str | None = None,
        tech: str | None = None,
        needs_lead: str | None = None,
        open_spots: str | None = None,
        page: str | None = None,
    ) -> ProjectListView:
        self._policy.check(actor, "read", ResourceRef("project", "all"))
        query = parse_query(kind, tech, needs_lead, open_spots, page)
        found = self._projects.search(query, offset=(query.page - 1) * PAGE_SIZE, limit=PAGE_SIZE)
        return ProjectListView(
            results=[ProjectCardView.of(record) for record in found.records],
            page=query.page,
            page_size=PAGE_SIZE,
            total=found.total,
            total_pages=max(1, -(-found.total // PAGE_SIZE)),
        )


class GetProject:
    """Any signed-in, onboarded user may read a project's brief. Documents are
    separate and private (``documents.py``)."""

    def __init__(self, deps: ProjectDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> ProjectView:
        self._d.policy.check(actor, "read", ResourceRef("project", project_id))
        record = self._d.projects.get(project_id)
        if record is None:
            raise NotFoundError(PROJECT_NOT_FOUND)
        return self._d.view(record, actor)


class ListMyProjects:
    """A client's projects; a developer's ideas and the projects they lead or belong to."""

    def __init__(self, projects: ProjectRepository) -> None:
        self._projects = projects

    def execute(self, actor: Actor) -> list[MyProjectView]:
        if actor.account_id is None:
            raise ForbiddenError("Finish setting up your account first.")
        if actor.role is Role.CLIENT:
            records = self._projects.owned_by(actor.account_id)
        else:
            records = self._projects.with_member(actor.account_id)
        views = []
        for record in records:
            if record.project.owner_account_id == actor.account_id:
                role = "owner"
            elif record.team.is_lead(actor.account_id):
                role = "lead"
            else:
                role = "member"
            views.append(MyProjectView(ProjectCardView.of(record), role))
        return views
