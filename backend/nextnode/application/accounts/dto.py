"""What the accounts use cases return. Plain data, safe to serialise."""

from __future__ import annotations

from dataclasses import dataclass

from nextnode.domain.accounts import Account, ClientProfile, SkillName


@dataclass(frozen=True)
class SkillView:
    key: str
    label: str

    @classmethod
    def of(cls, skill: SkillName) -> SkillView:
        return cls(skill.key, skill.label)


@dataclass(frozen=True)
class ClientProfileView:
    company_name: str
    industry: str


@dataclass(frozen=True)
class DeveloperProfileView:
    headline: str
    bio: str
    github_username: str | None
    skills: list[SkillView]


@dataclass(frozen=True)
class AccountView:
    id: int
    role: str
    display_name: str
    created_at: str | None
    profile: ClientProfileView | DeveloperProfileView

    @classmethod
    def of(cls, account: Account) -> AccountView:
        assert account.id is not None
        profile = account.profile
        view: ClientProfileView | DeveloperProfileView = (
            ClientProfileView(profile.company_name, profile.industry)
            if isinstance(profile, ClientProfile)
            else DeveloperProfileView(
                profile.headline,
                profile.bio,
                profile.github_username,
                [SkillView.of(skill) for skill in profile.skills],
            )
        )
        created = account.created_at.isoformat() if account.created_at else None
        return cls(account.id, account.role.value, account.display_name, created, view)


@dataclass(frozen=True)
class MeView:
    clerk_user_id: str
    account: AccountView | None
