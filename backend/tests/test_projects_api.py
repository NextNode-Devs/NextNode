"""/api/projects/ and /api/project-ideas/ end to end (#3): Clerk-shaped tokens
signed locally, real PostgreSQL, the real Hire Lead adapter."""

from datetime import date, timedelta

import pytest
from django.db import IntegrityError, transaction

from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.persistence.models import ProjectModel

pytestmark = pytest.mark.django_db

FUTURE = (date.today() + timedelta(days=90)).isoformat()
BRIEF = {
    "title": "Booking app",
    "description": "A booking app for a small yoga studio.",
    "tech_stack": ["React", "Django"],
    "target_delivery_date": FUTURE,
    "proposed_budget_cents": 250_000,
}
IDEA = {
    "title": "Open-source habit tracker",
    "description": "A habit tracker with streaks and reminders.",
    "tech_stack": ["Next.js", "React"],
    "target_delivery_date": FUTURE,
}


@pytest.fixture(autouse=True)
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def onboard(api, auth):
    def create(sub: str, role: str = "developer", name: str = "Ada") -> int:
        body: dict = {"role": role, "display_name": name}
        if role == "developer":
            body["developer"] = {"headline": "Backend dev", "skills": ["Python"]}
        else:
            body["client"] = {"company_name": "Acme", "industry": "Retail"}
        response = api.post("/api/onboarding/", data=body, format="json", **auth(sub))
        assert response.status_code == 201, response.json()
        return response.json()["data"]["id"]

    return create


@pytest.fixture
def people(onboard):
    return {
        "client": onboard("client_grace", "client", "Grace"),
        "other_client": onboard("client_other", "client", "Other"),
        "ada": onboard("dev_ada", name="Ada"),
        "linus": onboard("dev_linus", name="Linus"),
    }


def post_brief(api, auth, body=BRIEF, sub="client_grace"):
    return api.post("/api/projects/", data=body, format="json", **auth(sub))


def post_idea(api, auth, body=IDEA, sub="dev_ada"):
    return api.post("/api/project-ideas/", data=body, format="json", **auth(sub))


def test_projects_need_a_token(api):
    assert api.get("/api/projects/").status_code == 401
    assert api.post("/api/projects/", data=BRIEF, format="json").status_code == 401


def test_ac1_a_client_publishes_a_brief_seen_in_my_projects_and_search(api, auth, people):
    response = post_brief(api, auth)
    assert response.status_code == 201, response.json()
    project = response.json()["data"]
    assert (project["kind"], project["status"], project["proposed_budget_cents"]) == (
        "client",
        "Posted",
        250_000,
    )
    assert project["owner"]["display_name"] == "Grace" and project["lead"] is None
    mine = api.get("/api/projects/mine/", **auth("client_grace")).json()["data"]
    assert [(m["project"]["id"], m["my_role"]) for m in mine] == [(project["id"], "owner")]
    found = api.get("/api/projects/?kind=client", **auth("dev_ada")).json()["data"]["results"]
    assert [p["id"] for p in found] == [project["id"]] and found[0]["needs_lead"] is True


def test_ac1_a_budget_below_the_minimum_is_refused_on_the_field(api, auth, people):
    response = post_brief(api, auth, {**BRIEF, "proposed_budget_cents": 149_999})
    assert response.status_code == 400
    assert response.json()["error"]["fields"] == {"proposed_budget_cents": ["Must be at least CAD 1,500.00."]}
    assert ProjectModel.objects.count() == 0


def test_ac1_required_fields_are_refused_with_field_messages(api, auth, people):
    response = post_brief(
        api, auth, {**BRIEF, "title": "", "tech_stack": [], "target_delivery_date": "2020-01-01"}
    )
    assert response.status_code == 400
    assert {"title", "target_delivery_date"} <= set(response.json()["error"]["fields"])
    missing = post_brief(api, auth, {"title": "Booking app"})
    assert missing.status_code == 400 and "description" in missing.json()["error"]["fields"]


def test_ac2_a_developer_idea_shows_its_creator_as_lead_and_has_no_budget_key(api, auth, people):
    response = post_idea(api, auth)
    assert response.status_code == 201, response.json()
    idea = response.json()["data"]
    assert idea["lead"] == {"account_id": people["ada"], "display_name": "Ada"}
    assert idea["viewer"]["is_lead"] is True
    assert "proposed_budget_cents" not in idea
    detail = api.get(f"/api/projects/{idea['id']}/", **auth("client_grace")).json()["data"]
    assert "proposed_budget_cents" not in detail
    listed = api.get("/api/projects/?kind=developer", **auth("dev_linus")).json()["data"]["results"]
    assert "proposed_budget_cents" not in listed[0]


def test_ac2_an_idea_with_a_budget_is_refused(api, auth, people):
    response = post_idea(api, auth, {**IDEA, "proposed_budget_cents": 200_000})
    assert response.status_code == 400
    assert "proposed_budget_cents" in response.json()["error"]["fields"]


def test_ac3_each_role_creates_only_its_own_kind(api, auth, people):
    assert post_brief(api, auth, sub="dev_ada").status_code == 403
    assert post_idea(api, auth, sub="client_grace").status_code == 403


def test_ac4_only_the_owner_edits_and_only_before_a_lead_is_hired(api, auth, people):
    project_id = post_brief(api, auth).json()["data"]["id"]
    url = f"/api/projects/{project_id}/"
    edited = api.patch(url, data={**BRIEF, "title": "Studio booking"}, format="json", **auth("client_grace"))
    assert edited.status_code == 200 and edited.json()["data"]["title"] == "Studio booking"
    assert api.patch(url, data=BRIEF, format="json", **auth("client_other")).status_code == 403
    assert api.patch(url, data=BRIEF, format="json", **auth("dev_ada")).status_code == 403

    # #4 hires Ada through the real adapter; the brief locks.
    candidacy = api.post(
        f"/api/projects/{project_id}/lead-applications/", {}, format="json", **auth("dev_ada")
    )
    assert candidacy.status_code == 201, candidacy.json()
    hired = api.post(f"/api/lead-candidacies/{candidacy.json()['data']['id']}/hire/", **auth("client_grace"))
    assert hired.status_code == 200, hired.json()
    detail = api.get(url, **auth("client_grace")).json()["data"]
    assert detail["lead"]["display_name"] == "Ada" and detail["viewer"]["can_edit"] is False
    refused = api.patch(url, data=BRIEF, format="json", **auth("client_grace"))
    assert refused.status_code == 409
    assert refused.json()["error"] == {
        "code": "CONFLICT",
        "message": "This project has a Team Lead now, so its brief can no longer be edited.",
    }


def test_ac4_editing_a_project_past_posted_is_409(api, auth, people):
    project_id = post_brief(api, auth).json()["data"]["id"]
    ProjectModel.objects.filter(pk=project_id).update(status="OfferSent")
    response = api.patch(f"/api/projects/{project_id}/", data=BRIEF, format="json", **auth("client_grace"))
    assert response.status_code == 409 and "OfferSent" in response.json()["error"]["message"]


def test_ac5_search_filters_combine_and_show_nothing_when_nothing_matches(api, auth, people):
    brief = post_brief(api, auth).json()["data"]["id"]
    idea = post_idea(api, auth).json()["data"]["id"]

    def ids(query: str) -> list[int]:
        response = api.get(f"/api/projects/?{query}", **auth("dev_linus"))
        assert response.status_code == 200, response.json()
        return [p["id"] for p in response.json()["data"]["results"]]

    assert ids("") == [idea, brief]
    assert ids("tech=react") == [idea, brief]
    assert ids("tech=react,django") == [brief]
    assert ids("kind=developer&tech=react") == [idea]
    assert ids("needs_lead=true") == [brief]
    assert ids("kind=developer&needs_lead=true") == []
    assert ids("open_spots=true") == []  # no team has a size until #5
    assert api.get("/api/projects/?kind=robot", **auth("dev_linus")).status_code == 400


def test_ac6_an_idea_can_never_be_offer_sent_even_in_the_database(people):
    from nextnode.infrastructure.persistence.models import AccountModel

    owner = AccountModel.objects.get(pk=people["ada"])
    with pytest.raises(IntegrityError), transaction.atomic():
        ProjectModel.objects.create(
            kind="developer",
            owner=owner,
            status="OfferSent",
            title="Idea",
            description="x" * 20,
            target_delivery_date=FUTURE,
        )


def test_ac7_apply_to_lead_is_never_offered_on_an_idea(api, auth, people):
    brief = post_brief(api, auth).json()["data"]["id"]
    idea = post_idea(api, auth).json()["data"]["id"]
    assert api.get(f"/api/projects/{brief}/", **auth("dev_linus")).json()["data"]["viewer_actions"] == [
        "apply_to_lead"
    ]
    assert api.get(f"/api/projects/{idea}/", **auth("dev_linus")).json()["data"]["viewer_actions"] == []
    assert (
        api.post(
            f"/api/projects/{idea}/lead-applications/", {}, format="json", **auth("dev_linus")
        ).status_code
        == 400
    )


def test_an_unknown_project_is_404(api, auth, people):
    assert api.get("/api/projects/999999/", **auth("dev_ada")).status_code == 404
