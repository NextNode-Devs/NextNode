"""Hire Devs use cases with in-memory fakes: no database, no sockets."""

from dataclasses import replace
from datetime import date
from uuid import UUID

import pytest

from nextnode.application.ports import Actor
from nextnode.application.teams.deps import TeamDeps
from nextnode.application.teams.use_cases import TeamUseCases
from nextnode.domain.accounts import Role
from nextnode.domain.errors import ForbiddenError, NotFoundError
from nextnode.domain.projects import Project, ProjectDetails, ProjectKind
from nextnode.domain.teams import (
    CandidacyStatus,
    Team,
    TeamNotRecruitingError,
    TeamSizeError,
    TeamStatus,
)
from tests.project_fakes import FixedClock, InMemoryProjects
from tests.team_fakes import FakeAccounts, FakeCandidacies, FakeConversations, FakeEvents, FakeUnitOfWork

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


@pytest.fixture
def w() -> World:
    return World()


@pytest.fixture
def project(w: World) -> int:
    return w.project()


# --- SetTeamSize ----------------------------------------------------------------


def test_the_lead_sets_the_team_size(w, project):
    view = w.uc.set_team_size.execute(LEAD, project, 6)
    assert (view.size, view.developer_spots, view.open_spots, view.status) == (6, 5, 5, "open")
    assert w.team(project).team_size == 6


@pytest.mark.parametrize("size", [4, 8])
def test_a_size_outside_five_to_seven_is_refused(w, project, size):
    with pytest.raises(TeamSizeError):
        w.uc.set_team_size.execute(LEAD, project, size)
    assert w.team(project).team_size is None


@pytest.mark.parametrize("who", [dev(0), CLIENT])
def test_only_the_lead_sets_the_size(w, project, who):
    with pytest.raises(ForbiddenError, match="Only this team's Team Lead"):
        w.uc.set_team_size.execute(who, project, 6)
    assert w.team(project).team_size is None


def test_nobody_sets_a_size_before_a_lead_is_hired(w):
    project = w.project(lead_id=None)
    with pytest.raises(ForbiddenError):
        w.uc.set_team_size.execute(CLIENT, project, 5)


def test_the_size_of_a_missing_project_is_not_found(w):
    with pytest.raises(NotFoundError):
        w.uc.set_team_size.execute(LEAD, 99, 6)


def test_the_size_cannot_shrink_below_the_people_already_on_the_team(w, project):
    w.uc.set_team_size.execute(LEAD, project, 7)
    for n in range(5):
        w.projects.add_member(project, DEV_IDS[n])
    with pytest.raises(TeamSizeError, match="already has 6 people"):
        w.uc.set_team_size.execute(LEAD, project, 5)
    assert w.team(project).team_size == 7


def test_a_locked_team_refuses_a_new_size(w, project):
    w.uc.set_team_size.execute(LEAD, project, 7)
    w.set_status(project, TeamStatus.LOCKED)
    with pytest.raises(TeamNotRecruitingError, match="Recruitment has closed"):
        w.uc.set_team_size.execute(LEAD, project, 6)


def test_shrinking_to_the_current_headcount_closes_pending_candidacies(w, project):
    w.uc.set_team_size.execute(LEAD, project, 6)
    for n in range(4):
        w.projects.add_member(project, DEV_IDS[n])
    waiting = w.uc.apply_to_join.execute(dev(5), project)
    view = w.uc.set_team_size.execute(LEAD, project, 5)
    assert view.open_spots == 0
    assert view.closed_candidacy_ids == [waiting.id]
    assert w.conversations.closed[UUID(waiting.id)] == "The team is full"
    assert w.candidacies.get(UUID(waiting.id)).status is CandidacyStatus.CLOSED


def test_works_with_the_creator_as_lead_on_a_developer_idea(w):
    idea = w.project(kind=ProjectKind.DEVELOPER)
    assert w.uc.set_team_size.execute(LEAD, idea, 5).open_spots == 4
