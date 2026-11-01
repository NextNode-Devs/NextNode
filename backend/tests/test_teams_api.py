"""Hire Devs over REST with real PostgreSQL: teams, candidacies, conversations and constraints."""

from datetime import date

import pytest

from nextnode.domain.projects import Project, ProjectDetails, ProjectKind, Team
from nextnode.infrastructure.container import get_container, override_container
from nextnode.infrastructure.persistence.models import TeamModel
from tests.conversation_fakes import make_account


@pytest.fixture(autouse=True)
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def people(db):
    ids = {
        "client": make_account("user_client", "Grace", "client"),
        "lead": make_account("user_lead", "Ada", "developer"),
        "other_lead": make_account("user_other_lead", "Edsger", "developer"),
    }
    for n in range(7):
        ids[f"dev{n}"] = make_account(f"user_dev{n}", f"Dev {n}", "developer")
    return ids


def make_project(owner: int, lead: int | None, kind: ProjectKind = ProjectKind.CLIENT) -> int:
    budget = 200_000 if kind is ProjectKind.CLIENT else None
    details = ProjectDetails("Booking app", "A booking app for a yoga studio.", (), date(2027, 1, 1), budget)
    record = get_container().projects.add(Project.publish(kind, owner, details), Team.for_new_project(lead))
    assert record.project.id is not None
    return record.project.id


@pytest.fixture
def project(people) -> int:
    return make_project(people["client"], people["lead"])


def set_size(api, auth, project_id, size, sub="user_lead"):
    return api.put(f"/api/projects/{project_id}/team/size/", {"size": size}, format="json", **auth(sub))


# --- team size ------------------------------------------------------------------


def test_the_lead_sets_the_size(api, auth, project):
    response = set_size(api, auth, project, 6)
    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["size"], data["open_spots"], data["developer_spots"], data["status"]) == (6, 5, 5, "open")
    assert TeamModel.objects.get(project_id=project).team_size == 6


@pytest.mark.parametrize("size", [4, 8])
def test_a_size_outside_the_rule_is_refused_naming_it(api, auth, project, size):
    response = set_size(api, auth, project, size)
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "TEAM_SIZE_INVALID"
    assert "5 to 7 people including the Team Lead" in error["message"]
    assert "size" in error["fields"]


def test_a_size_that_is_not_a_number_is_a_field_error(api, auth, project):
    response = set_size(api, auth, project, "lots")
    assert response.status_code == 400
    assert "size" in response.json()["error"]["fields"]


@pytest.mark.parametrize("sub", ["user_client", "user_dev0", "user_other_lead"])
def test_only_this_projects_lead_sets_the_size(api, auth, project, sub):
    assert set_size(api, auth, project, 6, sub=sub).status_code == 403


def test_a_missing_project_is_404_and_no_token_is_401(api, auth, project):
    assert set_size(api, auth, 99999, 6).status_code == 404
    assert api.put(f"/api/projects/{project}/team/size/", {"size": 6}, format="json").status_code == 401


def test_a_developer_idea_is_sized_by_its_creator(api, auth, people):
    idea = make_project(people["lead"], people["lead"], ProjectKind.DEVELOPER)
    assert set_size(api, auth, idea, 5).status_code == 200


def test_a_client_project_without_a_lead_refuses_everyone(api, auth, people):
    posted = make_project(people["client"], None)
    assert set_size(api, auth, posted, 5, sub="user_client").status_code == 403
