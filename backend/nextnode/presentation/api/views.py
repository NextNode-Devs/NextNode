"""Views: request in, one use case call, response out. No business rules here."""

from dataclasses import asdict

from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.infrastructure.container import get_container


class HealthView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request: Request) -> Response:
        report = get_container().check_health.execute()
        return Response({"data": asdict(report)})


class MeView(APIView):
    """Who the verified Clerk session belongs to. Requires a valid token."""

    def get(self, request: Request) -> Response:
        actor = request.user.actor
        return Response({"data": {"clerk_user_id": actor.clerk_user_id}})
