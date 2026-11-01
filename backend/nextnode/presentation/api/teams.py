"""Hire Devs over REST (issue #5). Decisions are REST calls (validated,
auditable); their outcomes reach both people live as ``team.updated`` frames."""

from dataclasses import asdict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.infrastructure.container import get_container


class TeamSizeSerializer(serializers.Serializer):
    size = serializers.IntegerField()


class TeamSizeView(APIView):
    """The Team Lead sets the total size (5-7, Lead included)."""

    def put(self, request: Request, project_id: int) -> Response:
        body = TeamSizeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        view = get_container().teams.set_team_size.execute(
            request.user.actor, project_id, body.validated_data["size"]
        )
        return Response({"data": asdict(view)})
