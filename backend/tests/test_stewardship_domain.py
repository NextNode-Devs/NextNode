"""The NN-39 rules themselves: closing developer projects, the Assistant Lead, and the activity check."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from nextnode.domain.errors import ConflictError, ForbiddenError, InvalidStateTransitionError, ValidationError
from nextnode.domain.projects import (
    ANSWER_DAYS,
    LEAD_INACTIVE_DAYS,
    ActivityCheck,
    ActivityCheckStatus,
    Project,
    ProjectDetails,
    ProjectKind,
    ProjectStatus,
    Team,
    inactive_since,
)

NOW = datetime(2026, 11, 21, 9, tzinfo=UTC)
TEAM = replace(Team.for_new_project(1), member_account_ids=(10, 11))


def project(kind: ProjectKind, status: ProjectStatus = ProjectStatus.POSTED) -> Project:
    details = ProjectDetails("Habit tracker", "A small habit tracker.", (), NOW.date(), None)
    return replace(Project.publish(kind, 1, details), status=status)


@pytest.mark.parametrize("status", [ProjectStatus.POSTED, ProjectStatus.IN_PROGRESS])
def test_open_developer_projects_can_be_closed(status):
    assert project(ProjectKind.DEVELOPER, status).close().status is ProjectStatus.CLOSED


@pytest.mark.parametrize("status", [ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED, ProjectStatus.CLOSED])
def test_finished_projects_cannot_be_closed(status):
    with pytest.raises(InvalidStateTransitionError):
        project(ProjectKind.DEVELOPER, status).close()


def test_client_projects_are_never_closed_this_way():
    with pytest.raises(InvalidStateTransitionError, match="Client projects"):
        project(ProjectKind.CLIENT).close()


def test_the_assistant_lead_is_one_member_chosen_by_the_lead():
    team = TEAM.with_assistant_lead(1, 10)
    assert team.is_assistant_lead(10) and team.is_steward(10) and team.is_steward(1)
    assert not team.is_steward(11)
    with pytest.raises(ForbiddenError):
        team.with_assistant_lead(10, 11)
    with pytest.raises(ValidationError):
        team.with_assistant_lead(1, 1)


def test_thirty_days_is_the_threshold():
    assert not inactive_since(NOW, NOW + timedelta(days=LEAD_INACTIVE_DAYS) - timedelta(seconds=1))
    assert inactive_since(NOW, NOW + timedelta(days=LEAD_INACTIVE_DAYS))


def test_a_check_gives_members_seven_days():
    check = ActivityCheck.ask(5, NOW)
    assert check.answer_by == NOW + timedelta(days=ANSWER_DAYS)
    with pytest.raises(ConflictError):
        check.expire(NOW + timedelta(days=ANSWER_DAYS - 1))
    assert check.expire(check.answer_by).status is ActivityCheckStatus.CLOSED
    with pytest.raises(ConflictError, match="time to answer has passed"):
        check.confirm(TEAM, 10, check.answer_by)


def test_who_may_answer():
    check = ActivityCheck.ask(5, NOW)
    assert check.confirm(TEAM, 10, NOW).status is ActivityCheckStatus.CONFIRMED
    assert check.confirm(TEAM, 1, NOW).status is ActivityCheckStatus.LEAD_RETURNED
    with pytest.raises(ForbiddenError):
        check.confirm(TEAM, 99, NOW)
    with pytest.raises(ConflictError):
        check.confirm(TEAM, 10, NOW).confirm(TEAM, 11, NOW)
