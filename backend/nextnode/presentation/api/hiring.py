"""Hire Lead over REST (issue #4). Decisions are REST calls (validated,
auditable); their outcomes reach both people live as ``lead.updated`` frames."""

from dataclasses import asdict
from uuid import UUID

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.domain.hiring import NOTE_MAX
from nextnode.infrastructure.container import get_container


class NoteSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=NOTE_MAX, trim_whitespace=True)


class InvitationSerializer(NoteSerializer):
    developer_account_id = serializers.IntegerField(min_value=1)


class LeadApplicationsView(APIView):
    """A developer applies to lead the project (once). Opens the conversation with its client."""

    def post(self, request: Request, project_id: int) -> Response:
        body = NoteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        note = body.validated_data.get("note")
        view = get_container().apply_to_lead.execute(request.user.actor, project_id, note)
        return Response({"data": asdict(view)}, status=201)


class ProjectLeadChatsView(APIView):
    """The project's hiring conversations the viewer is part of (all of them for its client)."""

    def get(self, request: Request, project_id: int) -> Response:
        chats = get_container().list_project_lead_chats.execute(request.user.actor, project_id)
        return Response({"data": [asdict(chat) for chat in chats]})


class MyLeadCandidaciesView(APIView):
    """The viewer's applications and invitations to lead, for the dashboard."""

    def get(self, request: Request) -> Response:
        items = get_container().list_my_lead_candidacies.execute(request.user.actor)
        return Response({"data": [asdict(item) for item in items]})


class LeadInvitationsView(APIView):
    """The project's client invites a developer to lead it."""

    def post(self, request: Request, project_id: int) -> Response:
        body = InvitationSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        view = get_container().invite_to_lead.execute(
            request.user.actor, project_id, data["developer_account_id"], data.get("note")
        )
        return Response({"data": asdict(view)}, status=201)


class LeadCandidacyView(APIView):
    """One application or invitation, with the viewer's allowed actions. Others get 404."""

    def get(self, request: Request, candidacy_id: UUID) -> Response:
        view = get_container().get_lead_candidacy.execute(request.user.actor, candidacy_id)
        return Response({"data": asdict(view)})


def _decision(use_case: str):
    class DecisionView(APIView):
        def post(self, request: Request, candidacy_id: UUID) -> Response:
            view = getattr(get_container(), use_case).execute(request.user.actor, candidacy_id)
            return Response({"data": asdict(view)})

    DecisionView.__name__ = f"{use_case.title().replace('_', '')}View"
    return DecisionView


AcceptInvitationView = _decision("accept_lead_invitation")
DeclineInvitationView = _decision("decline_lead_invitation")
WithdrawApplicationView = _decision("withdraw_lead_application")
HireView = _decision("hire_team_lead")
