"""In-memory fakes for the Hire Devs ports, on top of #3's ``InMemoryProjects``."""

from contextlib import contextmanager
from dataclasses import replace
from datetime import UTC, date, datetime
from uuid import UUID

from nextnode.application.ports import Actor
from nextnode.application.teams.deps import TeamDeps
from nextnode.application.teams.use_cases import TeamUseCases
from nextnode.domain.accounts import Role
from nextnode.domain.projects import Project, ProjectDetails, ProjectKind
from nextnode.domain.teams import Candidacy, CandidacyKind, DuplicateCandidacyError, Team, TeamStatus
from tests.project_fakes import FixedClock, InMemoryProjects


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


class FakeNames:
    def names(self, account_ids: list[int]) -> dict[int, str]:
        return {account_id: f"Person {account_id}" for account_id in account_ids}


class FakeMembers:
    def __init__(self, records) -> None:
        self.records = records

    def for_project(self, project_id: int):
        return self.records


CLIENT_ID = 1
LEAD_ID = 2
STRANGER_ID = 3
DEV_IDS = tuple(range(10, 20))


def actor(account_id: int, role: Role = Role.DEVELOPER) -> Actor:
    return Actor(f"user_{account_id}", f"sess_{account_id}", account_id, role)


LEAD = actor(LEAD_ID)
CLIENT = actor(CLIENT_ID, Role.CLIENT)
STRANGER = actor(STRANGER_ID)


def dev(n: int) -> Actor:
    return actor(DEV_IDS[n])


class World:
    def __init__(self) -> None:
        self.projects = InMemoryProjects()
        self.candidacies = FakeCandidacies()
        self.conversations = FakeConversations()
        self.events = FakeEvents()
        ids = (UUID(int=n) for n in range(1, 100))
        self.uc = TeamUseCases(
            TeamDeps(
                self.projects,
                self.candidacies,
                FakeAccounts({LEAD_ID, STRANGER_ID, *DEV_IDS}),
                self.conversations,
                self.events,
                FakeNames(),
                FixedClock(),
                FakeUnitOfWork(),
                new_id=lambda: next(ids),
            )
        )

    def project(self, lead_id: int | None = LEAD_ID, kind: ProjectKind = ProjectKind.CLIENT) -> int:
        details = ProjectDetails("Booking app", "A booking app.", (), date(2027, 1, 1))
        owner = CLIENT_ID if kind is ProjectKind.CLIENT else lead_id
        assert owner is not None
        record = self.projects.add(Project.publish(kind, owner, details), Team.for_new_project(lead_id))
        assert record.project.id is not None
        return record.project.id

    def team(self, project_id: int) -> Team:
        return self.projects.rows[project_id][1]

    def set_status(self, project_id: int, status: TeamStatus) -> None:
        project, team = self.projects.rows[project_id]
        self.projects.rows[project_id] = (project, replace(team, status=status))
