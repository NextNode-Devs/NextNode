"""Hire Devs' ``HiringConversations`` port (application/teams/ports.py),
implemented on the conversation use cases."""

from __future__ import annotations

from uuid import UUID

from nextnode.application.conversations.commands import CloseConversation, OpenConversation
from nextnode.application.conversations.ports import ConversationRepository
from nextnode.domain.conversations import Subject, SubjectKind


def _subject(candidacy_id: UUID) -> Subject:
    return Subject(SubjectKind.TEAM_CANDIDACY, str(candidacy_id))


class CandidacyConversations:
    def __init__(
        self,
        open_conversation: OpenConversation,
        close_conversation: CloseConversation,
        conversations: ConversationRepository,
    ) -> None:
        self._open = open_conversation
        self._close = close_conversation
        self._conversations = conversations

    def open_for_candidacy(self, candidacy_id: UUID, lead_account_id: int, developer_account_id: int) -> None:
        """A conversation between the Team Lead and the developer."""
        self._open.execute(_subject(candidacy_id), [lead_account_id, developer_account_id])

    def close_for_candidacy(self, candidacy_id: UUID, reason: str) -> None:
        """Makes the conversation read-only, showing ``reason``. No conversation, nothing to do."""
        conversation = self._conversations.find_by_subject(_subject(candidacy_id))
        if conversation is not None:
            self._close.execute(conversation.id, reason)

    def conversation_id_for(self, candidacy_id: UUID) -> str | None:
        conversation = self._conversations.find_by_subject(_subject(candidacy_id))
        return str(conversation.id) if conversation else None
