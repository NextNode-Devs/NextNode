"""The developer directory (#2): search, skill and availability filters, pages.

Only developer accounts are listed; a client account never appears. Every
query parameter arrives as raw text from the URL and is checked here, so the
same URL always means the same search."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.accounts.dto import SkillView
from nextnode.application.accounts.ports import DeveloperPortfolio
from nextnode.application.ports import Actor
from nextnode.domain.errors import ValidationError

PAGE_SIZE = 20
SEARCH_MAX = 100
MAX_SKILL_FILTERS = 10


@dataclass(frozen=True)
class DirectoryQuery:
    text: str | None  # matched against name and headline, case-insensitively
    skill_keys: tuple[str, ...]  # a developer must have every one of them
    available_only: bool
    page: int  # 1-based


@dataclass(frozen=True)
class DirectoryPage:
    developers: list[DeveloperPortfolio]
    total: int


class DeveloperSearch(Protocol):
    def search(self, query: DirectoryQuery, offset: int, limit: int) -> DirectoryPage:
        """Developers only, ordered by name then id, so pages never overlap."""
        ...


@dataclass(frozen=True)
class DeveloperCardView:
    account_id: int
    display_name: str
    headline: str
    skills: list[SkillView]
    is_available: bool
    project_count: int

    @classmethod
    def of(cls, found: DeveloperPortfolio) -> DeveloperCardView:
        portfolio = found.portfolio
        return cls(
            account_id=found.account_id,
            display_name=found.display_name,
            headline=portfolio.profile.headline,
            skills=[SkillView.of(skill) for skill in portfolio.profile.skills],
            is_available=portfolio.is_available,
            project_count=len(portfolio.projects),
        )


@dataclass(frozen=True)
class DirectoryView:
    results: list[DeveloperCardView]
    page: int
    page_size: int
    total: int
    total_pages: int


def parse_query(q: str | None, skills: str | None, available: str | None, page: str | None) -> DirectoryQuery:
    text = " ".join((q or "").split()) or None
    if text is not None and len(text) > SEARCH_MAX:
        raise ValidationError("The search is too long.", {"q": [f"Use at most {SEARCH_MAX} characters."]})

    keys: list[str] = []
    for raw in (skills or "").split(","):
        key = " ".join(raw.split()).casefold()
        if key and key not in keys:
            keys.append(key)
    if len(keys) > MAX_SKILL_FILTERS:
        raise ValidationError(
            "Too many skills selected.", {"skills": [f"Filter by at most {MAX_SKILL_FILTERS} skills."]}
        )

    flag = (available or "").strip().lower()
    if flag not in ("", "true"):
        raise ValidationError("Unknown availability filter.", {"available": ['Use "true" or leave it out.']})

    number = (page or "").strip() or "1"
    if not number.isdigit() or int(number) < 1:
        raise ValidationError("Unknown page.", {"page": ["Use a page number of 1 or more."]})

    return DirectoryQuery(text, tuple(sorted(keys)), flag == "true", int(number))


class SearchDevelopers:
    """Any signed-in, onboarded user may browse the directory."""

    def __init__(self, search: DeveloperSearch, policy: AccessPolicy) -> None:
        self._search = search
        self._policy = policy

    def execute(
        self,
        actor: Actor,
        *,
        q: str | None = None,
        skills: str | None = None,
        available: str | None = None,
        page: str | None = None,
    ) -> DirectoryView:
        self._policy.check(actor, "read", ResourceRef("developer_directory", "all"))
        query = parse_query(q, skills, available, page)
        found = self._search.search(query, offset=(query.page - 1) * PAGE_SIZE, limit=PAGE_SIZE)
        return DirectoryView(
            results=[DeveloperCardView.of(developer) for developer in found.developers],
            page=query.page,
            page_size=PAGE_SIZE,
            total=found.total,
            total_pages=max(1, -(-found.total // PAGE_SIZE)),
        )
