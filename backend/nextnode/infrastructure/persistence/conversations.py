"""Django adapters for the conversation ports. ORM models never leave this module."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Count, F, Max, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

from nextnode.application.conversations.ports import ConversationSummary
from nextnode.domain.conversations import Conversation, ConversationStatus, Message, Subject, SubjectKind
from nextnode.infrastructure.persistence.models import (
    AccountModel,
    ConversationModel,
    ConversationParticipantModel,
    MessageModel,
)


def _to_conversation(row: ConversationModel) -> Conversation:
    people = sorted(row.participants.all(), key=lambda p: p.position)
    return Conversation(
        id=row.id,
        subject=Subject(SubjectKind(row.subject_kind), row.subject_id),
        participant_ids=tuple(p.account_id for p in people),
        status=ConversationStatus(row.status),
        close_reason=row.close_reason or None,
        created_at=row.created_at,
        closed_at=row.closed_at,
    )


def _to_message(row: MessageModel) -> Message:
    return Message(
        id=row.id,
        conversation_id=row.conversation_id,
        author_id=row.author_id,
        body=row.body,
        created_at=row.created_at,
    )


def _rows():
    return ConversationModel.objects.prefetch_related("participants")


class DjangoConversationRepository:
    def add(self, conversation: Conversation) -> Conversation:
        try:
            with transaction.atomic():
                row = ConversationModel.objects.create(
                    id=conversation.id,
                    subject_kind=conversation.subject.kind.value,
                    subject_id=conversation.subject.id,
                    status=conversation.status.value,
                )
                ConversationParticipantModel.objects.bulk_create(
                    ConversationParticipantModel(conversation=row, account_id=account_id, position=index)
                    for index, account_id in enumerate(conversation.participant_ids)
                )
        except IntegrityError:
            existing = self.find_by_subject(conversation.subject)
            if existing is None:
                raise
            return existing  # two requests raced; the other one won
        return _to_conversation(_rows().get(pk=row.pk))

    def get(self, conversation_id: UUID) -> Conversation | None:
        row = _rows().filter(pk=conversation_id).first()
        return _to_conversation(row) if row else None

    def get_for_update(self, conversation_id: UUID) -> Conversation | None:
        if not ConversationModel.objects.select_for_update().filter(pk=conversation_id).exists():
            return None
        return self.get(conversation_id)

    def find_by_subject(self, subject: Subject) -> Conversation | None:
        row = _rows().filter(subject_kind=subject.kind.value, subject_id=subject.id).first()
        return _to_conversation(row) if row else None

    def save(self, conversation: Conversation) -> None:
        ConversationModel.objects.filter(pk=conversation.id).update(
            status=conversation.status.value,
            close_reason=conversation.close_reason or "",
            closed_at=conversation.closed_at,
        )

    def summaries_for(self, account_id: int) -> list[ConversationSummary]:
        mine = ConversationParticipantModel.objects.filter(conversation=OuterRef("pk"), account_id=account_id)
        rows = (
            _rows()
            .filter(participants__account_id=account_id)
            .annotate(read_up_to=Coalesce(Subquery(mine.values("last_read_message_id")[:1]), 0))
            .annotate(
                unread=Count(
                    "messages",
                    filter=Q(messages__id__gt=F("read_up_to")) & ~Q(messages__author_id=account_id),
                ),
                last_message_id=Max("messages__id"),
            )
        )
        rows = list(rows)
        last = MessageModel.objects.in_bulk([r.last_message_id for r in rows if r.last_message_id])
        summaries = [
            ConversationSummary(
                _to_conversation(row),
                _to_message(last[row.last_message_id]) if row.last_message_id else None,
                row.unread,
            )
            for row in rows
        ]
        return sorted(summaries, key=_activity, reverse=True)


def _activity(summary: ConversationSummary) -> datetime:
    moment = summary.last_message.created_at if summary.last_message else summary.conversation.created_at
    return moment or datetime.min.replace(tzinfo=UTC)


class DjangoMessageRepository:
    def add(self, message: Message) -> Message:
        row = MessageModel.objects.create(
            conversation_id=message.conversation_id, author_id=message.author_id, body=message.body
        )
        return _to_message(row)

    def page(
        self, conversation_id: UUID, *, before: int | None, after: int | None, limit: int
    ) -> list[Message]:
        rows = MessageModel.objects.filter(conversation_id=conversation_id)
        if after is not None:
            return [_to_message(r) for r in rows.filter(id__gt=after).order_by("id")[:limit]]
        if before is not None:
            rows = rows.filter(id__lt=before)
        newest_first = list(rows.order_by("-id")[:limit])
        return [_to_message(r) for r in reversed(newest_first)]

    def latest_id(self, conversation_id: UUID) -> int | None:
        return MessageModel.objects.filter(conversation_id=conversation_id).aggregate(m=Max("id"))["m"]


class DjangoReadMarkers:
    def get(self, conversation_id: UUID, account_id: int) -> int | None:
        return (
            ConversationParticipantModel.objects.filter(
                conversation_id=conversation_id, account_id=account_id
            )
            .values_list("last_read_message_id", flat=True)
            .first()
        )

    def advance(self, conversation_id: UUID, account_id: int, message_id: int) -> None:
        ConversationParticipantModel.objects.filter(
            Q(last_read_message_id__isnull=True) | Q(last_read_message_id__lt=message_id),
            conversation_id=conversation_id,
            account_id=account_id,
        ).update(last_read_message_id=message_id)


class DjangoAccountNames:
    def names(self, account_ids: list[int]) -> dict[int, str]:
        return dict(AccountModel.objects.filter(id__in=account_ids).values_list("id", "display_name"))

    def account_id_for(self, clerk_user_id: str) -> int | None:
        return AccountModel.objects.filter(clerk_user_id=clerk_user_id).values_list("id", flat=True).first()


def is_participant(conversation_id: str | int, account_id: int | None) -> bool:
    """For the access policy: REST and socket frames share this one check."""
    if account_id is None:
        return False
    try:
        key = UUID(str(conversation_id))
    except ValueError:
        return False
    return ConversationParticipantModel.objects.filter(conversation_id=key, account_id=account_id).exists()


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)
