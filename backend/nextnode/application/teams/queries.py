"""Read side of Hire Devs: the team profile, one candidacy, and the viewer's lists."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.ports import Actor
from nextnode.application.projects.ports import ProjectRepository
from nextnode.application.teams.deps import PROJECT_NOT_FOUND, TeamDeps
from nextnode.application.teams.dto import CandidacyActions, CandidacyView, actions_for
from nextnode.application.teams.ports import TeamMemberRecord, TeamMembers
from nextnode.domain.errors import NotFoundError
from nextnode.domain.teams import Candidacy

LEAD = "lead"


@dataclass(frozen=True)
class TeamMemberView:
    account_id: int
    display_name: str
    role: str
    joined_at: str | None
    portfolio_url: str  # the app's portfolio page, for this person

    @classmethod
    def of(cls, member: TeamMemberRecord) -> TeamMemberView:
        return cls(
            account_id=member.account_id,
            display_name=member.display_name,
            role=member.role,
            joined_at=member.joined_at.isoformat() if member.joined_at else None,
            portfolio_url=f"/developers/{member.account_id}",
        )


@dataclass(frozen=True)
class TeamProfileView:
    """``GET /api/projects/{id}/team/``: the contract #6 reads."""

    size: int | None
    open_spots: int
    status: str
    members: list[TeamMemberView]  # the Team Lead first, then by when they joined


class GetTeam:
    """Any signed-in, onboarded user sees a project's team (FR2, team profiles)."""

    def __init__(self, projects: ProjectRepository, members: TeamMembers, policy: AccessPolicy) -> None:
        self._projects = projects
        self._members = members
        self._policy = policy

    def execute(self, actor: Actor, project_id: int) -> TeamProfileView:
        self._policy.check(actor, "read", ResourceRef("team", project_id))
        record = self._projects.get(project_id)
        if record is None:
            raise NotFoundError(PROJECT_NOT_FOUND)
        members = sorted(self._members.for_project(project_id), key=lambda m: m.role != LEAD)
        team = record.team
        return TeamProfileView(
            size=team.team_size,
            open_spots=team.open_spots,
            status=team.status.value,
            members=[TeamMemberView.of(member) for member in members],
        )


class GetTeamCandidacy:
    """One application or invitation, for its two people, with what the viewer may do."""

    def __init__(self, deps: TeamDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, candidacy_id: UUID) -> CandidacyView:
        candidacy = self._d.candidacies.get(candidacy_id)
        if candidacy is None or not candidacy.involves(actor.account_id):
            raise NotFoundError("Application or invitation not found.")
        return self._d.view(candidacy, actor)


@dataclass(frozen=True)
class MyCandidacyView:
    """One application or invitation on the viewer's dashboard."""

    candidacy_id: str
    project_id: int
    project_title: str
    kind: str
    status: str
    closed_reason: str
    my_part: str  # "lead" or "developer"
    lead_name: str
    developer_name: str
    conversation_id: str | None
    created_at: str | None
    actions: CandidacyActions


class ListMyTeamCandidacies:
    """The viewer's applications and invitations, newest first: the ones they
    made or received as a developer and those for the teams they lead."""

    def __init__(self, deps: TeamDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor) -> list[MyCandidacyView]:
        if actor.account_id is None:
            return []
        candidacies = self._d.candidacies.for_account(actor.account_id)
        records = {pid: self._d.projects.get(pid) for pid in {c.project_id for c in candidacies}}
        names = self._d.names.names(sorted({person for c in candidacies for person in c.participant_ids}))
        views = []
        for candidacy in candidacies:
            record = records[candidacy.project_id]
            if record is not None:
                views.append(self._row(candidacy, record.project.details.title, actor.account_id, names))
        return views

    def _row(self, c: Candidacy, title: str, me: int, names: dict[int, str]) -> MyCandidacyView:
        return MyCandidacyView(
            candidacy_id=str(c.id),
            project_id=c.project_id,
            project_title=title,
            kind=c.kind.value,
            status=c.status.value,
            closed_reason=c.closed_reason,
            my_part="lead" if me == c.lead_account_id else "developer",
            lead_name=names.get(c.lead_account_id, "Unknown"),
            developer_name=names.get(c.developer_account_id, "Unknown"),
            conversation_id=self._d.conversations.conversation_id_for(c.id),
            created_at=c.created_at.isoformat() if c.created_at else None,
            actions=actions_for(c, me),
        )
