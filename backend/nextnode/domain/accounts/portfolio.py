"""A developer's portfolio (#2): the onboarding profile plus project links, a
resume link and the "Available for work" flag.

Every URL is accepted as the developer provides it. Nothing here checks that a
link works or belongs to its owner, and nothing is ever labelled "verified"
(decision: links accepted as provided)."""

from __future__ import annotations

from dataclasses import dataclass, replace
from urllib.parse import urlsplit

from nextnode.domain.accounts.profiles import DeveloperProfile, clean_text
from nextnode.domain.errors import ValidationError

URL_MAX = 200
PROJECT_TITLE_MAX = 80
MAX_PROJECTS = 6


def clean_url(value: str, field: str, label: str) -> str:
    """A required web address: http:// or https://, with a host name."""
    text = value.strip()
    if not text:
        raise ValidationError(f"{label} is required.", {field: [f"Enter the {label.lower()}."]})
    return _checked_url(text, field, label)


def clean_optional_url(value: str | None, field: str, label: str) -> str | None:
    """Like ``clean_url``, but blank means "no link"."""
    text = (value or "").strip()
    return _checked_url(text, field, label) if text else None


def _checked_url(text: str, field: str, label: str) -> str:
    if len(text) > URL_MAX:
        raise ValidationError(f"{label} is too long.", {field: [f"Use at most {URL_MAX} characters."]})
    try:
        parts = urlsplit(text)
        host = parts.hostname or ""
    except ValueError:
        parts, host = None, ""
    if (
        parts is None
        or parts.scheme not in ("http", "https")
        or "." not in host
        or any(c.isspace() for c in text)
    ):
        raise ValidationError(
            f"{label} isn't a valid link.",
            {field: ["Enter a full link starting with https://, e.g. https://example.com."]},
        )
    return text


@dataclass(frozen=True)
class PortfolioProject:
    title: str
    repository_url: str
    demo_url: str | None

    @classmethod
    def create(cls, title: str, repository_url: str, demo_url: str | None, field: str) -> PortfolioProject:
        """``field`` is the project's position in the form, e.g. ``projects.0``."""
        return cls(
            title=clean_text(title, f"{field}.title", "Project title", maximum=PROJECT_TITLE_MAX),
            repository_url=clean_url(repository_url, f"{field}.repository_url", "Repository link"),
            demo_url=clean_optional_url(demo_url, f"{field}.demo_url", "Live demo link"),
        )


@dataclass(frozen=True)
class Portfolio:
    """Owned by one developer account; clients have no portfolio."""

    profile: DeveloperProfile
    projects: tuple[PortfolioProject, ...]
    resume_url: str | None
    is_available: bool

    @classmethod
    def from_onboarding(cls, profile: DeveloperProfile) -> Portfolio:
        """A new developer starts with no links and is not listed as available
        until they choose to be."""
        return cls(profile=profile, projects=(), resume_url=None, is_available=False)

    @classmethod
    def create(
        cls,
        *,
        headline: str,
        bio: str,
        github_username: str | None,
        skills: list[str],
        projects: list[tuple[str, str, str | None]],
        resume_url: str | None,
        is_available: bool,
    ) -> Portfolio:
        """Validates every field, reporting the first problem on its field.
        ``projects`` holds (title, repository_url, demo_url) in display order."""
        profile = DeveloperProfile.create(headline, bio, github_username, skills, field_prefix="")
        if len(projects) > MAX_PROJECTS:
            raise ValidationError(
                "Too many projects.", {"projects": [f"Add at most {MAX_PROJECTS} projects."]}
            )
        cleaned = tuple(
            PortfolioProject.create(title, repo, demo, f"projects.{i}")
            for i, (title, repo, demo) in enumerate(projects)
        )
        return cls(
            profile=profile,
            projects=cleaned,
            resume_url=clean_optional_url(resume_url, "resume_url", "Resume link"),
            is_available=is_available,
        )

    def with_availability(self, is_available: bool) -> Portfolio:
        return replace(self, is_available=is_available)
