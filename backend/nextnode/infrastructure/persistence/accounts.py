"""Django adapters for the account ports. ORM models never leave this module."""

from django.db import IntegrityError, transaction
from django.db.models import Case, IntegerField, Value, When

from nextnode.domain.accounts import (
    Account,
    AlreadyOnboardedError,
    ClientProfile,
    DeveloperProfile,
    Role,
    SkillName,
)
from nextnode.infrastructure.persistence.models import (
    AccountModel,
    ClientProfileModel,
    DeveloperProfileModel,
    SkillModel,
)


def _to_entity(row: AccountModel) -> Account:
    role = Role(row.role)
    profile: ClientProfile | DeveloperProfile
    if role is Role.CLIENT:
        client = row.client_profile
        profile = ClientProfile(company_name=client.company_name, industry=client.industry)
    else:
        developer = row.developer_profile
        profile = DeveloperProfile(
            headline=developer.headline,
            bio=developer.bio,
            github_username=developer.github_username or None,
            skills=tuple(SkillName(s.key, s.label) for s in developer.skills.order_by("key")),
        )
    return Account(
        id=row.id,
        clerk_user_id=row.clerk_user_id,
        role=role,
        display_name=row.display_name,
        profile=profile,
        created_at=row.created_at,
    )


class DjangoAccountRepository:
    def get_by_clerk_id(self, clerk_user_id: str) -> Account | None:
        row = (
            AccountModel.objects.select_related("client_profile", "developer_profile")
            .filter(clerk_user_id=clerk_user_id)
            .first()
        )
        return _to_entity(row) if row else None

    def add(self, account: Account) -> Account:
        try:
            with transaction.atomic():
                row = AccountModel.objects.create(
                    clerk_user_id=account.clerk_user_id,
                    role=account.role.value,
                    display_name=account.display_name,
                )
                self._add_profile(row, account.profile)
        except IntegrityError:
            # Two onboarding requests raced; the other one won.
            existing = self.get_by_clerk_id(account.clerk_user_id)
            raise AlreadyOnboardedError(existing.role if existing else account.role) from None
        return _to_entity(row)

    @staticmethod
    def _add_profile(row: AccountModel, profile: ClientProfile | DeveloperProfile) -> None:
        if isinstance(profile, ClientProfile):
            ClientProfileModel.objects.create(
                account=row, company_name=profile.company_name, industry=profile.industry
            )
            return
        developer = DeveloperProfileModel.objects.create(
            account=row,
            headline=profile.headline,
            bio=profile.bio,
            github_username=profile.github_username or "",
        )
        developer.skills.set(SkillModel.objects.filter(key__in=[s.key for s in profile.skills]))


class DjangoSkillRepository:
    def upsert_many(self, skills: list[SkillName]) -> list[SkillName]:
        for skill in skills:
            SkillModel.objects.get_or_create(key=skill.key, defaults={"label": skill.label})
        stored = {row.key: row.label for row in SkillModel.objects.filter(key__in=[s.key for s in skills])}
        return [SkillName(skill.key, stored[skill.key]) for skill in skills]

    def search(self, query: str | None, limit: int) -> list[SkillName]:
        rows = SkillModel.objects.all()
        if query:
            # Prefix matches first, then anything containing the text.
            rows = rows.filter(key__contains=query).annotate(
                rank=Case(
                    When(key__startswith=query, then=Value(0)), default=Value(1), output_field=IntegerField()
                )
            )
            rows = rows.order_by("rank", "key")
        else:
            rows = rows.order_by("key")
        return [SkillName(row.key, row.label) for row in rows[:limit]]


class DjangoAccountDirectory:
    def is_developer(self, clerk_user_id: str) -> bool:
        return AccountModel.objects.filter(
            clerk_user_id=clerk_user_id, role=AccountModel.Role.DEVELOPER
        ).exists()
