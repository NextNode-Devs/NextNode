"""In-memory fakes for the account ports: no database."""

import copy
from contextlib import contextmanager
from dataclasses import replace
from datetime import UTC, datetime

from nextnode.domain.accounts import Account, AlreadyOnboardedError, Role, SkillName


class InMemoryAccounts:
    def __init__(self) -> None:
        self.rows: dict[str, Account] = {}
        self.fail_with_race = False

    def get_by_clerk_id(self, clerk_user_id: str) -> Account | None:
        return copy.deepcopy(self.rows.get(clerk_user_id))

    def add(self, account: Account) -> Account:
        if self.fail_with_race or account.clerk_user_id in self.rows:
            raise AlreadyOnboardedError(account.role)
        stored = replace(account, id=len(self.rows) + 1, created_at=datetime(2026, 10, 29, tzinfo=UTC))
        self.rows[account.clerk_user_id] = stored
        return copy.deepcopy(stored)


class InMemorySkills:
    def __init__(self, *known: str) -> None:
        self.rows: dict[str, str] = {label.casefold(): label for label in known}

    def upsert_many(self, skills: list[SkillName]) -> list[SkillName]:
        for skill in skills:
            self.rows.setdefault(skill.key, skill.label)
        return [SkillName(skill.key, self.rows[skill.key]) for skill in skills]

    def search(self, query: str | None, limit: int) -> list[SkillName]:
        found = [SkillName(k, v) for k, v in self.rows.items() if not query or query in k]
        found.sort(key=lambda s: (not (query and s.key.startswith(query)), s.key))
        return found[:limit]


class InMemoryDirectory:
    def __init__(self, accounts: InMemoryAccounts) -> None:
        self.accounts = accounts

    def is_developer(self, clerk_user_id: str) -> bool:
        account = self.accounts.rows.get(clerk_user_id)
        return account is not None and account.role is Role.DEVELOPER


class NoTransaction:
    @contextmanager
    def atomic(self):
        yield
