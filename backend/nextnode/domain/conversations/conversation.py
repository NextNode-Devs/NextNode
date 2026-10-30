"""Hiring conversations (spec Workflows A and B; docs/proposals/realtime-messaging.md).

Every lead application, lead invitation (#4) and team candidacy (#5) opens one
private conversation between its two people; the workspace chat (#6) reuses the
same model for the whole team. The hiring decision happens
there, and a decision elsewhere (another candidate hired, the team filled)
closes it with a reason. A closed conversation stays readable but refuses new
messages.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from nextnode.domain.errors import ConflictError, InvalidStateTransitionError, ValidationError

MESSAGE_MAX = 4000
CLOSE_REASON_MAX = 200


class ConversationStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class SubjectKind(StrEnum):
    """What the conversation is about. One conversation per subject."""

    LEAD_APPLICATION = "lead_application"  # a developer applied to lead (#4)
    LEAD_INVITATION = "lead_invitation"  # a client invited a developer to lead (#4)
    TEAM_CANDIDACY = "team_candidacy"  # applied to / invited to join a team (#5)
    PROJECT_WORKSPACE = "project_workspace"  # the team's workspace chat (#6), all members
    # Development only: lets two local accounts chat before Hire Lead (#4) and
    # Hire Devs (#5) can open real conversations. Refused outside development.
    DEV_TEST = "dev_test"


@dataclass(frozen=True)
class Subject:
    kind: SubjectKind
    id: str


class ConversationClosedError(ConflictError):
    code = "CONVERSATION_CLOSED"

    def __init__(self, reason: str | None) -> None:
        suffix = f": {reason}" if reason else "."
        super().__init__(f"This conversation is closed{suffix}")


@dataclass(frozen=True)
class Conversation:
    id: UUID
    subject: Subject
    participant_ids: tuple[int, ...]  # account ids
    status: ConversationStatus = ConversationStatus.OPEN
    close_reason: str | None = None
    created_at: datetime | None = None
    closed_at: datetime | None = None

    @classmethod
    def start(cls, conversation_id: UUID, subject: Subject, participant_ids: list[int]) -> Conversation:
        people = tuple(dict.fromkeys(participant_ids))  # de-duplicated, order kept
        if len(people) < 2:
            raise ValidationError("A conversation needs at least two different people.")
        return cls(id=conversation_id, subject=subject, participant_ids=people)

    @property
    def is_open(self) -> bool:
        return self.status is ConversationStatus.OPEN

    def includes(self, account_id: int | None) -> bool:
        return account_id is not None and account_id in self.participant_ids

    def ensure_open(self) -> None:
        if not self.is_open:
            raise ConversationClosedError(self.close_reason)

    def close(self, reason: str, at: datetime) -> Conversation:
        if not self.is_open:
            raise InvalidStateTransitionError("This conversation is already closed.")
        text = " ".join(reason.split())
        if not text:
            raise ValidationError("Say why the conversation is closing.")
        return replace(
            self,
            status=ConversationStatus.CLOSED,
            close_reason=text[:CLOSE_REASON_MAX],
            closed_at=at,
        )


@dataclass(frozen=True)
class Message:
    id: int | None
    conversation_id: UUID
    author_id: int
    body: str
    created_at: datetime | None = None

    @classmethod
    def compose(cls, conversation: Conversation, author_id: int, body: str) -> Message:
        """A new message, refused unless the author takes part and the conversation is open."""
        if not conversation.includes(author_id):
            raise ValidationError("Only the people in this conversation can write in it.")
        conversation.ensure_open()
        text = body.strip()
        if not text:
            raise ValidationError("Write a message first.", {"body": ["Write a message first."]})
        if len(text) > MESSAGE_MAX:
            raise ValidationError(
                f"Messages can be up to {MESSAGE_MAX:,} characters.",
                {"body": [f"Up to {MESSAGE_MAX:,} characters."]},
            )
        return cls(id=None, conversation_id=conversation.id, author_id=author_id, body=text)
