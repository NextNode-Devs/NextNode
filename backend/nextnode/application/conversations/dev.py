"""Development only: start a test conversation with another local account.

Real conversations open when someone applies or is invited (Hire Lead #4,
Hire Devs #5). Until those screens exist, this lets two people try the chat on
a local machine. The presentation layer refuses it outside development, and it
goes away once Hire Lead opens conversations for real.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from nextnode.application.conversations.commands import OpenConversation
from nextnode.application.conversations.dto import ConversationView
from nextnode.application.ports import Actor
from nextnode.domain.conversations import Subject, SubjectKind
from nextnode.domain.errors import ForbiddenError, NotFoundError, ValidationError


@dataclass(frozen=True)
class TestPartner:
    account_id: int
    display_name: str
    role: str


class TestPartners(Protocol):
    def all_accounts(self) -> list[TestPartner]: ...


class ListTestPartners:
    def __init__(self, partners: TestPartners) -> None:
        self._partners = partners

    def execute(self, actor: Actor) -> list[TestPartner]:
        if actor.account_id is None:
            raise ForbiddenError("Finish onboarding first.")
        return [p for p in self._partners.all_accounts() if p.account_id != actor.account_id]


class StartTestConversation:
    """Opens (or reopens the existing) test conversation between the actor and another account."""

    def __init__(self, partners: TestPartners, open_conversation: OpenConversation) -> None:
        self._partners = partners
        self._open = open_conversation

    def execute(self, actor: Actor, other_account_id: int) -> ConversationView:
        if actor.account_id is None:
            raise ForbiddenError("Finish onboarding first.")
        if other_account_id == actor.account_id:
            raise ValidationError("Pick someone other than yourself.", {"account_id": ["Pick someone else."]})
        if all(p.account_id != other_account_id for p in self._partners.all_accounts()):
            raise NotFoundError("That account doesn't exist.")
        pair = sorted((actor.account_id, other_account_id))
        subject = Subject(SubjectKind.DEV_TEST, f"{pair[0]}-{pair[1]}")
        return self._open.execute(subject, [actor.account_id, other_account_id])
