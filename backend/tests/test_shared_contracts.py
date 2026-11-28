"""A0 (#174): the shared contracts other Phase 3 slices build on: account
status, lost-access reasons on FORBIDDEN, the confidential flag and the
notification port."""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from nextnode.application.ports import Notification, NotificationCategory
from nextnode.domain.accounts import (
    DELETED_ACCOUNT_NAME,
    Account,
    AccountStatus,
    ClientProfile,
    Role,
    is_visible,
)
from nextnode.domain.errors import AccessReason, ForbiddenError
from nextnode.infrastructure.container import get_container, override_container
from nextnode.infrastructure.notifications.null_sender import NullNotificationSender
from nextnode.infrastructure.persistence.models import AccountModel, ProjectModel
from nextnode.infrastructure.persistence.projects import DjangoProjectRepository
from nextnode.presentation.api.exception_handler import handle_exception

FUTURE = (date.today() + timedelta(days=90)).isoformat()

# --- account status (no database) ------------------------------------------------


def test_only_active_accounts_are_listed_for_other_people():
    assert is_visible(AccountStatus.ACTIVE)
    assert not is_visible(AccountStatus.PAUSED)
    assert not is_visible(AccountStatus.DELETED)


def test_a_new_account_is_active_and_visible():
    account = Account.onboard("user_1", Role.CLIENT, "Grace", ClientProfile.create("Acme", "Retail"))
    assert account.status is AccountStatus.ACTIVE
    assert account.is_visible
    assert not replace(account, status=AccountStatus.PAUSED).is_visible


def test_kept_records_of_a_deleted_account_say_nextnode_user():
    assert DELETED_ACCOUNT_NAME == "NextNode User"


# --- lost-access reasons ----------------------------------------------------------


def test_a_plain_forbidden_error_has_no_details():
    response = handle_exception(ForbiddenError("Only the project's owner can edit it."), {"view": None})
    assert response.status_code == 403
    assert response.data == {
        "error": {"code": "FORBIDDEN", "message": "Only the project's owner can edit it."}
    }


def test_lost_access_carries_its_reason_and_time():
    at = datetime(2026, 11, 28, 15, 30, tzinfo=UTC)
    error = ForbiddenError("You no longer have access to this project.", AccessReason.REMOVED, at)
    response = handle_exception(error, {"view": None})
    assert response.status_code == 403
    assert response.data["error"]["details"] == {"reason": "removed", "at": "2026-11-28T15:30:00+00:00"}


def test_every_reason_the_access_screen_words():
    assert {r.value for r in AccessReason} == {
        "left",
        "removed",
        "replaced_as_lead",
        "account_paused",
        "account_deleted",
    }


# --- notification port --------------------------------------------------------------


def test_the_container_has_a_notification_store_that_does_nothing_yet():
    assert isinstance(get_container().notifications, NullNotificationSender)
    note = Notification(
        1, NotificationCategory.HIRING, "interest_request", "New interest", "Grace is interested."
    )
    assert get_container().notifications.send(note) is None


def test_tests_can_swap_the_notification_store():
    sent: list[Notification] = []

    class Recorder:
        def send(self, notification: Notification) -> None:
            sent.append(notification)

    with override_container(notifications=Recorder()) as container:
        container.notifications.send(
            Notification(
                7, NotificationCategory.PROJECTS, "feature_change", "Change", "A new feature.", "/projects/3"
            )
        )
    assert [n.link for n in sent] == ["/projects/3"]
    assert isinstance(get_container().notifications, NullNotificationSender)


# --- end to end (PostgreSQL) -------------------------------------------------------


@pytest.fixture
def auth(make_token, verifier):
    with override_container(token_verifier=verifier):
        yield lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def onboard(api, auth):
    def create(sub: str, role: str, name: str) -> int:
        body: dict = {"role": role, "display_name": name}
        if role == "developer":
            body["developer"] = {"headline": "Backend dev", "skills": ["Python"]}
        else:
            body["client"] = {"company_name": "Acme", "industry": "Retail"}
        response = api.post("/api/onboarding/", data=body, format="json", **auth(sub))
        assert response.status_code == 201, response.json()
        return response.json()["data"]["id"]

    return create


def set_status(account_id: int, status: AccountStatus) -> None:
    AccountModel.objects.filter(pk=account_id).update(status=status.value)


@pytest.mark.django_db
def test_paused_and_deleted_developers_leave_the_directory(api, auth, onboard):
    onboard("client_v", "client", "Victor")
    onboard("dev_ada", "developer", "Ada")
    set_status(onboard("dev_bo", "developer", "Bo"), AccountStatus.PAUSED)
    set_status(onboard("dev_cy", "developer", "Cy"), AccountStatus.DELETED)
    response = api.get("/api/developers/", **auth("client_v"))
    assert response.status_code == 200, response.json()
    assert [c["display_name"] for c in response.json()["data"]["results"]] == ["Ada"]


@pytest.mark.django_db
def test_a_paused_owners_projects_leave_the_feed_and_come_back(api, auth, onboard):
    grace = onboard("client_grace", "client", "Grace")
    onboard("dev_ada", "developer", "Ada")
    brief = {
        "title": "Booking app",
        "description": "A booking app for a small yoga studio.",
        "tech_stack": ["React"],
        "target_delivery_date": FUTURE,
        "proposed_budget_cents": 250_000,
    }
    assert api.post("/api/projects/", data=brief, format="json", **auth("client_grace")).status_code == 201

    def feed() -> list[str]:
        response = api.get("/api/projects/?kind=client", **auth("dev_ada"))
        assert response.status_code == 200, response.json()
        return [p["title"] for p in response.json()["data"]["results"]]

    assert feed() == ["Booking app"]
    set_status(grace, AccountStatus.PAUSED)
    assert feed() == []
    set_status(grace, AccountStatus.ACTIVE)
    assert feed() == ["Booking app"]


@pytest.mark.django_db
def test_projects_are_not_confidential_by_default_and_the_flag_is_saved(api, auth, onboard):
    onboard("client_grace", "client", "Grace")
    brief = {
        "title": "Booking app",
        "description": "A booking app for a small yoga studio.",
        "tech_stack": ["React"],
        "target_delivery_date": FUTURE,
        "proposed_budget_cents": 250_000,
    }
    created = api.post("/api/projects/", data=brief, format="json", **auth("client_grace")).json()["data"]
    assert created["confidential"] is False

    repo = DjangoProjectRepository()
    record = repo.get(created["id"])
    assert record is not None
    repo.save(replace(record.project, confidential=True))
    assert ProjectModel.objects.get(pk=created["id"]).confidential is True
    shown = api.get(f"/api/projects/{created['id']}/", **auth("client_grace")).json()["data"]
    assert shown["confidential"] is True
