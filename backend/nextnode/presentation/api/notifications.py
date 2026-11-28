"""Notifications over REST (A3, #177): the bell's list, marking read, and the
settings page. Everyone sees only their own; nothing here is public."""

from dataclasses import asdict

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.infrastructure.container import get_container


class NotificationsView(APIView):
    """The newest 50, newest first, with the unread count."""

    def get(self, request: Request) -> Response:
        inbox = get_container().list_notifications.execute(request.user.actor)
        return Response({"data": asdict(inbox)})


class MarkReadView(APIView):
    def post(self, request: Request, notification_id: int) -> Response:
        unread = get_container().mark_notifications_read.one(request.user.actor, notification_id)
        return Response({"data": {"unread_count": unread}})


class MarkAllReadView(APIView):
    def post(self, request: Request) -> Response:
        unread = get_container().mark_notifications_read.all(request.user.actor)
        return Response({"data": {"unread_count": unread}})


class NotificationSettingsView(APIView):
    """Per category, ``in_app`` and ``email`` on or off. PUT sends every category."""

    def get(self, request: Request) -> Response:
        return Response({"data": get_container().notification_settings.get(request.user.actor)})

    def put(self, request: Request) -> Response:
        body = request.data if isinstance(request.data, dict) else {}
        return Response(
            {"data": get_container().notification_settings.update(request.user.actor, dict(body))}
        )
