"""Read side: the actor's conversation list, one conversation, and its messages."""

from __future__ import annotations

from uuid import UUID

from nextnode.application.conversations.commands import load_for_participant
from nextnode.application.conversations.dto import ConversationView, MessageView
from nextnode.application.conversations.ports import AccountNames, ConversationRepository, MessageRepository
from nextnode.application.ports import Actor
from nextnode.domain.errors import ValidationError

PAGE_DEFAULT = 50
PAGE_MAX = 100


class ListConversations:
    """Every conversation the actor takes part in, with unread counts."""

    def __init__(self, conversations: ConversationRepository, names: AccountNames) -> None:
        self._conversations = conversations
        self._names = names

    def execute(self, actor: Actor) -> list[ConversationView]:
        if actor.account_id is None:
            return []
        summaries = self._conversations.summaries_for(actor.account_id)
        ids = sorted({pid for s in summaries for pid in s.conversation.participant_ids})
        names = self._names.names(ids)
        return [ConversationView.of(s.conversation, names, s.last_message, s.unread_count) for s in summaries]


class GetConversation:
    def __init__(self, conversations: ConversationRepository, names: AccountNames) -> None:
        self._conversations = conversations
        self._names = names

    def execute(self, actor: Actor, conversation_id: UUID) -> ConversationView:
        conversation = load_for_participant(self._conversations, actor, conversation_id)
        return ConversationView.of(conversation, self._names.names(list(conversation.participant_ids)))


class ListMessages:
    """History on open (``before``), or catch-up after a reconnect (``after``)."""

    def __init__(self, conversations: ConversationRepository, messages: MessageRepository) -> None:
        self._conversations = conversations
        self._messages = messages

    def execute(
        self,
        actor: Actor,
        conversation_id: UUID,
        *,
        before: int | None = None,
        after: int | None = None,
        limit: int = PAGE_DEFAULT,
    ) -> list[MessageView]:
        if before is not None and after is not None:
            raise ValidationError("Use either before or after, not both.")
        if not 1 <= limit <= PAGE_MAX:
            raise ValidationError(f"limit must be between 1 and {PAGE_MAX}.", {"limit": ["Out of range."]})
        conversation = load_for_participant(self._conversations, actor, conversation_id)
        page = self._messages.page(conversation.id, before=before, after=after, limit=limit)
        return [MessageView.of(message) for message in page]
