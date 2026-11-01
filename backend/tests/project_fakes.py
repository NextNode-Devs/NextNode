"""In-memory fakes for the project ports (#3): no database, no disk."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.ports import Actor
from nextnode.application.projects.ports import ProjectPage, ProjectQuery, ProjectRecord
from nextnode.domain.projects import Project, ProjectStatus, RequirementDocument, Team


class FixedClock:
    def __init__(self, at: datetime = datetime(2026, 10, 31, 12, tzinfo=UTC)) -> None:
        self.at = at

    def now(self) -> datetime:
        return self.at

    def advance(self, **delta: float) -> None:
        self.at += timedelta(**delta)


class InMemoryProjects:
    def __init__(self, names: dict[int, str] | None = None) -> None:
        self.rows: dict[int, tuple[Project, Team]] = {}
        self.names = names or {}

    def _record(self, project_id: int) -> ProjectRecord:
        project, team = self.rows[project_id]
        lead = team.lead_account_id
        return ProjectRecord(
            project,
            team,
            self.names.get(project.owner_account_id, "Owner"),
            self.names.get(lead, "Lead") if lead else None,
        )

    def add(self, project: Project, team: Team) -> ProjectRecord:
        project_id = len(self.rows) + 1
        stored = replace(project, id=project_id, created_at=datetime(2026, 10, 31, tzinfo=UTC))
        self.rows[project_id] = (stored, replace(team, id=project_id, project_id=project_id))
        return self._record(project_id)

    def get(self, project_id: int) -> ProjectRecord | None:
        return self._record(project_id) if project_id in self.rows else None

    get_for_update = get

    def save(self, project: Project) -> ProjectRecord:
        assert project.id is not None
        self.rows[project.id] = (project, self.rows[project.id][1])
        return self._record(project.id)

    def assign_lead(self, project_id: int, developer_account_id: int) -> None:
        project, team = self.rows[project_id]
        self.rows[project_id] = (project, team.assign_lead(developer_account_id))

    def save_team(self, team: Team) -> None:
        assert team.project_id is not None
        project, _ = self.rows[team.project_id]
        self.rows[team.project_id] = (project, team)

    def add_member(self, project_id: int, account_id: int) -> None:
        """A shortcut for tests: what accepting a candidacy does (#5)."""
        project, team = self.rows[project_id]
        self.rows[project_id] = (
            project,
            replace(team, member_account_ids=(*team.member_account_ids, account_id)),
        )

    def search(self, query: ProjectQuery, offset: int, limit: int) -> ProjectPage:
        found = []
        for project_id in sorted(self.rows, reverse=True):
            record = self._record(project_id)
            project, team = record.project, record.team
            keys = {s.key for s in project.details.tech_stack}
            if project.status is not ProjectStatus.POSTED:
                continue
            if query.kind and project.kind is not query.kind:
                continue
            if not set(query.tech_keys) <= keys:
                continue
            if query.needs_lead and not (project.is_client_project and team.lead_account_id is None):
                continue
            if query.open_spots and team.open_spots == 0:
                continue
            found.append(record)
        return ProjectPage(found[offset : offset + limit], len(found))

    def owned_by(self, account_id: int) -> list[ProjectRecord]:
        return [self._record(i) for i, (p, _) in self.rows.items() if p.owner_account_id == account_id]

    def with_member(self, account_id: int) -> list[ProjectRecord]:
        return [
            self._record(i)
            for i, (p, t) in self.rows.items()
            if account_id in (p.owner_account_id, t.lead_account_id) or t.is_member(account_id)
        ]


class InMemoryDocuments:
    def __init__(self) -> None:
        self.rows: dict[UUID, RequirementDocument] = {}

    def add(self, document: RequirementDocument) -> RequirementDocument:
        stored = replace(document, uploaded_at=datetime(2026, 10, 31, tzinfo=UTC))
        self.rows[document.id] = stored
        return stored

    def get(self, project_id: int, document_id: UUID) -> RequirementDocument | None:
        document = self.rows.get(document_id)
        return document if document and document.project_id == project_id else None

    def for_project(self, project_id: int) -> list[RequirementDocument]:
        return [d for d in self.rows.values() if d.project_id == project_id]

    def count_for_project(self, project_id: int) -> int:
        return len(self.for_project(project_id))


class InMemoryStorage:
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    def save(self, key: str, content: bytes) -> None:
        self.files[key] = content

    def read(self, key: str) -> bytes:
        return self.files[key]

    def delete(self, key: str) -> None:
        self.files.pop(key, None)


def policy_over(projects: InMemoryProjects) -> AccessPolicy:
    """The real rules' meaning, over the fake: owner client, Lead, approved members."""

    def reader(actor: Actor, resource: ResourceRef) -> bool:
        record = projects.get(int(resource.id))
        if record is None or not record.project.is_client_project:
            return False
        team = record.team
        return actor.account_id in (record.project.owner_account_id, team.lead_account_id) or team.is_member(
            actor.account_id
        )

    policy = AccessPolicy()
    policy.register("project", "read", lambda actor, resource: True)
    policy.register("project_document", "read", reader)
    return policy
