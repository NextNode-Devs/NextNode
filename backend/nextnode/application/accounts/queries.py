"""Read-side use cases: who am I, the skills vocabulary, and the actor
behind a verified session."""

from __future__ import annotations

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.accounts.dto import AccountView, MeView, SkillView
from nextnode.application.accounts.ports import AccountRepository, SkillRepository
from nextnode.application.ports import Actor, VerifiedSession
from nextnode.domain.errors import NotFoundError

SKILL_SEARCH_LIMIT = 50


class ResolveActor:
    """Adds the account, if any, to a verified Clerk session."""

    def __init__(self, accounts: AccountRepository) -> None:
        self._accounts = accounts

    def execute(self, session: VerifiedSession) -> Actor:
        account = self._accounts.get_by_clerk_id(session.clerk_user_id)
        return Actor(
            clerk_user_id=session.clerk_user_id,
            session_id=session.session_id,
            account_id=account.id if account else None,
            role=account.role if account else None,
        )


class GetMe:
    def __init__(self, accounts: AccountRepository) -> None:
        self._accounts = accounts

    def execute(self, actor: Actor) -> MeView:
        account = self._accounts.get_by_clerk_id(actor.clerk_user_id)
        return MeView(actor.clerk_user_id, AccountView.of(account) if account else None)


class GetAccount:
    """One account by id, through the shared access policy (own account only for now)."""

    def __init__(self, accounts: AccountRepository, policy: AccessPolicy) -> None:
        self._accounts = accounts
        self._policy = policy

    def execute(self, actor: Actor, account_id: int) -> AccountView:
        self._policy.check(actor, "read", ResourceRef("account", account_id))
        account = self._accounts.get_by_clerk_id(actor.clerk_user_id)
        if account is None or account.id != account_id:
            raise NotFoundError("Account not found.")
        return AccountView.of(account)


class ListSkills:
    """Every skill developers have entered, for suggestions and filters (#2, #3)."""

    def __init__(self, skills: SkillRepository) -> None:
        self._skills = skills

    def execute(self, query: str | None = None) -> list[SkillView]:
        text = " ".join((query or "").split()).casefold() or None
        return [SkillView.of(skill) for skill in self._skills.search(text, SKILL_SEARCH_LIMIT)]
