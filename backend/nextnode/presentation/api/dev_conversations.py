"""Development only: pick another local account and start a test conversation.
Answers 404 unless DJANGO_ENV is ``development``. Goes away when Hire Lead
(#4) opens conversations from real applications and invitations."""

from dataclasses import asdict

from django.conf import settings
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.domain.errors import NotFoundError
from nextnode.infrastructure.container import get_container


def _development_only() -> None:
    if settings.ENV.environment != "development":
        raise NotFoundError("Not found.")


class StartTestConversationSerializer(serializers.Serializer):
    account_id = serializers.IntegerField(min_value=1)


class DevTestPartnersView(APIView):
    def get(self, request: Request) -> Response:
        _development_only()
        partners = get_container().list_test_partners.execute(request.user.actor)
        return Response({"data": [asdict(p) for p in partners]})


class DevTestConversationView(APIView):
    def post(self, request: Request) -> Response:
        _development_only()
        body = StartTestConversationSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        conversation = get_container().start_test_conversation.execute(
            request.user.actor, body.validated_data["account_id"]
        )
        return Response({"data": asdict(conversation)}, status=201)
