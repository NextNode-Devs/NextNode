"""Django adapter for ``PortfolioRepository`` (#2). ORM models never leave this
module."""

from django.db import transaction
from django.db.models import Q
from django.db.models.functions import Lower

from nextnode.application.accounts.directory import DirectoryPage, DirectoryQuery
from nextnode.application.accounts.ports import DeveloperPortfolio
from nextnode.domain.accounts import DeveloperProfile, Portfolio, PortfolioProject, SkillName
from nextnode.infrastructure.persistence.models import (
    AccountModel,
    DeveloperProfileModel,
    PortfolioProjectModel,
    SkillModel,
)


def portfolio_from_row(row: DeveloperProfileModel) -> Portfolio:
    """Maps a profile row to the entity. Prefetch ``skills`` and ``projects``
    when mapping many rows."""
    return Portfolio(
        profile=DeveloperProfile(
            headline=row.headline,
            bio=row.bio,
            github_username=row.github_username or None,
            skills=tuple(SkillName(s.key, s.label) for s in sorted(row.skills.all(), key=lambda s: s.key)),
        ),
        projects=tuple(
            PortfolioProject(title=p.title, repository_url=p.repository_url, demo_url=p.demo_url or None)
            for p in sorted(row.projects.all(), key=lambda p: p.position)
        ),
        resume_url=row.resume_url or None,
        is_available=row.is_available,
    )


def developer_portfolio_from_row(row: DeveloperProfileModel) -> DeveloperPortfolio:
    """Needs ``account`` selected alongside the row."""
    return DeveloperPortfolio(row.account_id, row.account.display_name, portfolio_from_row(row))


class DjangoPortfolioRepository:
    def get(self, account_id: int) -> DeveloperPortfolio | None:
        row = (
            DeveloperProfileModel.objects.select_related("account")
            .prefetch_related("skills", "projects")
            .filter(account_id=account_id)
            .first()
        )
        return developer_portfolio_from_row(row) if row else None

    def save(self, account_id: int, portfolio: Portfolio) -> DeveloperPortfolio:
        profile = portfolio.profile
        with transaction.atomic():
            row = DeveloperProfileModel.objects.select_for_update().get(account_id=account_id)
            row.headline = profile.headline
            row.bio = profile.bio
            row.github_username = profile.github_username or ""
            row.resume_url = portfolio.resume_url or ""
            row.is_available = portfolio.is_available
            row.save()
            row.skills.set(SkillModel.objects.filter(key__in=[s.key for s in profile.skills]))
            row.projects.all().delete()
            PortfolioProjectModel.objects.bulk_create(
                PortfolioProjectModel(
                    developer=row,
                    position=i,
                    title=p.title,
                    repository_url=p.repository_url,
                    demo_url=p.demo_url or "",
                )
                for i, p in enumerate(portfolio.projects)
            )
        stored = self.get(account_id)
        assert stored is not None  # the row was locked and updated above
        return stored


class DjangoDeveloperSearch:
    """The directory query (#2). Only developer profiles are searched, so a
    client account can never appear; the role filter makes that explicit."""

    def search(self, query: DirectoryQuery, offset: int, limit: int) -> DirectoryPage:
        rows = DeveloperProfileModel.objects.filter(account__role=AccountModel.Role.DEVELOPER)
        if query.text:
            rows = rows.filter(
                Q(account__display_name__icontains=query.text) | Q(headline__icontains=query.text)
            )
        for key in query.skill_keys:
            # One join per skill: a developer must have every selected skill.
            rows = rows.filter(skills__key=key)
        if query.available_only:
            rows = rows.filter(is_available=True)
        total = rows.count()
        page = (
            rows.select_related("account")
            .prefetch_related("skills", "projects")
            .order_by(Lower("account__display_name"), "account_id")[offset : offset + limit]
        )
        return DirectoryPage([developer_portfolio_from_row(row) for row in page], total)
