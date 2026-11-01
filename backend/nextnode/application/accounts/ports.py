from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Protocol

from nextnode.domain.accounts import Account, Portfolio, SkillName


@dataclass(frozen=True)
class DeveloperPortfolio:
    """A portfolio with the developer account it belongs to."""

    account_id: int
    display_name: str
    portfolio: Portfolio


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


class PortfolioRepository(Protocol):
    """Portfolios belong to developer accounts only; a client account has none."""

    def get(self, account_id: int) -> DeveloperPortfolio | None:
        """The developer's portfolio, or None if the account is not a developer."""
        ...

    def save(self, account_id: int, portfolio: Portfolio) -> DeveloperPortfolio:
        """Replaces the developer's portfolio. Its skills must already be stored
        (``SkillRepository.upsert_many``). Returns it as stored."""
        ...


class AccountDirectory(Protocol):
    """Role lookups for other issues' use cases (e.g. #5's hiring rules)."""

    def is_developer(self, clerk_user_id: str) -> bool: ...

    def is_developer_account(self, account_id: int) -> bool: ...


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]: ...
