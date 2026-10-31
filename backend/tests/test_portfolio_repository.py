"""DjangoPortfolioRepository against real PostgreSQL (#2)."""

import pytest

from nextnode.domain.accounts import Account, ClientProfile, DeveloperProfile, Portfolio, Role
from nextnode.infrastructure.persistence.accounts import DjangoAccountRepository, DjangoSkillRepository
from nextnode.infrastructure.persistence.models import PortfolioProjectModel
from nextnode.infrastructure.persistence.portfolios import DjangoPortfolioRepository

pytestmark = pytest.mark.django_db

REPO = "https://github.com/ada/engine"


def add_account(clerk_id: str, role: Role) -> int:
    profile = (
        DeveloperProfile.create("Backend dev", "", "ada", ["Python"])
        if role is Role.DEVELOPER
        else ClientProfile.create("Acme", "Retail")
    )
    DjangoSkillRepository().upsert_many(list(getattr(profile, "skills", ())))
    account = DjangoAccountRepository().add(Account.onboard(clerk_id, role, "Ada", profile))
    assert account.id is not None
    return account.id


def save(account_id: int, **changes) -> Portfolio:
    """Saves through the repository and returns the portfolio as stored."""
    fields = {
        "headline": "Full-stack developer",
        "bio": "I build things.",
        "github_username": "ada",
        "skills": ["React", "Python"],
        "projects": [("Engine", REPO, "https://engine.example.com"), ("Notes", REPO, None)],
        "resume_url": "https://example.com/cv.pdf",
        "is_available": True,
    }
    portfolio = Portfolio.create(**{**fields, **changes})
    DjangoSkillRepository().upsert_many(list(portfolio.profile.skills))
    stored = DjangoPortfolioRepository().save(account_id, portfolio)
    assert stored.account_id == account_id
    return stored.portfolio


def load(account_id: int) -> Portfolio | None:
    found = DjangoPortfolioRepository().get(account_id)
    return found.portfolio if found else None


def test_a_new_developer_has_an_empty_portfolio_and_is_not_available():
    found = DjangoPortfolioRepository().get(add_account("dev_1", Role.DEVELOPER))
    assert found is not None
    assert found.display_name == "Ada"
    portfolio = found.portfolio
    assert (portfolio.projects, portfolio.resume_url, portfolio.is_available) == ((), None, False)
    assert portfolio.profile.headline == "Backend dev"


def test_a_client_account_has_no_portfolio():
    assert DjangoPortfolioRepository().get(add_account("client_1", Role.CLIENT)) is None


def test_saving_stores_every_field_and_reads_back_the_same():
    account_id = add_account("dev_1", Role.DEVELOPER)
    stored = save(account_id)
    assert stored == load(account_id)
    assert [(p.title, p.demo_url) for p in stored.projects] == [
        ("Engine", "https://engine.example.com"),
        ("Notes", None),
    ]
    assert [s.label for s in stored.profile.skills] == ["Python", "React"]
    assert (stored.resume_url, stored.is_available) == ("https://example.com/cv.pdf", True)


def test_saving_again_replaces_projects_and_clears_blank_links():
    account_id = add_account("dev_1", Role.DEVELOPER)
    save(account_id)
    stored = save(account_id, projects=[("Only one", REPO, None)], resume_url="", is_available=False)
    assert [p.title for p in stored.projects] == ["Only one"]
    assert (stored.resume_url, stored.is_available) == (None, False)
    assert PortfolioProjectModel.objects.count() == 1


def test_one_developers_save_never_touches_another_portfolio():
    first, second = add_account("dev_1", Role.DEVELOPER), add_account("dev_2", Role.DEVELOPER)
    save(first, headline="First")
    save(second, headline="Second", projects=[])
    first_portfolio = load(first)
    assert first_portfolio is not None
    assert first_portfolio.profile.headline == "First"
    assert len(first_portfolio.projects) == 2
