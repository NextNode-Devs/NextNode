"""Time-limited team invitation links (A4, #178; NN-26 #90).

- Only the **Team Lead** makes one, while the team is recruiting, choosing how
  long it lasts: 24 hours, 3 days or 7 days.
- A team has **one live link** at a time: a new link, or Revoke, stops the old one.
- A link works **once**. The developer who opens it joins the team straight
  away, taking one open spot, under the same rules as accepting an invitation.
- Its status is worked out on the server from the clock, every time it is
  read and again when it is used, so the browser never decides whether a link
  is valid.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from enum import StrEnum

from nextnode.domain.errors import ConflictError, ValidationError

EXPIRY_HOURS = (24, 72, 168)
DEFAULT_EXPIRY_HOURS = 72


class InviteLinkStatus(StrEnum):
    ACTIVE = "active"
    EXPIRED = "expired"
    USED = "used"
    REVOKED = "revoked"  # stopped by the Team Lead, or replaced by a newer link


class InviteLinkUnusableError(ConflictError):
    code = "INVITE_LINK_UNUSABLE"


_UNUSABLE = {
    InviteLinkStatus.EXPIRED: "This invite link has expired. Ask the Team Lead for a new one.",
    InviteLinkStatus.USED: "This invite link has already been used. Ask the Team Lead for a new one.",
    InviteLinkStatus.REVOKED: "This invite link was turned off by the Team Lead. Ask them for a new one.",
}


@dataclass(frozen=True)
class InviteLink:
    project_id: int
    token: str
    created_by_account_id: int
    created_at: datetime
    expires_at: datetime
    used_at: datetime | None = None
    used_by_account_id: int | None = None
    revoked_at: datetime | None = None
    id: int | None = None

    @classmethod
    def create(cls, project_id: int, token: str, lead_id: int, hours: int, at: datetime) -> InviteLink:
        if hours not in EXPIRY_HOURS:
            message = "Choose 24 hours, 3 days or 7 days."
            raise ValidationError(message, {"expires_in_hours": [message]})
        return cls(project_id, token, lead_id, at, at + timedelta(hours=hours))

    def status(self, now: datetime) -> InviteLinkStatus:
        if self.used_at is not None:
            return InviteLinkStatus.USED
        if self.revoked_at is not None:
            return InviteLinkStatus.REVOKED
        if now >= self.expires_at:
            return InviteLinkStatus.EXPIRED
        return InviteLinkStatus.ACTIVE

    def use(self, developer_id: int, at: datetime) -> InviteLink:
        status = self.status(at)
        if status is not InviteLinkStatus.ACTIVE:
            raise InviteLinkUnusableError(_UNUSABLE[status])
        return replace(self, used_at=at, used_by_account_id=developer_id)

    def revoke(self, at: datetime) -> InviteLink:
        """Stops a link nobody has used yet; a used or already stopped link stays as it is."""
        if self.used_at is not None or self.revoked_at is not None:
            return self
        return replace(self, revoked_at=at)
