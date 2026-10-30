"""What the conversation use cases return, and the socket frames they publish.
Plain, JSON-safe data."""

from __future__ import annotations

from dataclasses import asdict, dataclass

from nextnode.domain.conversations import Conversation, Message


@dataclass(frozen=True)
class ParticipantView:
    account_id: int
    display_name: str


@dataclass(frozen=True)
class MessageView:
    id: int
    conversation_id: str
    author_id: int
    body: str
    created_at: str | None

    @classmethod
    def of(cls, message: Message) -> MessageView:
        assert message.id is not None
        created = message.created_at.isoformat() if message.created_at else None
        return cls(message.id, str(message.conversation_id), message.author_id, message.body, created)


@dataclass(frozen=True)
class ConversationView:
    id: str
    subject_kind: str
    subject_id: str
    status: str
    close_reason: str | None
    created_at: str | None
    closed_at: str | None
    participants: list[ParticipantView]
    last_message: MessageView | None = None
    unread_count: int = 0

    @classmethod
    def of(
        cls,
        conversation: Conversation,
        names: dict[int, str],
        last_message: Message | None = None,
        unread_count: int = 0,
    ) -> ConversationView:
        return cls(
            id=str(conversation.id),
            subject_kind=conversation.subject.kind.value,
            subject_id=conversation.subject.id,
            status=conversation.status.value,
            close_reason=conversation.close_reason,
            created_at=conversation.created_at.isoformat() if conversation.created_at else None,
            closed_at=conversation.closed_at.isoformat() if conversation.closed_at else None,
            participants=[
                ParticipantView(account_id, names.get(account_id, "Former member"))
                for account_id in conversation.participant_ids
            ],
            last_message=MessageView.of(last_message) if last_message else None,
            unread_count=unread_count,
        )


# --- socket frames ------------------------------------------------------------


def message_new_frame(message: MessageView, client_id: str | None) -> dict:
    return {
        "type": "message.new",
        "conversation_id": message.conversation_id,
        "message": asdict(message),
        "client_id": client_id,
    }


def conversation_opened_frame(conversation: ConversationView) -> dict:
    return {"type": "conversation.opened", "conversation": asdict(conversation)}


def conversation_closed_frame(conversation: Conversation) -> dict:
    return {
        "type": "conversation.closed",
        "conversation_id": str(conversation.id),
        "reason": conversation.close_reason,
        "closed_at": conversation.closed_at.isoformat() if conversation.closed_at else None,
    }
