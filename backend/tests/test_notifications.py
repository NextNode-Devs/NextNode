"""A3 (#177): the notification centre. Delivery rules with in-memory fakes,
then the API and a real sender (A2's milestone submit) against PostgreSQL."""

from datetime import UTC, datetime

import pytest

from nextnode.application.notifications.center import DEFAULTS, DeliverNotifications, settings_view
from nextnode.application.notifications.ports import Choice, StoredNotification
from nextnode.application.ports import Notification, NotificationCategory
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.persistence.notification_models import NotificationModel
from nextnode.infrastructure.persistence.notifications import DjangoNotificationInbox
from tests.conversation_fakes import make_account

AT = datetime(2026, 12, 1, 15, 0, tzinfo=UTC)
C = NotificationCategory


def note(recipient=1, category=C.PROJECTS, kind="milestone_submitted", link="/projects/3/milestones"):
    return Notification(recipient, category, kind, "Ready for your check", "Milestone 1 is ready.", link)


class FakeInbox:
    def __init__(self, choices=None) -> None:
        self.stored: list[StoredNotification] = []
        self._choices = choices or {}

    def add(self, notification, at):
        stored = StoredNotification(len(self.stored) + 1, notification, at, None)
        self.stored.append(stored)
        return stored

    def choices(self, account_id):
        return self._choices


class FakeEvents:
    def __init__(self) -> None:
        self.sent: list[tuple[tuple[int, ...], dict]] = []

    def publish(self, account_ids, event):
        self.sent.append((account_ids, event))


class Clock:
    def now(self):
        return AT


# --- delivery (no database) --------------------------------------------------------------------


def test_a_notification_is_saved_then_pushed_to_its_recipient():
    inbox, events = FakeInbox(), FakeEvents()
    DeliverNotifications(inbox, events, Clock()).send(note(recipient=9))
    assert len(inbox.stored) == 1
    ((recipients, event),) = events.sent
    assert recipients == (9,)
    assert event["type"] == "notification.created"
    assert event["notification"] == {
        "id": 1,
        "category": "projects",
        "kind": "milestone_submitted",
        "title": "Ready for your check",
        "body": "Milestone 1 is ready.",
        "link": "/projects/3/milestones",
        "created_at": AT.isoformat(),
        "read": False,
    }


def test_a_category_turned_off_in_the_app_is_neither_saved_nor_pushed():
    inbox, events = FakeInbox({C.PROJECTS: Choice(in_app=False, email=True)}), FakeEvents()
    DeliverNotifications(inbox, events, Clock()).send(note())
    assert inbox.stored == [] and events.sent == []
    DeliverNotifications(inbox, events, Clock()).send(note(category=C.HIRING, kind="application"))
    assert len(inbox.stored) == 1


def test_everyone_starts_with_everything_in_the_app_and_no_email_for_messages():
    assert all(choice.in_app for choice in DEFAULTS.values())
    assert settings_view(DEFAULTS)["messages"] == {"in_app": True, "email": False}
    assert set(settings_view(DEFAULTS)) == {"hiring", "team", "projects", "payments", "messages"}


# --- the API (PostgreSQL) ------------------------------------------------------------------------


@pytest.fixture
def auth(make_token, verifier):
    with override_container(token_verifier=verifier):
        yield lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def people(db):
    return {
        "grace": make_account("user_grace", "Grace", "client"),
        "ada": make_account("user_ada", "Ada", "developer"),
    }


def deliver(account_id: int, **kwargs) -> None:
    from nextnode.infrastructure.container import get_container

    get_container().notifications.send(note(recipient=account_id, **kwargs))


@pytest.mark.django_db
def test_the_bell_lists_my_notifications_newest_first_with_the_unread_count(api, auth, people):
    deliver(people["grace"], kind="first")
    deliver(people["grace"], kind="second", link=None)
    deliver(people["ada"], kind="not_mine")
    data = api.get("/api/notifications/", **auth("user_grace")).json()["data"]
    assert [n["kind"] for n in data["results"]] == ["second", "first"]
    assert data["unread_count"] == 2
    assert data["results"][0]["link"] is None and data["results"][1]["link"] == "/projects/3/milestones"


@pytest.mark.django_db
def test_marking_read_one_and_all_and_never_someone_elses(api, auth, people):
    deliver(people["grace"])
    deliver(people["grace"])
    deliver(people["ada"])
    mine = api.get("/api/notifications/", **auth("user_grace")).json()["data"]["results"]
    theirs = NotificationModel.objects.get(recipient_id=people["ada"]).id

    one = api.post(f"/api/notifications/{mine[0]['id']}/read/", **auth("user_grace"))
    assert one.json()["data"] == {"unread_count": 1}
    assert api.post(f"/api/notifications/{mine[0]['id']}/read/", **auth("user_grace")).status_code == 200
    assert api.post(f"/api/notifications/{theirs}/read/", **auth("user_grace")).status_code == 404
    assert NotificationModel.objects.get(pk=theirs).read_at is None

    everything = api.post("/api/notifications/read-all/", **auth("user_grace"))
    assert everything.json()["data"] == {"unread_count": 0}
    assert NotificationModel.objects.get(pk=theirs).read_at is None


@pytest.mark.django_db
def test_settings_start_at_the_defaults_and_are_applied_on_the_server(api, auth, people):
    assert api.get("/api/notifications/settings/", **auth("user_grace")).json()["data"] == settings_view(
        DEFAULTS
    )
    body = settings_view(DEFAULTS) | {"projects": {"in_app": False, "email": False}}
    saved = api.put("/api/notifications/settings/", body, format="json", **auth("user_grace"))
    assert saved.status_code == 200 and saved.json()["data"]["projects"] == {"in_app": False, "email": False}

    deliver(people["grace"])  # projects: off
    deliver(people["grace"], category=C.HIRING, kind="application")
    kinds = [
        n["kind"] for n in api.get("/api/notifications/", **auth("user_grace")).json()["data"]["results"]
    ]
    assert kinds == ["application"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "change",
    [
        {"projects": {"in_app": "yes", "email": False}},
        {"projects": {"in_app": True}},
        {"robots": {"in_app": True, "email": True}},
    ],
)
def test_bad_settings_are_refused_on_their_category(api, auth, people, change):
    body = settings_view(DEFAULTS) | change
    refused = api.put("/api/notifications/settings/", body, format="json", **auth("user_grace"))
    assert refused.status_code == 400
    assert set(refused.json()["error"]["fields"]) == set(change)


@pytest.mark.django_db
def test_a_missing_category_is_refused(api, auth, people):
    body = settings_view(DEFAULTS)
    del body["payments"]
    refused = api.put("/api/notifications/settings/", body, format="json", **auth("user_grace"))
    assert refused.status_code == 400 and "payments" in refused.json()["error"]["fields"]


@pytest.mark.django_db
def test_notifications_need_a_signed_in_onboarded_person(api, auth, people):
    assert api.get("/api/notifications/").status_code == 401
    assert api.get("/api/notifications/", **auth("user_new")).status_code == 403


@pytest.mark.django_db
def test_the_inbox_keeps_the_first_read_time(people):
    inbox = DjangoNotificationInbox()
    stored = inbox.add(note(recipient=people["ada"]), AT)
    assert inbox.mark_read(people["ada"], stored.id, AT)
    later = datetime(2026, 12, 2, tzinfo=UTC)
    assert inbox.mark_read(people["ada"], stored.id, later)
    assert NotificationModel.objects.get(pk=stored.id).read_at == AT


@pytest.mark.django_db(transaction=True)
def test_the_push_waits_for_the_save_to_commit(people, monkeypatch):
    from django.db import transaction

    from nextnode.infrastructure.container import get_container

    pushed: list[int] = []
    monkeypatch.setattr(
        "nextnode.infrastructure.realtime.publisher.ChannelsEventPublisher.publish_to_account",
        lambda self, account_id, event: pushed.append(account_id),
    )
    sender = get_container().notifications
    with transaction.atomic():
        sender.send(note(recipient=people["ada"]))
        assert pushed == []  # not before the commit
    assert pushed == [people["ada"]]
