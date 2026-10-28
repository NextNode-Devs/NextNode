import pytest

from nextnode.application.health import CheckHealth
from nextnode.infrastructure.auth.clerk import UnconfiguredTokenVerifier
from nextnode.infrastructure.container import override_container


class FakeProbe:
    def __init__(self, reachable: bool) -> None:
        self.reachable = reachable

    def is_reachable(self) -> bool:
        return self.reachable


def test_use_case_reports_degraded_when_database_is_unreachable():
    report = CheckHealth(FakeProbe(False), UnconfiguredTokenVerifier()).execute()
    assert (report.status, report.database, report.auth) == ("degraded", "unavailable", "unconfigured")


@pytest.mark.django_db
def test_health_endpoint_reaches_the_real_database(api):
    response = api.get("/api/health/")
    assert response.status_code == 200
    assert response.json()["data"]["database"] == "ok"
    assert response.json()["data"]["status"] == "ok"


def test_health_endpoint_uses_the_container(api):
    with override_container(database=FakeProbe(False)):
        response = api.get("/api/health/")
    assert response.json() == {
        "data": {"status": "degraded", "database": "unavailable", "auth": "unconfigured"}
    }


def test_unknown_routes_answer_with_the_json_error_shape(api):
    response = api.get("/api/does-not-exist/")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_cors_allows_only_the_configured_frontend(api):
    allowed = api.options(
        "/api/health/", HTTP_ORIGIN="http://localhost:3000", HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET"
    )
    denied = api.options(
        "/api/health/", HTTP_ORIGIN="https://evil.example", HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET"
    )
    assert allowed["Access-Control-Allow-Origin"] == "http://localhost:3000"
    assert "Access-Control-Allow-Origin" not in denied
    assert "Access-Control-Allow-Credentials" not in allowed
