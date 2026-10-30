"""OpenConversation, PostMessage, MarkRead and CloseConversation.

Open and Close are called by the hiring use cases (#4's Hire Lead, #5's Hire
Devs), never directly by a user: a conversation exists because an application
or invitation exists, and closes because of a hiring decision.
"""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID, uuid4

from nextnode.application.conversations.dto import (
    ConversationView,
    MessageView,
    conversation_closed_frame,
    conversation_opened_frame,
    message_new_frame,
)
from nextnode.application.conversations.ports import (
    AccountNames,
    Clock,
    ConversationEvents,
    ConversationRepository,
    MessageRepository,
    ReadMarkers,
    UnitOfWork,
)
from nextnode.application.ports import Actor
from nextnode.domain.conversations import Conversation, Message, Subject
from nextnode.domain.errors import NotFoundError, ValidationError

NOT_FOUND = "Conversation not found."


def load_for_participant(
    conversations: ConversationRepository, actor: Actor, conversation_id: UUID, *, lock: bool = False
) -> Conversation:
    """The conversation if the actor takes part in it. Anyone else gets the
    same answer as for a missing one, so ids reveal nothing."""
    conversation = (conversations.get_for_update if lock else conversations.get)(conversation_id)
    if conversation is None or not conversation.includes(actor.account_id):
        raise NotFoundError(NOT_FOUND)
    return conversation


class OpenConversation:
    """Opens the conversation for a subject, or returns the one it already has."""

    def __init__(
        self,
        conversations: ConversationRepository,
        names: AccountNames,
        events: ConversationEvents,
        uow: UnitOfWork,
        new_id: Callable[[], UUID] = uuid4,
    ) -> None:
        self._conversations = conversations
        self._names = names
        self._events = events
        self._uow = uow
        self._new_id = new_id

    def execute(self, subject: Subject, participant_ids: list[int]) -> ConversationView:
        with self._uow.atomic():
            existing = self._conversations.find_by_subject(subject)
            if existing is not None:
                return ConversationView.of(existing, self._names.names(list(existing.participant_ids)))
            conversation = self._conversations.add(
                Conversation.start(self._new_id(), subject, participant_ids)
            )
            view = ConversationView.of(conversation, self._names.names(list(conversation.participant_ids)))
            self._events.publish(conversation.participant_ids, conversation_opened_frame(view))
            return view


class PostMessage:
    """A participant writes in an open conversation. Saved first, then sent
    live to both people (the sender's other tabs included)."""

    def __init__(
        self,
        conversations: ConversationRepository,
        messages: MessageRepository,
        markers: ReadMarkers,
        events: ConversationEvents,
        uow: UnitOfWork,
    ) -> None:
        self._conversations = conversations
        self._messages = messages
        self._markers = markers
        self._events = events
        self._uow = uow

    def execute(
        self, actor: Actor, conversation_id: UUID, body: str, client_id: str | None = None
    ) -> MessageView:
        with self._uow.atomic():
            conversation = load_for_participant(self._conversations, actor, conversation_id, lock=True)
            assert actor.account_id is not None
            message = self._messages.add(Message.compose(conversation, actor.account_id, body))
            assert message.id is not None
            self._markers.advance(conversation.id, actor.account_id, message.id)  # own words are read
            view = MessageView.of(message)
            self._events.publish(conversation.participant_ids, message_new_frame(view, client_id))
            return view


class MarkRead:
    """Moves the actor's read marker forward, up to a message in this conversation."""

    def __init__(
        self, conversations: ConversationRepository, messages: MessageRepository, markers: ReadMarkers
    ) -> None:
        self._conversations = conversations
        self._messages = messages
        self._markers = markers

    def execute(self, actor: Actor, conversation_id: UUID, message_id: int) -> None:
        conversation = load_for_participant(self._conversations, actor, conversation_id)
        latest = self._messages.latest_id(conversation.id)
        if latest is None or message_id < 1 or message_id > latest:
            raise ValidationError(
                "That message isn't in this conversation.", {"message_id": ["Unknown message."]}
            )
        assert actor.account_id is not None
        self._markers.advance(conversation.id, actor.account_id, message_id)


class CloseConversation:
    """Makes a conversation read-only with a reason both people see live.
    Closing an already-closed conversation changes nothing."""

    def __init__(
        self,
        conversations: ConversationRepository,
        events: ConversationEvents,
        uow: UnitOfWork,
        clock: Clock,
    ) -> None:
        self._conversations = conversations
        self._events = events
        self._uow = uow
        self._clock = clock

    def execute(self, conversation_id: UUID, reason: str) -> bool:
        """Returns whether this call closed it."""
        with self._uow.atomic():
            conversation = self._conversations.get_for_update(conversation_id)
            if conversation is None:
                raise NotFoundError(NOT_FOUND)
            if not conversation.is_open:
                return False
            closed = conversation.close(reason, self._clock.now())
            self._conversations.save(closed)
            self._events.publish(closed.participant_ids, conversation_closed_frame(closed))
            return True
