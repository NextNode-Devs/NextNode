"""Milestone delivery and client review over REST (A2, #176).

Serializers check transport only; the loop's rules (who acts, from which
state, the note and the https link) are the domain's, so a request that
skips the UI gets the same answer.
"""

from dataclasses import asdict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.infrastructure.container import get_container


class MilestoneBoardView(APIView):
    """The milestones as they stand, what the viewer may do, and the history."""

    def get(self, request: Request, project_id: int) -> Response:
        board = get_container().milestones.board.execute(request.user.actor, project_id)
        return Response({"data": asdict(board)})


class SubmitSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True, max_length=10_000)
    link_url = serializers.CharField(allow_blank=True, required=False, allow_null=True, max_length=2000)


class NoteSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True, required=False, default="", max_length=10_000)


class SubmitMilestoneView(APIView):
    """The Team Lead submits a milestone in progress for the client's check."""

    def post(self, request: Request, milestone_id: int) -> Response:
        body = SubmitSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        board = get_container().milestones.submit.execute(
            request.user.actor, milestone_id, data["note"], data.get("link_url")
        )
        return Response({"data": asdict(board)})


class ApproveMilestoneView(APIView):
    """The client approves; the next milestone starts."""

    def post(self, request: Request, milestone_id: int) -> Response:
        body = NoteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        board = get_container().milestones.approve.execute(
            request.user.actor, milestone_id, body.validated_data["note"]
        )
        return Response({"data": asdict(board)})


class RequestRevisionView(APIView):
    """The client sends the milestone back, saying what to change."""

    def post(self, request: Request, milestone_id: int) -> Response:
        body = NoteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        board = get_container().milestones.request_revision.execute(
            request.user.actor, milestone_id, body.validated_data["note"]
        )
        return Response({"data": asdict(board)})
