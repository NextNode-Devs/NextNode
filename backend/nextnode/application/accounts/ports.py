from contextlib import AbstractContextManager
from typing import Protocol

from nextnode.domain.accounts import Account, SkillName


class AccountRepository(Protocol):
    def get_by_clerk_id(self, clerk_user_id: str) -> Account | None: ...

    def add(self, account: Account) -> Account:
        """Stores a new account and returns it with its id. Raises
        ``AlreadyOnboardedError`` if the Clerk user already has one."""
        ...


class SkillRepository(Protocol):
    def upsert_many(self, skills: list[SkillName]) -> list[SkillName]:
        """Stores unknown skills. A known key keeps its first spelling, so the
        returned labels may differ from the ones passed in."""
        ...

    def search(self, query: str | None, limit: int) -> list[SkillName]: ...


class AccountDirectory(Protocol):
    """Role lookups for other issues' use cases (e.g. #5's hiring rules)."""

    def is_developer(self, clerk_user_id: str) -> bool: ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]: ...
