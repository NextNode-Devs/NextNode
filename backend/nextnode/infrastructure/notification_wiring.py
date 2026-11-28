"""The container's notification store (A0, #174; the real one is A3, #177).
Kept out of ``container.py`` for its 500-line limit; ``Container`` inherits it,
so tests still swap the store with ``override_container(notifications=...)``."""

from __future__ import annotations

from dataclasses import dataclass, field

from nextnode.application.ports import NotificationSender
from nextnode.infrastructure.notifications.null_sender import NullNotificationSender


@dataclass(frozen=True, kw_only=True)
class NotificationWiring:
    notifications: NotificationSender = field(default_factory=NullNotificationSender)
