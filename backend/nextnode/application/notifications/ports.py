"""What the notification centre (A3, #177) needs. Django adapters implement
it; tests use an in-memory fake."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from nextnode.application.ports import Notification, NotificationCategory


@dataclass(frozen=True)
class Choice:
    """One category's channels."""

    in_app: bool
    email: bool


@dataclass(frozen=True)
class StoredNotification:
    id: int
    notification: Notification
    created_at: datetime
    read_at: datetime | None


class NotificationInbox(Protocol):
    def add(self, notification: Notification, at: datetime) -> StoredNotification: ...

    def latest(self, account_id: int, limit: int) -> list[StoredNotification]:
        """Newest first."""
        ...

    def unread_count(self, account_id: int) -> int: ...

    def mark_read(self, account_id: int, notification_id: int, at: datetime) -> bool:
        """``False`` when the person has no such notification. Reading twice keeps the first time."""
        ...

    def mark_all_read(self, account_id: int, at: datetime) -> int: ...

    def choices(self, account_id: int) -> dict[NotificationCategory, Choice]:
        """Only the categories the person has changed."""
        ...

    def save_choices(self, account_id: int, choices: dict[NotificationCategory, Choice]) -> None: ...
