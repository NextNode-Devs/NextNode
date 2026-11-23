"""Assistant Lead and inactivity on developer projects over REST (NN-39).
Changes reach the team live as ``team.updated`` frames."""

from dataclasses import asdict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.infrastructure.container import get_container


class StewardshipView(APIView):
    """GET: the Assistant Lead, their permissions and the activity check, for the team only."""

    def get(self, request: Request, project_id: int) -> Response:
        view = get_container().stewardship.get.execute(request.user.actor, project_id)
        return Response({"data": asdict(view)})


class AssistantLeadSerializer(serializers.Serializer):
    account_id = serializers.IntegerField(min_value=1)


class AssistantLeadView(APIView):
    """PUT: the Team Lead chooses (or replaces) the Assistant Lead."""

    def put(self, request: Request, project_id: int) -> Response:
        body = AssistantLeadSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        view = get_container().stewardship.choose_assistant_lead.execute(
            request.user.actor, project_id, body.validated_data["account_id"]
        )
        return Response({"data": asdict(view)})


class ConfirmActiveView(APIView):
    """POST: a member answers "Yes, this project is still active"."""

    def post(self, request: Request, project_id: int) -> Response:
        view = get_container().stewardship.confirm_active.execute(request.user.actor, project_id)
        return Response({"data": asdict(view)})


class CloseProjectView(APIView):
    """POST: the Team Lead or the Assistant Lead marks the developer project closed."""

    def post(self, request: Request, project_id: int) -> Response:
        view = get_container().stewardship.close_project.execute(request.user.actor, project_id)
        return Response({"data": asdict(view)})
