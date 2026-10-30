from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from nextnode.domain.accounts.profiles import DISPLAY_NAME_MAX, ClientProfile, DeveloperProfile, clean_text
from nextnode.domain.accounts.role import Role
from nextnode.domain.errors import ConflictError, ValidationError


class AlreadyOnboardedError(ConflictError):
    code = "ALREADY_ONBOARDED"

    def __init__(self, role: Role) -> None:
        super().__init__(f"Your account is already set up as a {role.value}. The role can't be changed.")


@dataclass(frozen=True)
class Account:
    """One per Clerk user. NextNode stores no credentials, only this. The role
    is fixed at creation: there is deliberately no way to change it."""

    id: int | None
    clerk_user_id: str
    role: Role
    display_name: str
    profile: ClientProfile | DeveloperProfile
    created_at: datetime | None = None

    @classmethod
    def onboard(
        cls, clerk_user_id: str, role: Role, display_name: str, profile: ClientProfile | DeveloperProfile
    ) -> Account:
        expected = DeveloperProfile if role is Role.DEVELOPER else ClientProfile
        if not isinstance(profile, expected):
            raise ValidationError(f"A {role.value} account needs a {role.value} profile.")
        name = clean_text(display_name, "display_name", "Display name", maximum=DISPLAY_NAME_MAX)
        return cls(id=None, clerk_user_id=clerk_user_id, role=role, display_name=name, profile=profile)
