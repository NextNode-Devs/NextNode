"""Time-limited team invitation links (A4, #178).

The Team Lead makes, lists and revokes links; anyone signed in can read a
link's state from its token; a developer joins with it. Every roster change
runs under the team lock (``TeamDeps.lock_team``), the same as accepting an
invitation, so spots fill one at a time and the last one closes the rest.
"""

from __future__ import annotations

import secrets
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from nextnode.application.ports import Actor, Notification, NotificationCategory, NotificationSender
from nextnode.application.teams.deps import TeamDeps, require_account
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.teams import Team, TeamNotRecruitingError, close_all
from nextnode.domain.teams.invite_link import InviteLink

LINK_NOT_FOUND = "This invite link doesn't exist. Check you copied all of it."
JOINED_THROUGH_LINK = "You joined the team through an invite link."


class InviteLinkRepository(Protocol):
    def add(self, link: InviteLink) -> InviteLink: ...

    def save(self, link: InviteLink) -> None: ...

    def live_for_project(self, project_id: int) -> list[InviteLink]:
        """Links neither used nor revoked (expired ones included)."""
        ...

    def for_project(self, project_id: int) -> list[InviteLink]:
        """Newest first."""
        ...

    def by_token(self, token: str) -> InviteLink | None: ...


@dataclass(frozen=True)
class InviteLinkView:
    """The frontend's ``InviteLink``. ``status`` adds ``revoked`` to active, expired and used."""

    token: str
    project_id: int
    status: str
    created_at: str
    expires_at: str
    used_at: str | None
    used_by_name: str | None


@dataclass(frozen=True)
class JoinedView:
    project_id: int
    joined: bool


def new_token() -> str:
    return secrets.token_urlsafe(32)  # 256 random bits


class InviteLinks:
    def __init__(
        self,
        team: TeamDeps,
        links: InviteLinkRepository,
        notifications: NotificationSender,
        make_token: Callable[[], str] = new_token,
    ) -> None:
        self._t = team
        self._links = links
        self._notify = notifications
        self._make_token = make_token

    # --- views ---------------------------------------------------------------------

    def _view(self, link: InviteLink) -> InviteLinkView:
        names = self._t.names.names([link.used_by_account_id] if link.used_by_account_id else [])
        return InviteLinkView(
            token=link.token,
            project_id=link.project_id,
            status=link.status(self._t.clock.now()).value,
            created_at=link.created_at.isoformat(),
            expires_at=link.expires_at.isoformat(),
            used_at=link.used_at.isoformat() if link.used_at else None,
            used_by_name=names.get(link.used_by_account_id) if link.used_by_account_id else None,
        )

    def _lead_team(self, actor: Actor, project_id: int, action: str) -> Team:
        team = self._t.lock_team(project_id)
        team.ensure_lead(actor.account_id, action)
        return team

    # --- the Team Lead -------------------------------------------------------------------

    def create(self, actor: Actor, project_id: int, hours: int) -> list[InviteLinkView]:
        """A new link stops the old one, so the team has one live link."""
        lead_id = require_account(actor)
        with self._t.uow.atomic():
            team = self._lead_team(actor, project_id, "make invite links")
            team.ensure_recruiting()
            if team.team_size is None:
                raise TeamNotRecruitingError("Set the team size before making an invite link.")
            now = self._t.clock.now()
            link = InviteLink.create(project_id, self._make_token(), lead_id, hours, now)
            self._revoke_live(project_id)
            self._links.add(link)
            return [self._view(link) for link in self._links.for_project(project_id)]

    def revoke(self, actor: Actor, project_id: int) -> list[InviteLinkView]:
        require_account(actor)
        with self._t.uow.atomic():
            self._lead_team(actor, project_id, "turn off invite links")
            self._revoke_live(project_id)
            return [self._view(link) for link in self._links.for_project(project_id)]

    def list(self, actor: Actor, project_id: int) -> list[InviteLinkView]:
        require_account(actor)
        record = self._t.projects.get(project_id)
        if record is None:
            raise NotFoundError("Project not found.")
        record.team.ensure_lead(actor.account_id, "see the invite links")
        return [self._view(link) for link in self._links.for_project(project_id)]

    def _revoke_live(self, project_id: int) -> None:
        now = self._t.clock.now()
        for live in self._links.live_for_project(project_id):
            self._links.save(live.revoke(now))

    # --- whoever holds the link ---------------------------------------------------------------

    def get(self, actor: Actor, token: str) -> InviteLinkView:
        require_account(actor)
        link = self._links.by_token(token)
        if link is None:
            raise NotFoundError(LINK_NOT_FOUND)
        return self._view(link)

    def accept(self, actor: Actor, token: str) -> JoinedView:
        """A developer joins the team, taking one open spot; the link is then used."""
        developer_id = require_account(actor)
        if not self._t.accounts.is_developer(actor.clerk_user_id):
            raise ForbiddenError("Only developers can join a team. Clients hire a Team Lead instead.")
        found = self._links.by_token(token)
        if found is None:
            raise NotFoundError(LINK_NOT_FOUND)
        with self._t.uow.atomic():
            team = self._t.lock_team(found.project_id)
            link = self._links.by_token(token)  # read again under the team lock
            assert link is not None
            now = self._t.clock.now()
            used = link.use(developer_id, now)  # refuses expired, used and revoked links
            joined = team.with_member(developer_id)  # refuses the Lead, members, a full or closed team
            self._links.save(used)
            self._t.projects.save_team(joined)
            self._close_own_candidacy(found.project_id, developer_id)
            self._t.close_pending_if_full(found.project_id, joined)
            if joined.lead_account_id is not None:
                self._tell_lead(joined.lead_account_id, found.project_id, developer_id)
            return JoinedView(found.project_id, True)

    def _close_own_candidacy(self, project_id: int, developer_id: int) -> None:
        """An application or invitation they still had for this team ends: they're in."""
        pending = self._t.candidacies.find_pending(project_id, developer_id)
        if pending is None:
            return
        for closed in close_all([pending], JOINED_THROUGH_LINK, self._t.clock.now()):
            self._t.candidacies.save(closed)
            self._t.conversations.close_for_candidacy(closed.id, JOINED_THROUGH_LINK)
            self._t.announce(closed)

    def _tell_lead(self, lead_id: int, project_id: int, developer_id: int) -> None:
        name = self._t.names.names([developer_id]).get(developer_id, "A developer")
        self._notify.send(
            Notification(
                lead_id,
                NotificationCategory.TEAM,
                "invite_link_used",
                f"{name} joined your team",
                f"{name} joined through your invite link.",
                f"/projects/{project_id}",
            )
        )
