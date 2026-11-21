"""Assistant Lead and inactivity (NN-39) over REST with real PostgreSQL, and
the daily ``check_project_activity`` command."""

from dataclasses import replace
from datetime import date, timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from nextnode.domain.conversations import Subject, SubjectKind
from nextnode.domain.projects import Project, ProjectDetails, ProjectKind, Team
from nextnode.infrastructure.container import get_container, override_container
from nextnode.infrastructure.persistence.models import (
    ActivityCheckModel,
    ConversationModel,
    MessageModel,
    ProjectModel,
    TeamMembershipModel,
)
from tests.conversation_fakes import make_account


@pytest.fixture(autouse=True)
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def people(db):
    ids = {
        "lead": make_account("user_lead", "Ada", "developer"),
        "client": make_account("user_c", "Grace", "client"),
    }
    for n in range(3):
        ids[f"dev{n}"] = make_account(f"user_dev{n}", f"Dev {n}", "developer")
    ids["stranger"] = make_account("user_stranger", "Linus", "developer")
    return ids


def make_project(people, kind=ProjectKind.DEVELOPER, *, start=True) -> int:
    budget = 200_000 if kind is ProjectKind.CLIENT else None
    owner = people["lead"] if kind is ProjectKind.DEVELOPER else people["client"]
    details = ProjectDetails(
        "Habit tracker", "A small open-source habit tracker.", (), date(2027, 1, 1), budget
    )
    c = get_container()
    record = c.projects.add(Project.publish(kind, owner, details), Team.for_new_project(people["lead"]))
    members = tuple(people[f"dev{n}"] for n in range(3))
    c.projects.save_team(replace(record.team, member_account_ids=members))
    pid = record.project.id
    if start:  # what the start gate does: InProgress and the workspace chat
        c.projects.save(record.project.start())
        c.open_conversation.execute(
            Subject(SubjectKind.PROJECT_WORKSPACE, str(pid)), [people["lead"], *members]
        )
    return pid


def run_as_of(at) -> str:
    out = StringIO()
    call_command("check_project_activity", "--as-of", at.isoformat(), stdout=out)
    return out.getvalue()


def stewardship(api, auth, pid, sub="user_lead"):
    return api.get(f"/api/projects/{pid}/stewardship/", **auth(sub))


@pytest.mark.django_db
def test_the_lead_chooses_an_assistant_lead_shown_on_the_roster(api, auth, people):
    pid = make_project(people)
    response = api.put(
        f"/api/projects/{pid}/assistant-lead/",
        {"account_id": people["dev1"]},
        format="json",
        **auth("user_lead"),
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["assistant_lead"] == {"account_id": people["dev1"], "display_name": "Dev 1"}
    assert "Remove the Team Lead" in data["assistant_lead_cannot"]
    roster = api.get(f"/api/projects/{pid}/team/", **auth("user_stranger")).json()["data"]["members"]
    assert {m["account_id"]: m["role"] for m in roster}[people["dev1"]] == "assistant_lead"

    # Replacing them keeps one Assistant Lead; the database refuses two.
    api.put(
        f"/api/projects/{pid}/assistant-lead/",
        {"account_id": people["dev2"]},
        format="json",
        **auth("user_lead"),
    )
    roles = TeamMembershipModel.objects.filter(team__project_id=pid).values_list("account_id", "role")
    assert dict(roles)[people["dev1"]] == "member" and dict(roles)[people["dev2"]] == "assistant_lead"


@pytest.mark.django_db
def test_only_the_team_sees_it_and_only_the_lead_chooses(api, auth, people):
    pid = make_project(people)
    assert stewardship(api, auth, pid, "user_stranger").status_code == 403
    assert stewardship(api, auth, pid, "user_dev0").status_code == 200
    chosen = api.put(
        f"/api/projects/{pid}/assistant-lead/",
        {"account_id": people["dev1"]},
        format="json",
        **auth("user_dev0"),
    )
    assert chosen.status_code == 403


@pytest.mark.django_db
def test_client_projects_have_none(api, auth, people):
    pid = make_project(people, ProjectKind.CLIENT, start=False)
    response = api.put(
        f"/api/projects/{pid}/assistant-lead/",
        {"account_id": people["dev1"]},
        format="json",
        **auth("user_lead"),
    )
    assert response.status_code == 409


@pytest.mark.django_db
def test_thirty_silent_days_ask_the_members_and_a_confirmer_is_elected(api, auth, people):
    pid = make_project(people)
    opened = ConversationModel.objects.get(subject_id=str(pid)).created_at

    assert "Asked no projects" in run_as_of(opened + timedelta(days=29))
    assert f"Asked projects {pid}" in run_as_of(opened + timedelta(days=30))
    pending = stewardship(api, auth, pid, "user_dev0").json()["data"]
    assert pending["activity_check"]["status"] == "pending" and pending["actions"]["confirm_active"]

    # The confirmation happens "now", which is before the simulated deadline.
    ActivityCheckModel.objects.filter(project_id=pid).update(
        started_at=timezone.now() - timedelta(days=1), answer_by=timezone.now() + timedelta(days=6)
    )
    confirmed = api.post(f"/api/projects/{pid}/activity-check/confirm/", **auth("user_dev2")).json()["data"]
    assert confirmed["activity_check"]["status"] == "confirmed"
    assert confirmed["assistant_lead"]["account_id"] == people["dev2"]
    assert confirmed["hidden_from_feed"] is False


@pytest.mark.django_db
def test_no_answer_in_seven_days_closes_the_project(api, auth, people):
    pid = make_project(people)
    opened = ConversationModel.objects.get(subject_id=str(pid)).created_at
    run_as_of(opened + timedelta(days=30))
    assert "closed no projects" in run_as_of(opened + timedelta(days=36, hours=23))
    assert f"closed projects {pid}" in run_as_of(opened + timedelta(days=37))
    assert ProjectModel.objects.get(pk=pid).status == "Closed"
    assert ActivityCheckModel.objects.get(project_id=pid).status == "closed"


@pytest.mark.django_db
def test_a_lead_message_ends_the_wait(api, auth, people):
    pid = make_project(people)
    workspace = ConversationModel.objects.get(subject_id=str(pid))
    run_as_of(workspace.created_at + timedelta(days=30))
    message = MessageModel.objects.create(conversation=workspace, author_id=people["lead"], body="Back!")
    MessageModel.objects.filter(pk=message.pk).update(created_at=workspace.created_at + timedelta(days=31))
    assert f"Lead returned on projects {pid}" in run_as_of(workspace.created_at + timedelta(days=32))
    assert ProjectModel.objects.get(pk=pid).status == "InProgress"


@pytest.mark.django_db
def test_member_messages_do_not_count_as_lead_activity(api, auth, people):
    pid = make_project(people)
    workspace = ConversationModel.objects.get(subject_id=str(pid))
    message = MessageModel.objects.create(conversation=workspace, author_id=people["dev0"], body="Anyone?")
    MessageModel.objects.filter(pk=message.pk).update(created_at=workspace.created_at + timedelta(days=20))
    assert f"Asked projects {pid}" in run_as_of(workspace.created_at + timedelta(days=30))


@pytest.mark.django_db
def test_projects_waiting_for_an_answer_leave_the_feed(api, auth, people):
    pid = make_project(people, start=False)  # Posted, so it is in the feed
    assert pid in [
        p["id"] for p in api.get("/api/projects/", **auth("user_stranger")).json()["data"]["results"]
    ]
    now = timezone.now()
    ActivityCheckModel.objects.create(project_id=pid, started_at=now, answer_by=now + timedelta(days=7))
    assert pid not in [
        p["id"] for p in api.get("/api/projects/", **auth("user_stranger")).json()["data"]["results"]
    ]


@pytest.mark.django_db
def test_the_assistant_lead_closes_the_project_other_members_cannot(api, auth, people):
    pid = make_project(people)
    api.put(
        f"/api/projects/{pid}/assistant-lead/",
        {"account_id": people["dev0"]},
        format="json",
        **auth("user_lead"),
    )
    assert api.post(f"/api/projects/{pid}/close/", **auth("user_dev1")).status_code == 403
    closed = api.post(f"/api/projects/{pid}/close/", **auth("user_dev0"))
    assert closed.status_code == 200 and closed.json()["data"]["project_status"] == "Closed"
    assert api.post(f"/api/projects/{pid}/close/", **auth("user_lead")).status_code == 409


def test_the_command_refuses_a_date_without_a_utc_offset(db):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError, match="UTC offset"):
        call_command("check_project_activity", "--as-of", "2026-12-25T09:00:00")
