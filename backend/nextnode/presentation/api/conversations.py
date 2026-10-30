"""Hiring conversations over REST: the list, one conversation, history and
catch-up, and read markers. Messages are *sent* only over the socket."""

from dataclasses import asdict
from uuid import UUID

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.application.conversations.queries import PAGE_DEFAULT
from nextnode.infrastructure.container import get_container


class MessagePageSerializer(serializers.Serializer):
    before = serializers.IntegerField(required=False, min_value=1)
    after = serializers.IntegerField(required=False, min_value=0)
    limit = serializers.IntegerField(required=False, default=PAGE_DEFAULT)


class MarkReadSerializer(serializers.Serializer):
    message_id = serializers.IntegerField(min_value=1)


class ConversationListView(APIView):
    """The caller's conversations, most recent activity first, with unread counts."""

    def get(self, request: Request) -> Response:
        conversations = get_container().list_conversations.execute(request.user.actor)
        return Response({"data": [asdict(c) for c in conversations]})


class ConversationDetailView(APIView):
    """Participants, subject, status and close reason. Not a participant → 404."""

    def get(self, request: Request, conversation_id: UUID) -> Response:
        conversation = get_container().get_conversation.execute(request.user.actor, conversation_id)
        return Response({"data": asdict(conversation)})


class ConversationMessagesView(APIView):
    """``?before=<id>&limit=50`` pages history backwards; ``?after=<id>`` catches
    up after a reconnect. Oldest first either way."""

    def get(self, request: Request, conversation_id: UUID) -> Response:
        query = MessagePageSerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        messages = get_container().list_messages.execute(
            request.user.actor, conversation_id, **query.validated_data
        )
        return Response({"data": [asdict(m) for m in messages]})


class ConversationReadView(APIView):
    """Marks the conversation read up to ``message_id``."""

    def post(self, request: Request, conversation_id: UUID) -> Response:
        body = MarkReadSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        message_id = body.validated_data["message_id"]
        get_container().mark_read.execute(request.user.actor, conversation_id, message_id)
        return Response(status=204)
