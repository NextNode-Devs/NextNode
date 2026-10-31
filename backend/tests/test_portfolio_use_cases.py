"""GetPortfolio and UpdatePortfolio (#2) with in-memory fakes."""

from dataclasses import asdict, replace

import pytest

from nextnode.application.accounts.portfolio import (
    GetPortfolio,
    PortfolioCommand,
    ProjectLinkInput,
    UpdatePortfolio,
)
from nextnode.application.ports import Actor
from nextnode.domain.accounts import Role
from nextnode.domain.errors import ForbiddenError, NotFoundError, ValidationError
from nextnode.infrastructure.access_rules import build_access_policy
from tests.account_fakes import InMemorySkills, NoTransaction
from tests.portfolio_fakes import InMemoryPortfolios

ADA = Actor("user_ada", "s1", account_id=1, role=Role.DEVELOPER)
GRACE = Actor("user_grace", "s2", account_id=2, role=Role.DEVELOPER)
CLIENT = Actor("user_client", "s3", account_id=3, role=Role.CLIENT)
NOT_ONBOARDED = Actor("user_new", "s4")
REPO = "https://github.com/ada/engine"

COMMAND = PortfolioCommand(
    headline="Full-stack developer",
    bio="I build things.",
    github_username="ada",
    skills=["react", "Rust"],
    projects=[ProjectLinkInput("Engine", REPO, "https://engine.example.com")],
    resume_url="https://example.com/cv.pdf",
    is_available=True,
)


@pytest.fixture
def portfolios() -> InMemoryPortfolios:
    store = InMemoryPortfolios()
    store.add_developer(1, "Ada")
    store.add_developer(2, "Grace")
    return store


@pytest.fixture
def skills() -> InMemorySkills:
    return InMemorySkills("React")


@pytest.fixture
def get(portfolios) -> GetPortfolio:
    return GetPortfolio(portfolios, build_access_policy())


@pytest.fixture
def update(portfolios, skills) -> UpdatePortfolio:
    return UpdatePortfolio(portfolios, skills, build_access_policy(), NoTransaction())


def test_any_onboarded_user_can_view_a_developer_portfolio(get):
    for actor in (ADA, GRACE, CLIENT):
        view = get.execute(actor, 1)
        assert (view.account_id, view.display_name) == (1, "Ada")


def test_only_the_owner_is_told_they_own_it(get):
    assert get.execute(ADA, 1).is_owner is True
    assert get.execute(GRACE, 1).is_owner is False
    assert get.execute(CLIENT, 1).is_owner is False


def test_a_user_who_has_not_onboarded_cannot_view_portfolios(get):
    with pytest.raises(ForbiddenError):
        get.execute(NOT_ONBOARDED, 1)


def test_a_client_or_unknown_id_has_no_portfolio(get):
    with pytest.raises(NotFoundError):
        get.execute(ADA, 3)
    with pytest.raises(NotFoundError):
        get.execute(ADA, 999)


def test_the_owner_updates_every_field(update, portfolios):
    view = update.execute(ADA, 1, COMMAND)
    assert view.headline == "Full-stack developer"
    assert [(p.title, p.demo_url) for p in view.projects] == [("Engine", "https://engine.example.com")]
    assert (view.resume_url, view.is_available, view.is_owner) == ("https://example.com/cv.pdf", True, True)
    assert view.github_url == "https://github.com/ada"
    assert portfolios.rows[1].portfolio.is_available is True


def test_a_skill_keeps_the_spelling_saved_first(update, skills):
    view = update.execute(ADA, 1, COMMAND)
    assert [s.label for s in view.skills] == ["React", "Rust"]
    assert skills.rows["rust"] == "Rust"


def test_editing_someone_elses_portfolio_is_forbidden_and_changes_nothing(update, portfolios):
    before = portfolios.rows[1]
    for actor in (GRACE, CLIENT, NOT_ONBOARDED):
        with pytest.raises(ForbiddenError):
            update.execute(actor, 1, COMMAND)
    assert portfolios.rows[1] == before


def test_editing_an_id_that_does_not_exist_is_forbidden_not_not_found(update):
    with pytest.raises(ForbiddenError):
        update.execute(ADA, 999, COMMAND)


def test_a_client_has_no_portfolio_to_edit_even_with_invalid_data(update):
    with pytest.raises(ForbiddenError, match="Only developer accounts"):
        update.execute(CLIENT, 3, replace(COMMAND, resume_url="not a link"))


def test_invalid_input_is_refused_on_its_field_and_nothing_is_saved(update, portfolios, skills):
    before = portfolios.rows[1]
    bad = replace(COMMAND, projects=[ProjectLinkInput("Engine", "github.com/ada", None)])
    with pytest.raises(ValidationError) as caught:
        update.execute(ADA, 1, bad)
    assert list(caught.value.fields) == ["projects.0.repository_url"]
    assert portfolios.rows[1] == before
    assert "rust" not in skills.rows


def test_availability_can_be_turned_off_again(update, portfolios):
    update.execute(ADA, 1, COMMAND)
    update.execute(ADA, 1, replace(COMMAND, is_available=False))
    assert portfolios.rows[1].portfolio.is_available is False


def test_the_view_never_mentions_verification(get):
    assert not any("verif" in key for key in asdict(get.execute(ADA, 1)))
