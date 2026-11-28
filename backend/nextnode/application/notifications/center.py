"""The notification centre (A3, #177; NN-19 #89).

- ``DeliverNotifications`` is the real ``NotificationSender`` behind A0's port.
  It checks the recipient's settings **on the server**, saves the
  notification with the change that caused it (same transaction), and pushes
  it over the WebSocket only after that commits.
- Email is a setting people can already choose, but nothing is emailed yet:
  sending needs an email provider, which the Team Lead hasn't chosen.
- People read their own notifications, mark them read, and change their settings.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

from nextnode.application.conversations.ports import Clock, ConversationEvents
from nextnode.application.notifications.ports import Choice, NotificationInbox, StoredNotification
from nextnode.application.ports import Actor, Notification, NotificationCategory
from nextnode.domain.errors import ForbiddenError, NotFoundError, ValidationError

LIST_LIMIT = 50
EVENT_TYPE = "notification.created"

# What everyone starts with: everything in the app, and email for what needs action soon.
DEFAULTS: dict[NotificationCategory, Choice] = {
    NotificationCategory.HIRING: Choice(in_app=True, email=True),
    NotificationCategory.TEAM: Choice(in_app=True, email=True),
    NotificationCategory.PROJECTS: Choice(in_app=True, email=True),
    NotificationCategory.PAYMENTS: Choice(in_app=True, email=True),
    NotificationCategory.MESSAGES: Choice(in_app=True, email=False),
}


@dataclass(frozen=True)
class NotificationView:
    """The frontend's ``AppNotification``, plus ``kind`` and ``link``."""

    id: int
    category: str
    kind: str
    title: str
    body: str
    link: str | None
    created_at: str
    read: bool

    @classmethod
    def of(cls, stored: StoredNotification) -> NotificationView:
        n = stored.notification
        return cls(
            stored.id,
            n.category.value,
            n.kind,
            n.title,
            n.body,
            n.link,
            stored.created_at.isoformat(),
            stored.read_at is not None,
        )


@dataclass(frozen=True)
class InboxView:
    results: list[NotificationView]  # newest first, at most LIST_LIMIT
    unread_count: int


def _account(actor: Actor) -> int:
    if actor.account_id is None:
        raise ForbiddenError("Finish setting up your account first.")
    return actor.account_id


def settings_for(inbox: NotificationInbox, account_id: int) -> dict[NotificationCategory, Choice]:
    return {**DEFAULTS, **inbox.choices(account_id)}


def settings_view(choices: dict[NotificationCategory, Choice]) -> dict[str, dict[str, bool]]:
    return {category.value: asdict(choices[category]) for category in NotificationCategory}


class DeliverNotifications:
    def __init__(self, inbox: NotificationInbox, events: ConversationEvents, clock: Clock) -> None:
        self._inbox = inbox
        self._events = events
        self._clock = clock

    def send(self, notification: Notification) -> None:
        recipient = notification.recipient_account_id
        if not settings_for(self._inbox, recipient)[notification.category].in_app:
            return  # turned off: nothing saved, nothing pushed
        stored = self._inbox.add(notification, self._clock.now())
        self._events.publish(
            (recipient,), {"type": EVENT_TYPE, "notification": asdict(NotificationView.of(stored))}
        )


class ListNotifications:
    def __init__(self, inbox: NotificationInbox) -> None:
        self._inbox = inbox

    def execute(self, actor: Actor) -> InboxView:
        account_id = _account(actor)
        latest = self._inbox.latest(account_id, LIST_LIMIT)
        return InboxView([NotificationView.of(n) for n in latest], self._inbox.unread_count(account_id))


class MarkNotificationsRead:
    def __init__(self, inbox: NotificationInbox, clock: Clock) -> None:
        self._inbox = inbox
        self._clock = clock

    def one(self, actor: Actor, notification_id: int) -> int:
        """Someone else's notification looks the same as one that doesn't exist."""
        account_id = _account(actor)
        if not self._inbox.mark_read(account_id, notification_id, self._clock.now()):
            raise NotFoundError("We couldn't find that notification.")
        return self._inbox.unread_count(account_id)

    def all(self, actor: Actor) -> int:
        account_id = _account(actor)
        self._inbox.mark_all_read(account_id, self._clock.now())
        return self._inbox.unread_count(account_id)


class NotificationSettings:
    def __init__(self, inbox: NotificationInbox) -> None:
        self._inbox = inbox

    def get(self, actor: Actor) -> dict[str, dict[str, bool]]:
        return settings_view(settings_for(self._inbox, _account(actor)))

    def update(self, actor: Actor, body: dict) -> dict[str, dict[str, bool]]:
        """Every category, each with ``in_app`` and ``email`` true or false."""
        account_id = _account(actor)
        expected = {c.value for c in NotificationCategory}
        errors: dict[str, list[str]] = {}
        for key in set(body) - expected:
            errors[key] = ["There is no such notification category."]
        choices: dict[NotificationCategory, Choice] = {}
        for category in NotificationCategory:
            value = body.get(category.value)
            ok = isinstance(value, dict) and set(value) == {"in_app", "email"}
            if not ok or not all(isinstance(v, bool) for v in value.values()):
                errors[category.value] = ["Give in_app and email, each true or false."]
                continue
            choices[category] = Choice(in_app=value["in_app"], email=value["email"])
        if errors:
            raise ValidationError("Some notification settings need attention.", errors)
        self._inbox.save_choices(account_id, choices)
        return settings_view(settings_for(self._inbox, account_id))
