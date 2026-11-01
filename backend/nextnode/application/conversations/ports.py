"""What the conversation use cases need from the outside world."""

from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from nextnode.domain.conversations import Conversation, Message, Subject


@dataclass(frozen=True)
class ConversationSummary:
    """One row of the actor's conversation list (dashboard)."""

    conversation: Conversation
    last_message: Message | None
    unread_count: int


class ConversationRepository(Protocol):
    def add(self, conversation: Conversation) -> Conversation:
        """Stores a new conversation. Returns the existing one instead if its
        subject already has a conversation (two requests raced)."""
        ...

    def get(self, conversation_id: UUID) -> Conversation | None: ...

    def get_for_update(self, conversation_id: UUID) -> Conversation | None:
        """Like ``get``, locking the row until the transaction ends."""
        ...

    def find_by_subject(self, subject: Subject) -> Conversation | None: ...

    def save(self, conversation: Conversation) -> None: ...

    def summaries_for(self, account_id: int) -> list[ConversationSummary]:
        """The account's conversations, most recent activity first."""
        ...


class MessageRepository(Protocol):
    def add(self, message: Message) -> Message: ...

    def page(
        self, conversation_id: UUID, *, before: int | None, after: int | None, limit: int
    ) -> list[Message]:
        """Oldest first. ``before``: the ``limit`` messages just before that id
        (history). ``after``: up to ``limit`` messages after it (catch-up)."""
        ...

    def latest_id(self, conversation_id: UUID) -> int | None: ...


class ReadMarkers(Protocol):
    def get(self, conversation_id: UUID, account_id: int) -> int | None: ...

    def advance(self, conversation_id: UUID, account_id: int, message_id: int) -> None:
        """Moves the marker forward to ``message_id``; never backwards."""
        ...


class AccountNames(Protocol):
    """Display names, so conversations never import #1's internals."""

    def names(self, account_ids: list[int]) -> dict[int, str]: ...


class ConversationEvents(Protocol):
    """Pushes a frame to every socket of the given accounts. The adapter sends
    only after the surrounding transaction commits: persisted before broadcast."""

    def publish(self, account_ids: tuple[int, ...], event: dict) -> None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]: ...
