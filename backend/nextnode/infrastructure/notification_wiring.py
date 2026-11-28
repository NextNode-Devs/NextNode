"""The container's notification wiring (A0 #174, made real by A3 #177). Kept
out of ``container.py`` for its 500-line limit; ``Container`` inherits it, so
tests still swap the store with ``override_container(notifications=...)``."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from nextnode.application.notifications.center import (
    DeliverNotifications,
    ListNotifications,
    MarkNotificationsRead,
    NotificationSettings,
)
from nextnode.application.notifications.ports import NotificationInbox
from nextnode.application.ports import NotificationSender
from nextnode.infrastructure.persistence.conversations import SystemClock
from nextnode.infrastructure.persistence.notifications import DjangoNotificationInbox
from nextnode.infrastructure.realtime.conversation_events import OnCommitConversationEvents
from nextnode.infrastructure.realtime.publisher import ChannelsEventPublisher


def _deliver() -> NotificationSender:
    events = OnCommitConversationEvents(ChannelsEventPublisher())
    return DeliverNotifications(DjangoNotificationInbox(), events, SystemClock())


@dataclass(frozen=True, kw_only=True)
class NotificationWiring:
    notifications: NotificationSender = field(default_factory=_deliver)
    notification_inbox: NotificationInbox = field(default_factory=DjangoNotificationInbox)

    @property
    def list_notifications(self) -> ListNotifications:
        return ListNotifications(self.notification_inbox)

    @property
    def mark_notifications_read(self) -> MarkNotificationsRead:
        c: Any = self
        return MarkNotificationsRead(self.notification_inbox, c.clock)

    @property
    def notification_settings(self) -> NotificationSettings:
        return NotificationSettings(self.notification_inbox)
