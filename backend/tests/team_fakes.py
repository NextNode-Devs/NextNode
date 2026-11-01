"""In-memory fakes for the Hire Devs ports, on top of #3's ``InMemoryProjects``."""

from contextlib import contextmanager
from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID

from nextnode.domain.teams import Candidacy, CandidacyKind, DuplicateCandidacyError


class FakeCandidacies:
    def __init__(self) -> None:
        self.rows: dict[UUID, Candidacy] = {}

    def add(self, candidacy: Candidacy) -> Candidacy:
        if self.find_pending(candidacy.project_id, candidacy.developer_account_id):
            raise DuplicateCandidacyError("Already pending.")
        stored = replace(candidacy, created_at=datetime(2026, 11, 1, tzinfo=UTC))
        self.rows[stored.id] = stored
        return stored

    def get(self, candidacy_id: UUID) -> Candidacy | None:
        return self.rows.get(candidacy_id)

    def save(self, candidacy: Candidacy) -> None:
        self.rows[candidacy.id] = candidacy

    def find_pending(self, project_id: int, developer_account_id: int) -> Candidacy | None:
        for candidacy in self.pending_for_project(project_id):
            if candidacy.developer_account_id == developer_account_id:
                return candidacy
        return None

    def has_applied(self, project_id: int, developer_account_id: int) -> bool:
        return any(
            c.project_id == project_id
            and c.developer_account_id == developer_account_id
            and c.kind is CandidacyKind.APPLICATION
            for c in self.rows.values()
        )

    def pending_for_project(self, project_id: int) -> list[Candidacy]:
        return [c for c in self.rows.values() if c.project_id == project_id and c.is_pending]

    def for_account(self, account_id: int) -> list[Candidacy]:
        return [c for c in reversed(self.rows.values()) if c.involves(account_id)]


class FakeAccounts:
    """``developers`` are account ids; a Clerk id is ``user_<account id>``."""

    def __init__(self, developers: set[int]) -> None:
        self.developers = developers

    def is_developer(self, clerk_user_id: str) -> bool:
        return clerk_user_id.removeprefix("user_") in {str(d) for d in self.developers}

    def is_developer_account(self, account_id: int) -> bool:
        return account_id in self.developers


class FakeConversations:
    def __init__(self) -> None:
        self.opened: list[tuple[UUID, int, int]] = []
        self.closed: dict[UUID, str] = {}

    def open_for_candidacy(self, candidacy_id: UUID, lead_account_id: int, developer_account_id: int) -> None:
        self.opened.append((candidacy_id, lead_account_id, developer_account_id))

    def close_for_candidacy(self, candidacy_id: UUID, reason: str) -> None:
        self.closed[candidacy_id] = reason

    def conversation_id_for(self, candidacy_id: UUID) -> str | None:
        known = any(opened[0] == candidacy_id for opened in self.opened)
        return f"conversation-{candidacy_id}" if known else None


class FakeEvents:
    def __init__(self) -> None:
        self.frames: list[tuple[tuple[int, ...], dict]] = []

    def publish(self, account_ids: tuple[int, ...], event: dict) -> None:
        self.frames.append((account_ids, event))


class FakeUnitOfWork:
    @contextmanager
    def atomic(self):
        yield
