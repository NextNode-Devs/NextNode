"""SetTeamSize, ApplyToJoinTeam and InviteDeveloper: the Team Lead opens the
spots, then developers apply or the Team Lead invites (spec Workflow B)."""

from __future__ import annotations

from nextnode.application.ports import Actor
from nextnode.application.teams.deps import TeamDeps, require_account
from nextnode.application.teams.dto import CandidacyView, RosterView
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.teams import (
    RECRUITMENT_CLOSED,
    Candidacy,
    CandidacyKind,
    DuplicateCandidacyError,
    Team,
)


class SetTeamSize:
    """The Team Lead sets the total team size (5-7, Lead included). Shrinking to
    the current headcount fills the team, which closes everyone still waiting."""

    def __init__(self, deps: TeamDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, size: int) -> RosterView:
        with self._d.uow.atomic():
            team = self._d.lock_team(project_id)
            team.ensure_lead(actor.account_id, "set the team size")
            resized = team.with_size(size)
            self._d.projects.save_team(resized)
            closed = self._d.close_pending_if_full(project_id, resized)
            return RosterView.of(project_id, resized, closed)


class CloseRecruitment:
    """#6 runs this in the transaction that locks the team (it holds the lock):
    everyone still waiting is closed, live, with "Recruitment has closed"."""

    def __init__(self, deps: TeamDeps) -> None:
        self._d = deps

    def execute(self, project_id: int) -> list[str]:
        with self._d.uow.atomic():
            closed = self._d.close_pending(project_id, RECRUITMENT_CLOSED)
            return [str(candidacy.id) for candidacy in closed]


class _OpenCandidacy:
    """Shared by apply and invite: one pending candidacy per developer and
    team, with its hiring conversation."""

    kind: CandidacyKind

    def __init__(self, deps: TeamDeps) -> None:
        self._d = deps

    def _open(self, actor: Actor, project_id: int, team: Team, developer_id: int) -> CandidacyView:
        team.ensure_can_join(developer_id)
        self._refuse_duplicate(project_id, developer_id)
        assert team.lead_account_id is not None  # a size is set, so there is a Lead
        candidacy = self._d.candidacies.add(
            Candidacy(self._d.new_id(), project_id, team.lead_account_id, developer_id, self.kind)
        )
        self._d.conversations.open_for_candidacy(candidacy.id, team.lead_account_id, developer_id)
        self._d.announce(candidacy)
        return self._d.view(candidacy, actor)

    def _refuse_duplicate(self, project_id: int, developer_id: int) -> None:
        raise NotImplementedError


class ApplyToJoinTeam(_OpenCandidacy):
    """A developer applies to join a team, once. Not applying to *lead* a project (#4)."""

    kind = CandidacyKind.APPLICATION

    def execute(self, actor: Actor, project_id: int) -> CandidacyView:
        developer_id = require_account(actor)
        with self._d.uow.atomic():
            team = self._d.lock_team(project_id)
            if not self._d.accounts.is_developer(actor.clerk_user_id):
                raise ForbiddenError("Only developers can apply to join a team.")
            return self._open(actor, project_id, team, developer_id)

    def _refuse_duplicate(self, project_id: int, developer_id: int) -> None:
        existing = self._d.candidacies.find_pending(project_id, developer_id)
        if existing is not None and existing.kind is CandidacyKind.INVITATION:
            raise DuplicateCandidacyError(
                "The Team Lead has already invited you to this team; accept the invitation instead."
            )
        if existing is not None or self._d.candidacies.has_applied(project_id, developer_id):
            raise DuplicateCandidacyError("You have already applied to join this team.")


class InviteDeveloper(_OpenCandidacy):
    """The Team Lead invites a developer, who must accept before joining."""

    kind = CandidacyKind.INVITATION

    def execute(self, actor: Actor, project_id: int, developer_account_id: int) -> CandidacyView:
        with self._d.uow.atomic():
            team = self._d.lock_team(project_id)
            team.ensure_lead(actor.account_id, "invite developers")
            if not self._d.accounts.is_developer_account(developer_account_id):
                raise NotFoundError("Developer not found.")
            return self._open(actor, project_id, team, developer_account_id)

    def _refuse_duplicate(self, project_id: int, developer_id: int) -> None:
        existing = self._d.candidacies.find_pending(project_id, developer_id)
        if existing is None:
            return
        if existing.kind is CandidacyKind.INVITATION:
            raise DuplicateCandidacyError("You have already invited this developer.")
        raise DuplicateCandidacyError(
            "This developer has already applied to join; accept their application instead."
        )
