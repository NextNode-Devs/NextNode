"""Deciding a candidacy: accepted, it becomes membership; otherwise it ends.

The Team Lead accepts or rejects applications; only the invited developer
accepts or declines an invitation. Accepting takes one spot; the last spot
closes everyone else's.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from nextnode.application.ports import Actor
from nextnode.application.teams.deps import TeamDeps, require_account
from nextnode.application.teams.dto import CandidacyView
from nextnode.domain.errors import NotFoundError
from nextnode.domain.teams import Candidacy, CandidacyKind


class _Decision:
    kind: CandidacyKind

    def __init__(self, deps: TeamDeps) -> None:
        self._d = deps

    def _load(self, actor: Actor, candidacy_id: UUID) -> Candidacy:
        """Only its two people know a candidacy exists, and a kind's own URL finds only that kind."""
        candidacy = self._d.candidacies.get(candidacy_id)
        if candidacy is None or candidacy.kind is not self.kind or not candidacy.involves(actor.account_id):
            raise NotFoundError(f"{self.kind.capitalize()} not found.")
        return candidacy


class _Accept(_Decision):
    def execute(self, actor: Actor, candidacy_id: UUID) -> CandidacyView:
        actor_id = require_account(actor)
        with self._d.uow.atomic():
            found = self._load(actor, candidacy_id)
            team = self._d.lock_team(found.project_id)
            # Read again under the team lock: another accept may have changed it.
            candidacy = self._load(actor, candidacy_id)
            accepted, joined = candidacy.accept(team, actor_id, self._d.clock.now())
            self._d.candidacies.save(accepted)
            self._d.projects.save_team(joined)
            self._d.close_pending_if_full(accepted.project_id, joined)
            self._d.announce(accepted)
            return self._d.view(accepted, actor)


class _End(_Decision):
    """A decision that ends the candidacy and closes its conversation with the reason."""

    def change(self, candidacy: Candidacy, actor_id: int, at: datetime) -> Candidacy:
        raise NotImplementedError

    def execute(self, actor: Actor, candidacy_id: UUID) -> CandidacyView:
        actor_id = require_account(actor)
        with self._d.uow.atomic():
            found = self._load(actor, candidacy_id)
            self._d.lock_team(found.project_id)
            candidacy = self._load(actor, candidacy_id)
            ended = self.change(candidacy, actor_id, self._d.clock.now())
            self._d.candidacies.save(ended)
            self._d.conversations.close_for_candidacy(ended.id, ended.closed_reason)
            self._d.announce(ended)
            return self._d.view(ended, actor)


class AcceptApplication(_Accept):
    kind = CandidacyKind.APPLICATION


class RejectApplication(_End):
    kind = CandidacyKind.APPLICATION

    def change(self, candidacy: Candidacy, actor_id: int, at: datetime) -> Candidacy:
        return candidacy.reject(actor_id, at)


class WithdrawApplication(_End):
    kind = CandidacyKind.APPLICATION

    def change(self, candidacy: Candidacy, actor_id: int, at: datetime) -> Candidacy:
        return candidacy.withdraw(actor_id, at)


class AcceptInvitation(_Accept):
    kind = CandidacyKind.INVITATION


class DeclineInvitation(_End):
    kind = CandidacyKind.INVITATION

    def change(self, candidacy: Candidacy, actor_id: int, at: datetime) -> Candidacy:
        return candidacy.decline(actor_id, at)
