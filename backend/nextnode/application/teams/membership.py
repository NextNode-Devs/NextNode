"""AcceptApplication and AcceptInvitation: a candidacy becomes membership.

The Team Lead accepts applications; only the invited developer accepts an
invitation. Each takes one spot; the last spot closes everyone else's.
"""

from __future__ import annotations

from uuid import UUID

from nextnode.application.ports import Actor
from nextnode.application.teams.dto import CandidacyView, MembershipResult, RosterUpdate
from nextnode.application.teams.ports import (
    CandidacyRepository,
    HiringConversations,
    TeamRosterRepository,
    UnitOfWork,
)
from nextnode.application.teams.recruiting import close_if_full
from nextnode.domain.errors import NotFoundError
from nextnode.domain.teams import CandidacyKind, accept


class _AcceptCandidacy:
    kind: CandidacyKind

    def __init__(
        self,
        rosters: TeamRosterRepository,
        candidacies: CandidacyRepository,
        conversations: HiringConversations,
        uow: UnitOfWork,
    ) -> None:
        self._rosters = rosters
        self._candidacies = candidacies
        self._conversations = conversations
        self._uow = uow

    def execute(self, actor: Actor, candidacy_id: UUID) -> MembershipResult:
        not_found = NotFoundError(f"{self.kind.capitalize()} not found.")
        with self._uow.atomic():
            found = self._candidacies.get(candidacy_id)
            if found is None or found.kind is not self.kind:
                raise not_found
            roster = self._rosters.get_for_update(found.team_id)
            # Read again under the team lock: another accept may have changed it.
            candidacy = self._candidacies.get(candidacy_id)
            if roster is None or candidacy is None:
                raise not_found
            # Only its two participants know the candidacy exists.
            if actor.clerk_user_id not in (roster.lead_user_id, candidacy.developer_user_id):
                raise not_found
            accept(candidacy, roster, actor.clerk_user_id)
            self._candidacies.save(candidacy)
            self._rosters.save(roster)
            closed = close_if_full(roster, self._candidacies, self._conversations)
        return MembershipResult(CandidacyView.of(candidacy), RosterUpdate.of(roster, closed))


class AcceptApplication(_AcceptCandidacy):
    kind = CandidacyKind.APPLICATION


class AcceptInvitation(_AcceptCandidacy):
    kind = CandidacyKind.INVITATION
