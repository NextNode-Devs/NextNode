"""The start gate's ``WorkspaceChats`` port (application/start_gate/ports.py),
implemented on the conversation use cases: one conversation per project for
its Team Lead and approved members. The client is not a participant."""

from __future__ import annotations

from nextnode.application.conversations.commands import OpenConversation
from nextnode.application.conversations.ports import ConversationRepository
from nextnode.domain.conversations import Subject, SubjectKind


def _subject(project_id: int) -> Subject:
    return Subject(SubjectKind.PROJECT_WORKSPACE, str(project_id))


class TeamWorkspaceChats:
    def __init__(self, open_conversation: OpenConversation, conversations: ConversationRepository) -> None:
        self._open = open_conversation
        self._conversations = conversations

    def open_for_team(self, project_id: int, participant_ids: list[int]) -> str:
        return self._open.execute(_subject(project_id), participant_ids).id

    def conversation_id_for(self, project_id: int) -> str | None:
        conversation = self._conversations.find_by_subject(_subject(project_id))
        return str(conversation.id) if conversation else None
