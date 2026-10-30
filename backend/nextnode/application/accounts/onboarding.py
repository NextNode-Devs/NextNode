"""CompleteOnboarding: a signed-in user picks a role once and fills in the
matching profile. A second attempt is refused, whatever the request says."""

from __future__ import annotations

from dataclasses import dataclass, replace

from nextnode.application.accounts.dto import AccountView
from nextnode.application.accounts.ports import AccountRepository, SkillRepository, UnitOfWork
from nextnode.application.ports import Actor
from nextnode.domain.accounts import Account, AlreadyOnboardedError, ClientProfile, DeveloperProfile, Role
from nextnode.domain.errors import ValidationError


@dataclass(frozen=True)
class ClientDetails:
    company_name: str
    industry: str


@dataclass(frozen=True)
class DeveloperDetails:
    headline: str
    bio: str
    github_username: str | None
    skills: list[str]


@dataclass(frozen=True)
class OnboardingCommand:
    role: str
    display_name: str
    client: ClientDetails | None = None
    developer: DeveloperDetails | None = None


class CompleteOnboarding:
    def __init__(self, accounts: AccountRepository, skills: SkillRepository, uow: UnitOfWork) -> None:
        self._accounts = accounts
        self._skills = skills
        self._uow = uow

    def execute(self, actor: Actor, command: OnboardingCommand) -> AccountView:
        with self._uow.atomic():
            existing = self._accounts.get_by_clerk_id(actor.clerk_user_id)
            if existing is not None:
                raise AlreadyOnboardedError(existing.role)

            role = _role(command.role)
            profile = self._profile(role, command)
            account = Account.onboard(actor.clerk_user_id, role, command.display_name, profile)
            if isinstance(profile, DeveloperProfile):
                stored = tuple(self._skills.upsert_many(list(profile.skills)))
                account = replace(account, profile=replace(profile, skills=stored))
            return AccountView.of(self._accounts.add(account))

    @staticmethod
    def _profile(role: Role, command: OnboardingCommand) -> ClientProfile | DeveloperProfile:
        if role is Role.CLIENT:
            if command.client is None or command.developer is not None:
                raise ValidationError(
                    "A client account needs company details only.", {"client": ["Required."]}
                )
            return ClientProfile.create(command.client.company_name, command.client.industry)
        if command.developer is None or command.client is not None:
            raise ValidationError(
                "A developer account needs developer details only.", {"developer": ["Required."]}
            )
        details = command.developer
        return DeveloperProfile.create(details.headline, details.bio, details.github_username, details.skills)


def _role(value: str) -> Role:
    try:
        return Role(value)
    except ValueError:
        raise ValidationError(
            "Choose Developer or Client.", {"role": ["Choose Developer or Client."]}
        ) from None
