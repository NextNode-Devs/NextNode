"""Django adapter for A3's ``NotificationInbox`` (#177). ORM models never leave this module."""

from __future__ import annotations

from datetime import datetime

from django.db import transaction

from nextnode.application.notifications.ports import Choice, StoredNotification
from nextnode.application.ports import Notification, NotificationCategory
from nextnode.infrastructure.persistence.notification_models import (
    NotificationModel,
    NotificationSettingModel,
)


def _to_stored(row: NotificationModel) -> StoredNotification:
    notification = Notification(
        recipient_account_id=row.recipient_id,
        category=NotificationCategory(row.category),
        kind=row.kind,
        title=row.title,
        body=row.body,
        link=row.link or None,
    )
    return StoredNotification(row.id, notification, row.created_at, row.read_at)


class DjangoNotificationInbox:
    def add(self, notification: Notification, at: datetime) -> StoredNotification:
        row = NotificationModel.objects.create(
            recipient_id=notification.recipient_account_id,
            category=notification.category.value,
            kind=notification.kind[:48],
            title=notification.title[:160],
            body=notification.body[:500],
            link=notification.link or "",
            created_at=at,
        )
        return _to_stored(row)

    def latest(self, account_id: int, limit: int) -> list[StoredNotification]:
        rows = NotificationModel.objects.filter(recipient_id=account_id).order_by("-created_at", "-id")[
            :limit
        ]
        return [_to_stored(row) for row in rows]

    def unread_count(self, account_id: int) -> int:
        return NotificationModel.objects.filter(recipient_id=account_id, read_at__isnull=True).count()

    def mark_read(self, account_id: int, notification_id: int, at: datetime) -> bool:
        mine = NotificationModel.objects.filter(pk=notification_id, recipient_id=account_id)
        if not mine.exists():
            return False
        mine.filter(read_at__isnull=True).update(read_at=at)
        return True

    def mark_all_read(self, account_id: int, at: datetime) -> int:
        return NotificationModel.objects.filter(recipient_id=account_id, read_at__isnull=True).update(
            read_at=at
        )

    def choices(self, account_id: int) -> dict[NotificationCategory, Choice]:
        return {
            NotificationCategory(row.category): Choice(row.in_app, row.email)
            for row in NotificationSettingModel.objects.filter(account_id=account_id)
        }

    def save_choices(self, account_id: int, choices: dict[NotificationCategory, Choice]) -> None:
        with transaction.atomic():
            for category, choice in choices.items():
                NotificationSettingModel.objects.update_or_create(
                    account_id=account_id,
                    category=category.value,
                    defaults={"in_app": choice.in_app, "email": choice.email},
                )
