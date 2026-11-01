"""Hire Devs over REST (issue #5). Decisions are REST calls (validated,
auditable); their outcomes reach both people live as ``team.updated`` frames."""

from dataclasses import asdict
from uuid import UUID

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.infrastructure.container import get_container


class TeamView(APIView):
    """The team profile: its size, open spots, status and people, the Team Lead first."""

    def get(self, request: Request, project_id: int) -> Response:
        view = get_container().get_team.execute(request.user.actor, project_id)
        return Response({"data": asdict(view)})


class MyTeamCandidaciesView(APIView):
    """The viewer's applications and invitations to join teams, for the dashboard."""

    def get(self, request: Request) -> Response:
        items = get_container().teams.list_my_candidacies.execute(request.user.actor)
        return Response({"data": [asdict(item) for item in items]})


class TeamCandidacyView(APIView):
    """One application or invitation, with the viewer's allowed actions. Others get 404."""

    def get(self, request: Request, candidacy_id: UUID) -> Response:
        view = get_container().teams.get_candidacy.execute(request.user.actor, candidacy_id)
        return Response({"data": asdict(view)})


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


class InvitationSerializer(serializers.Serializer):
    developer_account_id = serializers.IntegerField(min_value=1)


class TeamInvitationsView(APIView):
    """The Team Lead invites a developer, who joins only if they accept."""

    def post(self, request: Request, project_id: int) -> Response:
        body = InvitationSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        view = get_container().teams.invite_developer.execute(
            request.user.actor, project_id, body.validated_data["developer_account_id"]
        )
        return Response({"data": asdict(view)}, status=201)


class TeamApplicationsView(APIView):
    """A developer applies to join (once). Opens the conversation with the Team Lead."""

    def post(self, request: Request, project_id: int) -> Response:
        view = get_container().teams.apply_to_join.execute(request.user.actor, project_id)
        return Response({"data": asdict(view)}, status=201)


def _decision(use_case: str):
    class DecisionView(APIView):
        def post(self, request: Request, candidacy_id: UUID) -> Response:
            view = getattr(get_container().teams, use_case).execute(request.user.actor, candidacy_id)
            return Response({"data": asdict(view)})

    DecisionView.__name__ = f"{use_case.title().replace('_', '')}View"
    return DecisionView


AcceptApplicationView = _decision("accept_application")
RejectApplicationView = _decision("reject_application")
WithdrawApplicationView = _decision("withdraw_application")
AcceptInvitationView = _decision("accept_invitation")
DeclineInvitationView = _decision("decline_invitation")
