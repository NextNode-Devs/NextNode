"""Team invitation links over REST (A4, #178). Every rule (who, how long, one
live link, single use, the roster checks) is in the use case, so a request
that skips the UI gets the same answer."""

from dataclasses import asdict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.domain.teams.invite_link import DEFAULT_EXPIRY_HOURS
from nextnode.infrastructure.container import get_container


class CreateSerializer(serializers.Serializer):
    expires_in_hours = serializers.IntegerField(required=False, default=DEFAULT_EXPIRY_HOURS)


class ProjectInviteLinksView(APIView):
    """GET: the Team Lead's links, newest first. POST: a new link (the old one stops)."""

    def get(self, request: Request, project_id: int) -> Response:
        links = get_container().invite_links.list(request.user.actor, project_id)
        return Response({"data": [asdict(link) for link in links]})

    def post(self, request: Request, project_id: int) -> Response:
        body = CreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        links = get_container().invite_links.create(
            request.user.actor, project_id, body.validated_data["expires_in_hours"]
        )
        return Response({"data": [asdict(link) for link in links]}, status=201)


class RevokeInviteLinksView(APIView):
    """The Team Lead turns off the live link."""

    def post(self, request: Request, project_id: int) -> Response:
        links = get_container().invite_links.revoke(request.user.actor, project_id)
        return Response({"data": [asdict(link) for link in links]})


class InviteLinkView(APIView):
    """A link's state, for whoever opened it (signed in)."""

    def get(self, request: Request, token: str) -> Response:
        link = get_container().invite_links.get(request.user.actor, token)
        return Response({"data": asdict(link)})


class AcceptInviteLinkView(APIView):
    """A developer joins the team with the link."""

    def post(self, request: Request, token: str) -> Response:
        joined = get_container().invite_links.accept(request.user.actor, token)
        return Response({"data": asdict(joined)})
