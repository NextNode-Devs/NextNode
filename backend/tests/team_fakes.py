"""In-memory fakes for the Hire Devs ports: no database, no #1, #3 or #4."""

import copy
from contextlib import contextmanager
from uuid import UUID

from nextnode.domain.teams import Candidacy, TeamRoster


class TeamStore:
    def __init__(self) -> None:
        self.rosters: dict[int, TeamRoster] = {}
        self.candidacies: dict[UUID, Candidacy] = {}
        self.developers: set[str] = set()
        self.opened: list[tuple[UUID, int, str, str]] = []
        self.closed: dict[UUID, str] = {}


class FakeRosters:
    def __init__(self, store: TeamStore) -> None:
        self.store = store

    def get_for_update(self, team_id: int) -> TeamRoster | None:
        roster = self.store.rosters.get(team_id)
        return copy.deepcopy(roster) if roster else None

    def save(self, roster: TeamRoster) -> None:
        self.store.rosters[roster.team_id] = copy.deepcopy(roster)


class FakeCandidacies:
    def __init__(self, store: TeamStore) -> None:
        self.store = store

    def get(self, candidacy_id: UUID) -> Candidacy | None:
        candidacy = self.store.candidacies.get(candidacy_id)
        return copy.deepcopy(candidacy) if candidacy else None

    def find_pending(self, team_id: int, developer_user_id: str) -> Candidacy | None:
        for c in self.pending_for_team(team_id):
            if c.developer_user_id == developer_user_id:
                return c
        return None

    def pending_for_team(self, team_id: int) -> list[Candidacy]:
        return [
            copy.deepcopy(c) for c in self.store.candidacies.values() if c.team_id == team_id and c.is_pending
        ]

    def save(self, candidacy: Candidacy) -> None:
        self.store.candidacies[candidacy.id] = copy.deepcopy(candidacy)


class FakeAccounts:
    def __init__(self, store: TeamStore) -> None:
        self.store = store

    def is_developer(self, clerk_user_id: str) -> bool:
        return clerk_user_id in self.store.developers


class FakeConversations:
    def __init__(self, store: TeamStore) -> None:
        self.store = store

    def open_for_candidacy(
        self, candidacy_id: UUID, team_id: int, lead_user_id: str, developer_user_id: str
    ) -> None:
        self.store.opened.append((candidacy_id, team_id, lead_user_id, developer_user_id))

    def close_for_candidacy(self, candidacy_id: UUID, reason: str) -> None:
        self.store.closed[candidacy_id] = reason


class FakeUnitOfWork:
    """Rolls the store back when the block raises, like a database transaction."""

    def __init__(self, store: TeamStore) -> None:
        self.store = store

    @contextmanager
    def atomic(self):
        snapshot = copy.deepcopy(self.store.__dict__)
        try:
            yield
        except BaseException:
            self.store.__dict__ = snapshot
            raise
