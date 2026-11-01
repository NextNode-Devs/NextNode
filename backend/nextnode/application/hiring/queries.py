"""Read side of Hire Lead (#4): a project's hiring conversations, for its page."""

from __future__ import annotations

from dataclasses import dataclass

from nextnode.application.conversations.ports import AccountNames
from nextnode.application.hiring.lead import PROJECT_NOT_FOUND, HireLeadDeps
from nextnode.application.ports import Actor
from nextnode.domain.errors import NotFoundError


@dataclass(frozen=True)
class LeadChatView:
    """One application or invitation on a project, with the conversation to open."""

    candidacy_id: str
    developer_account_id: int
    developer_name: str
    kind: str
    status: str
    conversation_id: str | None


class ListProjectLeadChats:
    """The project's client sees every application and invitation; a developer
    sees only their own; everyone else sees none. The project page shows the
    chosen conversation beside the brief."""

    def __init__(self, deps: HireLeadDeps, names: AccountNames) -> None:
        self._d = deps
        self._names = names

    def execute(self, actor: Actor, project_id: int) -> list[LeadChatView]:
        project = self._d.projects.get(project_id)
        if project is None:
            raise NotFoundError(PROJECT_NOT_FOUND)
        me = actor.account_id
        if me is None:
            return []
        if me == project.client_account_id:
            candidacies = self._d.candidacies.for_project(project_id)
        else:
            candidacies = self._d.candidacies.for_developer(project_id, me)
        names = self._names.names([c.developer_account_id for c in candidacies])
        return [
            LeadChatView(
                candidacy_id=str(c.id),
                developer_account_id=c.developer_account_id,
                developer_name=names.get(c.developer_account_id, "Unknown"),
                kind=c.kind.value,
                status=c.status.value,
                conversation_id=self._d.conversation_id(c),
            )
            for c in candidacies
        ]


@dataclass(frozen=True)
class MyLeadCandidacyView:
    """One application or invitation on the viewer's dashboard."""

    candidacy_id: str
    project_id: int
    project_title: str
    kind: str
    status: str
    client_name: str
    developer_name: str
    conversation_id: str | None
    created_at: str | None


class ListMyLeadCandidacies:
    """The viewer's applications and invitations, newest first: a client's on
    their projects, a developer's own. Projects that no longer exist are left out."""

    def __init__(self, deps: HireLeadDeps, names: AccountNames) -> None:
        self._d = deps
        self._names = names

    def execute(self, actor: Actor) -> list[MyLeadCandidacyView]:
        if actor.account_id is None:
            return []
        candidacies = self._d.candidacies.for_account(actor.account_id)
        projects = {pid: self._d.projects.get(pid) for pid in {c.project_id for c in candidacies}}
        people = {c.client_account_id for c in candidacies} | {c.developer_account_id for c in candidacies}
        names = self._names.names(sorted(people))
        views = []
        for c in candidacies:
            project = projects[c.project_id]
            if project is None:
                continue
            views.append(
                MyLeadCandidacyView(
                    candidacy_id=str(c.id),
                    project_id=c.project_id,
                    project_title=project.title,
                    kind=c.kind.value,
                    status=c.status.value,
                    client_name=names.get(c.client_account_id, "Unknown"),
                    developer_name=names.get(c.developer_account_id, "Unknown"),
                    conversation_id=self._d.conversation_id(c),
                    created_at=c.created_at.isoformat() if c.created_at else None,
                )
            )
        return views
