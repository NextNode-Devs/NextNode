"""Portfolio entity (#2): field validation, with every error on its field."""

import pytest

from nextnode.domain.accounts import (
    MAX_PROJECTS,
    PROJECT_TITLE_MAX,
    URL_MAX,
    DeveloperProfile,
    Portfolio,
)
from nextnode.domain.errors import ValidationError

REPO = "https://github.com/ada/engine"


def make(**changes) -> Portfolio:
    fields = {
        "headline": "Full-stack developer",
        "bio": "I build things.",
        "github_username": "ada",
        "skills": ["React", "Python"],
        "projects": [("Analytical Engine", REPO, "https://engine.example.com")],
        "resume_url": "https://example.com/ada-cv.pdf",
        "is_available": True,
    }
    return Portfolio.create(**{**fields, **changes})


def error_fields(**changes) -> dict[str, list[str]]:
    with pytest.raises(ValidationError) as caught:
        make(**changes)
    return caught.value.fields


def test_a_complete_portfolio_is_accepted_as_provided():
    portfolio = make()
    project = portfolio.projects[0]
    assert (project.title, project.repository_url, project.demo_url) == (
        "Analytical Engine",
        REPO,
        "https://engine.example.com",
    )
    assert portfolio.resume_url == "https://example.com/ada-cv.pdf"
    assert portfolio.is_available is True
    assert portfolio.profile.github_username == "ada"


def test_optional_links_may_be_left_blank():
    portfolio = make(projects=[("Engine", REPO, "  ")], resume_url="", github_username=None)
    assert portfolio.projects[0].demo_url is None
    assert portfolio.resume_url is None
    assert portfolio.profile.github_username is None


def test_projects_are_optional_and_keep_their_order():
    assert make(projects=[]).projects == ()
    titles = [p.title for p in make(projects=[("B", REPO, None), ("A", REPO, None)]).projects]
    assert titles == ["B", "A"]


@pytest.mark.parametrize(
    "url",
    [
        "github.com/ada",  # no scheme
        "ftp://example.com/file",
        "javascript:alert(1)",
        "https://localhost",  # no dot in host
        "https://exa mple.com",
        "https://",
        "https://[::1",  # malformed, urlsplit raises
    ],
)
def test_links_must_be_full_web_addresses(url):
    assert "resume_url" in error_fields(resume_url=url)
    assert "projects.0.repository_url" in error_fields(projects=[("Engine", url, None)])
    assert "projects.0.demo_url" in error_fields(projects=[("Engine", REPO, url)])


def test_over_long_links_are_refused():
    long_url = "https://example.com/" + "a" * URL_MAX
    assert error_fields(resume_url=long_url) == {"resume_url": [f"Use at most {URL_MAX} characters."]}


def test_a_project_needs_a_title_and_a_repository_link():
    assert "projects.1.title" in error_fields(projects=[("Engine", REPO, None), ("  ", REPO, None)])
    assert "projects.0.title" in error_fields(projects=[("t" * (PROJECT_TITLE_MAX + 1), REPO, None)])
    assert "projects.0.repository_url" in error_fields(projects=[("Engine", "", None)])


def test_the_number_of_projects_is_capped():
    too_many = [("Engine", REPO, None)] * (MAX_PROJECTS + 1)
    assert "projects" in error_fields(projects=too_many)


def test_profile_errors_name_the_portfolio_fields_not_the_onboarding_ones():
    assert "headline" in error_fields(headline="h" * 121)
    assert "bio" in error_fields(bio="b" * 2001)
    assert "github_username" in error_fields(github_username="-bad-")
    assert "skills" in error_fields(skills=[])
    assert "skills" in error_fields(skills=["React", "react"])


def test_a_new_developer_starts_unlisted_as_available_with_no_links():
    profile = DeveloperProfile.create("Backend dev", "", "ada", ["Python"])
    portfolio = Portfolio.from_onboarding(profile)
    assert (portfolio.projects, portfolio.resume_url, portfolio.is_available) == ((), None, False)
    assert portfolio.with_availability(True).is_available is True


def test_nothing_in_a_portfolio_is_called_verified():
    names = {name.lower() for name in Portfolio.__dataclass_fields__} | {
        name.lower() for name in make().projects[0].__dataclass_fields__
    }
    assert not any("verif" in name for name in names)
