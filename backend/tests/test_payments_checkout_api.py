"""POST /api/projects/{id}/deposit/checkout/ end to end: Clerk-shaped token,
real PostgreSQL, fake Stripe and a fake #6 project source."""

from dataclasses import replace
from datetime import UTC, datetime

import pytest

from nextnode.application.payments.ports import DepositTerms
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.payments.pending_dependencies import ProjectsNotReady
from nextnode.infrastructure.persistence.models import PaymentModel
from nextnode.infrastructure.persistence.payments import DjangoPaymentRepository
from tests.payment_fakes import FakeGateway, FakeProjects

URL = "/api/projects/7/deposit/checkout/"
pytestmark = pytest.mark.django_db


@pytest.fixture
def projects() -> FakeProjects:
    fake = FakeProjects()
    fake.terms[7] = DepositTerms(
        project_id=7,
        title="Inventory app",
        client_user_id="user_123",  # the `sub` of make_token's default token
        is_client_project=True,
        is_assigned=True,
        offer_version_id=3,
        accepted_total_cents=1_000_000,
    )
    return fake


@pytest.fixture
def gateway() -> FakeGateway:
    return FakeGateway()


@pytest.fixture(autouse=True)
def container(verifier, projects, gateway):
    with override_container(token_verifier=verifier, deposit_terms=projects, payment_gateway=gateway):
        yield


def post(api, token: str | None, **body):
    headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"} if token else {}
    return api.post(URL, data=body, format="json", **headers)


def test_client_gets_a_checkout_url_for_the_server_computed_deposit(api, make_token, gateway):
    response = post(api, make_token(), amount_cents=1, currency="usd")  # the body is ignored
    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["checkout_url"], data["amount_cents"], data["currency"]) == (
        "https://stripe.test/1",
        200_000,
        "cad",
    )
    assert gateway.created[0].amount_cents == 200_000
    row = PaymentModel.objects.get(id=data["payment_id"])
    assert (row.status, row.amount_cents, row.checkout_session_id) == ("pending", 200_000, "cs_test_1")


def test_a_second_request_reuses_the_open_session(api, make_token, gateway):
    first = post(api, make_token()).json()["data"]
    assert post(api, make_token()).json()["data"] == first
    assert PaymentModel.objects.count() == 1


def test_signed_out_callers_get_401(api):
    assert post(api, None).status_code == 401


@pytest.mark.parametrize("sub", ["user_other_client", "user_team_lead"])
def test_anyone_but_the_projects_client_gets_404(api, make_token, sub):
    response = post(api, make_token(sub=sub))
    assert response.status_code == 404
    assert not PaymentModel.objects.exists()


def test_unassigned_project_gets_409(api, make_token, projects):
    projects.terms[7] = replace(projects.terms[7], is_assigned=False)
    response = post(api, make_token())
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_paid_deposit_gets_409(api, make_token):
    first = post(api, make_token()).json()["data"]
    PaymentModel.objects.filter(id=first["payment_id"]).update(
        status="completed", completed_at=datetime(2026, 10, 28, tzinfo=UTC)
    )
    assert post(api, make_token()).status_code == 409


def test_without_projects_and_the_start_gate_checkout_is_503(api, make_token):
    with override_container(deposit_terms=ProjectsNotReady()):
        response = post(api, make_token())
    assert response.status_code == 503
    assert "#6" in response.json()["error"]["message"]


def test_current_deposit_prefers_the_completed_one():
    common = {"project_id": 9, "offer_version_id": 1, "type": "deposit", "currency": "cad"}
    done = PaymentModel.objects.create(
        **common, amount_cents=30_000, status="completed", checkout_session_id="cs_a"
    )
    PaymentModel.objects.create(**common, amount_cents=30_000, status="failed", checkout_session_id="cs_b")
    assert DjangoPaymentRepository().current_deposit(9).id == done.id
    assert DjangoPaymentRepository().current_deposit(10) is None
