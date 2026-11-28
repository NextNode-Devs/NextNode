"""The notification store until A3 (#177) adds the real one (A0, #174).

Use cases can already call ``NotificationSender.send``; this store drops the
notification, so nothing is saved, pushed or emailed yet. A3 replaces it in
``notification_wiring.py`` without touching any caller.
"""

from nextnode.application.ports import Notification


class NullNotificationSender:
    def send(self, notification: Notification) -> None:
        return None
