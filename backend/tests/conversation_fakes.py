"""In-memory fakes for the conversation ports: no database, no Redis."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from uuid import UUID

from nextnode.application.conversations.ports import ConversationSummary
from nextnode.domain.conversations import Conversation, Message, Subject

T0 = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)


@dataclass
class Store:
    conversations: dict[UUID, Conversation] = field(default_factory=dict)
    messages: list[Message] = field(default_factory=list)
    markers: dict[tuple[UUID, int], int] = field(default_factory=dict)
    published: list[tuple[tuple[int, ...], dict]] = field(default_factory=list)
    names: dict[int, str] = field(default_factory=dict)
    clerk_ids: dict[str, int] = field(default_factory=dict)
    ticks: int = 0

    def tick(self) -> datetime:
        self.ticks += 1
        return T0 + timedelta(seconds=self.ticks)


class FakeConversations:
    def __init__(self, store: Store) -> None:
        self.store = store

    def add(self, conversation: Conversation) -> Conversation:
        existing = self.find_by_subject(conversation.subject)
        if existing is not None:
            return existing
        stored = replace(conversation, created_at=self.store.tick())
        self.store.conversations[stored.id] = stored
        return stored

    def get(self, conversation_id: UUID) -> Conversation | None:
        return self.store.conversations.get(conversation_id)

    get_for_update = get

    def find_by_subject(self, subject: Subject) -> Conversation | None:
        return next((c for c in self.store.conversations.values() if c.subject == subject), None)

    def save(self, conversation: Conversation) -> None:
        self.store.conversations[conversation.id] = conversation

    def summaries_for(self, account_id: int) -> list[ConversationSummary]:
        rows = []
        for conversation in self.store.conversations.values():
            if account_id not in conversation.participant_ids:
                continue
            own = [m for m in self.store.messages if m.conversation_id == conversation.id]
            read = self.store.markers.get((conversation.id, account_id), 0)
            unread = sum(1 for m in own if m.id > read and m.author_id != account_id)
            rows.append(ConversationSummary(conversation, own[-1] if own else None, unread))
        return sorted(
            rows,
            key=lambda s: s.last_message.created_at if s.last_message else s.conversation.created_at,
            reverse=True,
        )


class FakeMessages:
    def __init__(self, store: Store) -> None:
        self.store = store

    def add(self, message: Message) -> Message:
        stored = replace(message, id=len(self.store.messages) + 1, created_at=self.store.tick())
        self.store.messages.append(stored)
        return stored

    def page(self, conversation_id, *, before, after, limit):
        own = [m for m in self.store.messages if m.conversation_id == conversation_id]
        if after is not None:
            return [m for m in own if m.id > after][:limit]
        if before is not None:
            own = [m for m in own if m.id < before]
        return own[-limit:]

    def latest_id(self, conversation_id: UUID) -> int | None:
        own = [m.id for m in self.store.messages if m.conversation_id == conversation_id]
        return max(own) if own else None


class FakeMarkers:
    def __init__(self, store: Store) -> None:
        self.store = store

    def get(self, conversation_id: UUID, account_id: int) -> int | None:
        return self.store.markers.get((conversation_id, account_id))

    def advance(self, conversation_id: UUID, account_id: int, message_id: int) -> None:
        key = (conversation_id, account_id)
        self.store.markers[key] = max(self.store.markers.get(key, 0), message_id)


class FakeNames:
    def __init__(self, store: Store) -> None:
        self.store = store

    def names(self, account_ids: list[int]) -> dict[int, str]:
        return {i: self.store.names[i] for i in account_ids if i in self.store.names}

    def account_id_for(self, clerk_user_id: str) -> int | None:
        return self.store.clerk_ids.get(clerk_user_id)


class FakeEvents:
    def __init__(self, store: Store) -> None:
        self.store = store

    def publish(self, account_ids: tuple[int, ...], event: dict) -> None:
        self.store.published.append((account_ids, event))


class FakeClock:
    def __init__(self, store: Store) -> None:
        self.store = store

    def now(self) -> datetime:
        return self.store.tick()


class FakeUnitOfWork:
    @contextmanager
    def atomic(self):
        yield


def make_account(sub: str, name: str, role: str) -> int:
    """A real onboarded account row (needs the database)."""
    from nextnode.infrastructure.persistence.models import (
        AccountModel,
        ClientProfileModel,
        DeveloperProfileModel,
    )

    account = AccountModel.objects.create(clerk_user_id=sub, role=role, display_name=name)
    if role == "client":
        ClientProfileModel.objects.create(account=account, company_name="Acme", industry="Retail")
    else:
        DeveloperProfileModel.objects.create(account=account, headline="Developer")
    return account.id
