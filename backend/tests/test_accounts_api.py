"""/api/me/, /api/onboarding/ and /api/skills/ end to end: Clerk-shaped
tokens signed locally, real PostgreSQL."""

import pytest

from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.persistence.models import AccountModel

pytestmark = pytest.mark.django_db

DEVELOPER = {
    "role": "developer",
    "display_name": "Ada Lovelace",
    "developer": {
        "headline": "Full-stack developer",
        "bio": "I build things.",
        "github_username": "ada",
        "skills": ["React", "python"],
    },
}
CLIENT = {"role": "client", "display_name": "Grace", "client": {"company_name": "Acme", "industry": "Retail"}}


@pytest.fixture(autouse=True)
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture
def auth(make_token):
    def headers(sub: str = "user_123") -> dict:
        return {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}

    return headers


def onboard(api, auth, body, sub="user_123"):
    return api.post("/api/onboarding/", data=body, format="json", **auth(sub))


def test_me_requires_a_token(api):
    response = api.get("/api/me/")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_me_has_no_account_before_onboarding(api, auth):
    response = api.get("/api/me/", **auth())
    assert response.json() == {"data": {"clerk_user_id": "user_123", "account": None}}


def test_developer_onboarding_creates_one_account_shown_by_me(api, auth):
    response = onboard(api, auth, DEVELOPER)
    assert response.status_code == 201
    account = api.get("/api/me/", **auth()).json()["data"]["account"]
    assert (account["role"], account["display_name"]) == ("developer", "Ada Lovelace")
    assert account["profile"]["skills"] == [
        {"key": "python", "label": "python"},
        {"key": "react", "label": "React"},
    ]
    assert account["profile"]["github_username"] == "ada"
    assert AccountModel.objects.count() == 1


def test_client_onboarding_stores_company_details(api, auth):
    assert onboard(api, auth, CLIENT).status_code == 201
    profile = api.get("/api/me/", **auth()).json()["data"]["account"]["profile"]
    assert profile == {"company_name": "Acme", "industry": "Retail"}


def test_the_role_cannot_be_changed_by_onboarding_again(api, auth):
    onboard(api, auth, CLIENT)
    response = onboard(api, auth, DEVELOPER)
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "ALREADY_ONBOARDED"
    assert "can't be changed" in error["message"]
    assert AccountModel.objects.get().role == "client"


def test_extra_fields_cannot_ride_along(api, auth):
    response = onboard(api, auth, {**CLIENT, "account_id": 9, "client": {**CLIENT["client"], "role": "x"}})
    assert response.status_code == 400
    fields = response.json()["error"]["fields"]
    assert "account_id" in fields or "client" in fields
    assert AccountModel.objects.count() == 0


def test_validation_errors_name_the_field(api, auth):
    body = {**DEVELOPER, "developer": {**DEVELOPER["developer"], "skills": ["React", "react"]}}
    response = onboard(api, auth, body)
    assert response.status_code == 400
    assert "developer.skills" in response.json()["error"]["fields"]


def test_a_client_sending_developer_details_is_refused(api, auth):
    response = onboard(api, auth, {**CLIENT, "developer": DEVELOPER["developer"]})
    assert response.status_code == 400
    assert AccountModel.objects.count() == 0


def test_onboarding_requires_a_token(api):
    assert api.post("/api/onboarding/", data=CLIENT, format="json").status_code == 401


def test_the_access_policy_guards_the_account_endpoint(api, auth):
    account_id = onboard(api, auth, CLIENT).json()["data"]["id"]
    assert api.get(f"/api/accounts/{account_id}/", **auth()).status_code == 200
    other = api.get(f"/api/accounts/{account_id + 1}/", **auth())
    assert other.status_code == 403
    assert other.json()["error"]["code"] == "FORBIDDEN"
    # Signed in but not onboarded: denied by default.
    assert api.get(f"/api/accounts/{account_id}/", **auth("user_new")).status_code == 403


def test_skills_are_shared_across_developers_and_searchable(api, auth):
    onboard(api, auth, DEVELOPER)
    other = {**DEVELOPER, "developer": {**DEVELOPER["developer"], "skills": ["REACT", "React Native"]}}
    onboard(api, auth, other, sub="user_456")
    data = api.get("/api/skills/?q=react", **auth()).json()["data"]
    assert [s["label"] for s in data] == ["React", "React Native"]
    assert api.get("/api/skills/").status_code == 401
