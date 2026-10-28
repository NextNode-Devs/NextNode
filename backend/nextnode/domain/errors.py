"""Domain errors. Raised wherever a rule lives; mapped to HTTP only in
``nextnode.presentation.api.exception_handler``. Messages are written for the
person who has to fix the problem and are shown to them verbatim."""


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


class ForbiddenError(DomainError):
    code = "FORBIDDEN"


class InvalidStateTransitionError(DomainError):
    code = "INVALID_STATE_TRANSITION"
