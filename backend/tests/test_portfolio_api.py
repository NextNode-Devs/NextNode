"""/api/developers/{id}/ and /api/developers/me/portfolio/ end to end (#2):
Clerk-shaped tokens signed locally, real PostgreSQL."""

import json

import pytest

from nextnode.infrastructure.container import override_container

pytestmark = pytest.mark.django_db

REPO = "https://github.com/ada/engine"
PORTFOLIO = {
    "headline": "Full-stack developer",
    "bio": "I build things.",
    "github_username": "ada",
    "skills": ["React", "Rust"],
    "projects": [
        {"title": "Engine", "repository_url": REPO, "demo_url": "https://engine.example.com"},
        {"title": "Notes", "repository_url": REPO},
    ],
    "resume_url": "https://example.com/cv.pdf",
    "is_available": True,
}


@pytest.fixture(autouse=True)
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture
def auth(make_token):
    def headers(sub: str) -> dict:
        return {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}

    return headers


@pytest.fixture
def onboard(api, auth):
    def create(sub: str, role: str = "developer", name: str = "Ada") -> int:
        body: dict = {"role": role, "display_name": name}
        if role == "developer":
            body["developer"] = {"headline": "Backend dev", "github_username": "ada", "skills": ["Python"]}
        else:
            body["client"] = {"company_name": "Acme", "industry": "Retail"}
        response = api.post("/api/onboarding/", data=body, format="json", **auth(sub))
        assert response.status_code == 201, response.json()
        return response.json()["data"]["id"]

    return create


def put_mine(api, auth, sub: str, body: dict = PORTFOLIO):
    return api.put("/api/developers/me/portfolio/", data=body, format="json", **auth(sub))


def test_viewing_a_portfolio_needs_a_token(api):
    assert api.get("/api/developers/1/").status_code == 401


def test_a_new_developer_portfolio_is_visible_to_a_client(api, auth, onboard):
    dev_id = onboard("dev_ada")
    onboard("client_acme", role="client")
    response = api.get(f"/api/developers/{dev_id}/", **auth("client_acme"))
    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["display_name"], data["headline"], data["is_available"]) == ("Ada", "Backend dev", False)
    assert (data["projects"], data["resume_url"], data["is_owner"]) == ([], None, False)
    assert data["github_url"] == "https://github.com/ada"


def test_a_client_account_has_no_portfolio(api, auth, onboard):
    client_id = onboard("client_acme", role="client")
    onboard("dev_ada")
    response = api.get(f"/api/developers/{client_id}/", **auth("dev_ada"))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_a_user_who_has_not_onboarded_cannot_view_portfolios(api, auth, onboard):
    dev_id = onboard("dev_ada")
    assert api.get(f"/api/developers/{dev_id}/", **auth("someone_new")).status_code == 403


def test_the_owner_updates_and_reads_back_their_portfolio(api, auth, onboard):
    dev_id = onboard("dev_ada")
    response = put_mine(api, auth, "dev_ada")
    assert response.status_code == 200, response.json()
    saved = response.json()["data"]
    assert saved == api.get("/api/developers/me/portfolio/", **auth("dev_ada")).json()["data"]
    assert saved == api.get(f"/api/developers/{dev_id}/", **auth("dev_ada")).json()["data"]
    assert saved["is_owner"] is True
    assert [p["demo_url"] for p in saved["projects"]] == ["https://engine.example.com", None]
    assert [s["label"] for s in saved["skills"]] == ["React", "Rust"]


def test_the_owner_may_also_save_through_their_own_id(api, auth, onboard):
    dev_id = onboard("dev_ada")
    response = api.put(f"/api/developers/{dev_id}/", data=PORTFOLIO, format="json", **auth("dev_ada"))
    assert response.status_code == 200


def test_editing_another_developers_portfolio_returns_403(api, auth, onboard):
    ada = onboard("dev_ada")
    onboard("dev_grace", name="Grace")
    onboard("client_acme", role="client")
    for sub in ("dev_grace", "client_acme"):
        response = api.put(f"/api/developers/{ada}/", data=PORTFOLIO, format="json", **auth(sub))
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN"
    assert api.get(f"/api/developers/{ada}/", **auth("dev_ada")).json()["data"]["headline"] == "Backend dev"


def test_a_client_has_no_portfolio_to_edit(api, auth, onboard):
    onboard("client_acme", role="client")
    response = put_mine(api, auth, "client_acme")
    assert response.status_code == 403
    assert response.json()["error"]["message"] == "Only developer accounts have a portfolio."


def test_a_user_who_has_not_onboarded_cannot_edit(api, auth):
    assert put_mine(api, auth, "someone_new").status_code == 403


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"resume_url": "example.com/cv"}, "resume_url"),
        ({"headline": "h" * 121}, "headline"),
        ({"skills": ["React", "react"]}, "skills"),
        (
            {"projects": [{"title": "Engine", "repository_url": "ftp://x.example"}]},
            "projects.0.repository_url",
        ),
        ({"projects": [{"title": "", "repository_url": REPO}]}, "projects.0.title"),
        ({"projects": [{"title": "Engine"}]}, "projects.0.repository_url"),  # missing: transport error
        ({"projects": [{"title": "E", "repository_url": REPO, "stars": 5}]}, "projects.0.stars"),
        ({"verified": True}, "verified"),  # unknown keys are refused, so nobody can set one
    ],
)
def test_invalid_input_is_refused_with_the_message_on_its_field(api, auth, onboard, change, field):
    onboard("dev_ada")
    response = put_mine(api, auth, "dev_ada", {**PORTFOLIO, **change})
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert list(error["fields"]) == [field]
    assert error["fields"][field][0]


def test_onboarding_transport_errors_now_use_dotted_field_names(api, auth):
    body = {"role": "developer", "display_name": "Ada", "developer": {"headline": "Dev", "skills": "Python"}}
    response = api.post("/api/onboarding/", data=body, format="json", **auth("dev_ada"))
    assert response.status_code == 400
    assert list(response.json()["error"]["fields"]) == ["developer.skills"]


def test_no_portfolio_response_says_verified(api, auth, onboard):
    dev_id = onboard("dev_ada")
    put_mine(api, auth, "dev_ada")
    body = api.get(f"/api/developers/{dev_id}/", **auth("dev_ada")).content.decode()
    assert "verif" not in json.dumps(json.loads(body)).lower()
