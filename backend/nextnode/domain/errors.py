"""Domain errors. Raised wherever a rule lives; mapped to HTTP only in
``nextnode.presentation.api.exception_handler``. Messages are written for the
person who has to fix the problem and are shown to them verbatim."""

from datetime import datetime
from enum import StrEnum


class DomainError(Exception):
    code = "DOMAIN_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ValidationError(DomainError):
    code = "VALIDATION_ERROR"

    def __init__(self, message: str, fields: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.fields = fields or {}


class NotFoundError(DomainError):
    code = "NOT_FOUND"


class ConflictError(DomainError):
    code = "CONFLICT"


class AccessReason(StrEnum):
    """Why someone can no longer open something (A0, #174). The frontend's
    "You no longer have access" screen words its message from this."""

    LEFT = "left"
    REMOVED = "removed"
    REPLACED_AS_LEAD = "replaced_as_lead"
    ACCOUNT_PAUSED = "account_paused"
    ACCOUNT_DELETED = "account_deleted"


class ForbiddenError(DomainError):
    """Not allowed. ``reason`` and ``at`` are set only when access was lost
    (left, removed, replaced, or the other account is paused or deleted), and
    reach the client as ``error.details``."""

    code = "FORBIDDEN"

    def __init__(self, message: str, reason: AccessReason | None = None, at: datetime | None = None) -> None:
        super().__init__(message)
        self.reason = reason
        self.at = at

    @property
    def details(self) -> dict[str, str] | None:
        if self.reason is None:
            return None
        details = {"reason": self.reason.value}
        if self.at is not None:
            details["at"] = self.at.isoformat()
        return details


class InvalidStateTransitionError(DomainError):
    code = "INVALID_STATE_TRANSITION"
