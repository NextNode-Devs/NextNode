"""Role-specific profiles collected at onboarding. #2 extends the developer
profile into a portfolio and reuses these limits."""

from __future__ import annotations

import re
from dataclasses import dataclass

from nextnode.domain.accounts.skills import SkillName, normalize_skills
from nextnode.domain.errors import ValidationError

DISPLAY_NAME_MAX = 80
COMPANY_NAME_MAX = 120
INDUSTRY_MAX = 80
HEADLINE_MAX = 120
BIO_MAX = 2000
# GitHub's own rule: 1-39 letters, digits or single hyphens, not at either end.
_GITHUB_USERNAME = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$")


def clean_text(value: str, field: str, label: str, *, maximum: int, required: bool = True) -> str:
    text = value.strip()
    if required and not text:
        raise ValidationError(f"{label} is required.", {field: [f"Enter your {label.lower()}."]})
    if len(text) > maximum:
        raise ValidationError(f"{label} is too long.", {field: [f"Use at most {maximum} characters."]})
    return text


@dataclass(frozen=True)
class ClientProfile:
    company_name: str
    industry: str

    @classmethod
    def create(cls, company_name: str, industry: str) -> ClientProfile:
        return cls(
            company_name=clean_text(
                company_name, "client.company_name", "Company name", maximum=COMPANY_NAME_MAX
            ),
            industry=clean_text(industry, "client.industry", "Industry", maximum=INDUSTRY_MAX),
        )


@dataclass(frozen=True)
class DeveloperProfile:
    headline: str
    bio: str
    github_username: str | None
    skills: tuple[SkillName, ...]

    @classmethod
    def create(
        cls,
        headline: str,
        bio: str,
        github_username: str | None,
        skills: list[str],
        *,
        field_prefix: str = "developer.",
    ) -> DeveloperProfile:
        """``field_prefix`` names the form the errors belong to: onboarding nests
        these fields under ``developer.``; the portfolio form (#2) does not."""
        p = field_prefix
        username = (github_username or "").strip().removeprefix("@") or None
        if username is not None and not _GITHUB_USERNAME.match(username):
            raise ValidationError(
                "That isn't a valid GitHub username.",
                {f"{p}github_username": ["Use 1-39 letters, numbers or single hyphens."]},
            )
        return cls(
            headline=clean_text(headline, f"{p}headline", "Headline", maximum=HEADLINE_MAX),
            bio=clean_text(bio, f"{p}bio", "Bio", maximum=BIO_MAX, required=False),
            github_username=username,
            skills=tuple(normalize_skills(skills, f"{p}skills")),
        )
