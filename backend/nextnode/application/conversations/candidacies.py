"""#5's ``HiringConversations`` port (application/teams/ports.py on
feature/issue-5-hire-devs), implemented on the conversation use cases.

#5 identifies people by Clerk user id; conversations store account ids.
"""

from __future__ import annotations

from uuid import UUID

from nextnode.application.conversations.commands import CloseConversation, OpenConversation
from nextnode.application.conversations.ports import AccountNames, ConversationRepository
from nextnode.domain.conversations import Subject, SubjectKind
from nextnode.domain.errors import ValidationError


class CandidacyConversations:
    def __init__(
        self,
        open_conversation: OpenConversation,
        close_conversation: CloseConversation,
        conversations: ConversationRepository,
        accounts: AccountNames,
    ) -> None:
        self._open = open_conversation
        self._close = close_conversation
        self._conversations = conversations
        self._accounts = accounts

    def open_for_candidacy(
        self, candidacy_id: UUID, team_id: int, lead_user_id: str, developer_user_id: str
    ) -> None:
        """A conversation between the Team Lead and the developer."""
        people = [self._account_id(lead_user_id), self._account_id(developer_user_id)]
        self._open.execute(Subject(SubjectKind.TEAM_CANDIDACY, str(candidacy_id)), people)

    def close_for_candidacy(self, candidacy_id: UUID, reason: str) -> None:
        """Makes the conversation read-only, showing ``reason``. No conversation, nothing to do."""
        conversation = self._conversations.find_by_subject(
            Subject(SubjectKind.TEAM_CANDIDACY, str(candidacy_id))
        )
        if conversation is not None:
            self._close.execute(conversation.id, reason)

    def _account_id(self, clerk_user_id: str) -> int:
        account_id = self._accounts.account_id_for(clerk_user_id)
        if account_id is None:
            raise ValidationError("Both people need a NextNode account before they can talk.")
        return account_id
