"""The project start gate over REST (issue #6): close the proposal, offers and
their acceptance, a developer idea's timeline, and the gate status.

Serializers check transport only (types, presence); every rule, including the
CAD 1,500.00 minimum offer total, is the domain's, so a request that skips the
UI gets the same answer.
"""

from dataclasses import asdict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.application.start_gate.commands import OfferCommand
from nextnode.infrastructure.container import get_container


class StartGateView(APIView):
    """GET: each start condition, its state and who acts next (client, Team Lead
    and members only). POST: a direct start attempt, refused (409) naming the
    missing condition; a client project starts only on a confirmed deposit."""

    def get(self, request: Request, project_id: int) -> Response:
        view = get_container().start_gate.get.execute(request.user.actor, project_id)
        return Response({"data": asdict(view)})

    def post(self, request: Request, project_id: int) -> Response:
        view = get_container().start_gate.start.execute(request.user.actor, project_id)
        return Response({"data": asdict(view)})


class CloseProposalView(APIView):
    """The Team Lead closes a full team's proposal: the team becomes Locked."""

    def post(self, request: Request, project_id: int) -> Response:
        view = get_container().start_gate.close_proposal.execute(request.user.actor, project_id)
        return Response({"data": asdict(view)})


class OfferSerializer(serializers.Serializer):
    summary = serializers.CharField(allow_blank=True, max_length=5000)
    total_cents = serializers.IntegerField(max_value=2_000_000_000)
    start_date = serializers.DateField()
    delivery_date = serializers.DateField()


class OffersView(APIView):
    """The Team Lead signs and sends the next version of the offer."""

    def post(self, request: Request, project_id: int) -> Response:
        body = OfferSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        view = get_container().start_gate.send_offer.execute(
            request.user.actor, project_id, OfferCommand(**body.validated_data)
        )
        return Response({"data": asdict(view)}, status=201)


class PreviewSerializer(serializers.Serializer):
    total_cents = serializers.IntegerField(max_value=2_000_000_000)


class DepositPreviewView(APIView):
    """The deposit due at initiation for an offer total, computed by the server."""

    def get(self, request: Request, project_id: int) -> Response:
        query = PreviewSerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        preview = get_container().start_gate.preview_deposit.execute(
            request.user.actor, project_id, query.validated_data["total_cents"]
        )
        return Response({"data": asdict(preview)})


class AcceptOfferView(APIView):
    """The project's client accepts the open version: the project becomes Assigned."""

    def post(self, request: Request, offer_id: int) -> Response:
        view = get_container().start_gate.accept_offer.execute(request.user.actor, offer_id)
        return Response({"data": asdict(view)})


class DeclineSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=True, max_length=2000)


class DeclineOfferView(APIView):
    """The project's client declines with a reason; the Team Lead may send a revision."""

    def post(self, request: Request, offer_id: int) -> Response:
        body = DeclineSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        view = get_container().start_gate.decline_offer.execute(
            request.user.actor, offer_id, body.validated_data["reason"]
        )
        return Response({"data": asdict(view)})


class TimelineSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    delivery_date = serializers.DateField()


class TimelineView(APIView):
    """A developer idea's Team Lead finalises the timeline, which starts the project."""

    def post(self, request: Request, project_id: int) -> Response:
        body = TimelineSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        view = get_container().start_gate.finalize_timeline.execute(
            request.user.actor, project_id, data["start_date"], data["delivery_date"]
        )
        return Response({"data": asdict(view)})
