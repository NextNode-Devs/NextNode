"""Portfolio use cases (#2): view a developer's portfolio, edit your own.

Links are shown exactly as the developer entered them. Nothing here, or in what
it returns, says or implies that a link is "verified"."""

from __future__ import annotations

from dataclasses import dataclass, replace

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.accounts.dto import SkillView
from nextnode.application.accounts.ports import (
    DeveloperPortfolio,
    PortfolioRepository,
    SkillRepository,
    UnitOfWork,
)
from nextnode.application.ports import Actor
from nextnode.domain.accounts import Portfolio
from nextnode.domain.errors import ForbiddenError, NotFoundError

NO_PORTFOLIO = "Only developer accounts have a portfolio."
NOT_FOUND = "We couldn't find that developer."


@dataclass(frozen=True)
class ProjectLinkView:
    title: str
    repository_url: str
    demo_url: str | None


@dataclass(frozen=True)
class PortfolioView:
    account_id: int
    display_name: str
    headline: str
    bio: str
    github_username: str | None
    github_url: str | None
    skills: list[SkillView]
    projects: list[ProjectLinkView]
    resume_url: str | None
    is_available: bool
    is_owner: bool  # drives the edit controls; the API enforces ownership on its own

    @classmethod
    def of(cls, found: DeveloperPortfolio, actor: Actor) -> PortfolioView:
        portfolio = found.portfolio
        profile = portfolio.profile
        username = profile.github_username
        return cls(
            account_id=found.account_id,
            display_name=found.display_name,
            headline=profile.headline,
            bio=profile.bio,
            github_username=username,
            github_url=f"https://github.com/{username}" if username else None,
            skills=[SkillView.of(skill) for skill in profile.skills],
            projects=[ProjectLinkView(p.title, p.repository_url, p.demo_url) for p in portfolio.projects],
            resume_url=portfolio.resume_url,
            is_available=portfolio.is_available,
            is_owner=found.account_id == actor.account_id,
        )


@dataclass(frozen=True)
class ProjectLinkInput:
    title: str
    repository_url: str
    demo_url: str | None = None


@dataclass(frozen=True)
class PortfolioCommand:
    """The whole portfolio: a save replaces every field."""

    headline: str
    bio: str
    github_username: str | None
    skills: list[str]
    projects: list[ProjectLinkInput]
    resume_url: str | None
    is_available: bool


class GetPortfolio:
    """Any signed-in, onboarded user may view a developer's portfolio. A client
    account has none, so its id answers 404 like an unknown one."""

    def __init__(self, portfolios: PortfolioRepository, policy: AccessPolicy) -> None:
        self._portfolios = portfolios
        self._policy = policy

    def execute(self, actor: Actor, account_id: int) -> PortfolioView:
        self._policy.check(actor, "read", ResourceRef("portfolio", account_id))
        found = self._portfolios.get(account_id)
        if found is None:
            raise NotFoundError(NOT_FOUND)
        return PortfolioView.of(found, actor)


class UpdatePortfolio:
    """Only the owner may edit a portfolio; anyone else gets 403, whether or not
    the id exists, so the refusal reveals nothing."""

    def __init__(
        self,
        portfolios: PortfolioRepository,
        skills: SkillRepository,
        policy: AccessPolicy,
        uow: UnitOfWork,
    ) -> None:
        self._portfolios = portfolios
        self._skills = skills
        self._policy = policy
        self._uow = uow

    def execute(self, actor: Actor, account_id: int, command: PortfolioCommand) -> PortfolioView:
        self._policy.check(actor, "edit", ResourceRef("portfolio", account_id))
        with self._uow.atomic():
            if self._portfolios.get(account_id) is None:
                raise ForbiddenError(NO_PORTFOLIO)
            portfolio = Portfolio.create(
                headline=command.headline,
                bio=command.bio,
                github_username=command.github_username,
                skills=command.skills,
                projects=[(p.title, p.repository_url, p.demo_url) for p in command.projects],
                resume_url=command.resume_url,
                is_available=command.is_available,
            )
            stored_skills = tuple(self._skills.upsert_many(list(portfolio.profile.skills)))
            portfolio = replace(portfolio, profile=replace(portfolio.profile, skills=stored_skills))
            return PortfolioView.of(self._portfolios.save(account_id, portfolio), actor)
