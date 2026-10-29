"""Hire Devs errors. Messages are shown to the Team Lead or developer verbatim."""

from nextnode.domain.errors import ConflictError, InvalidStateTransitionError, ValidationError


class TeamSizeError(ValidationError):
    """A team size outside 5-7, or smaller than the people already on it."""

    code = "TEAM_SIZE_INVALID"


class TeamFullError(ConflictError):
    code = "TEAM_FULL"


class TeamNotRecruitingError(InvalidStateTransitionError):
    """The team is not ``Open``, or its size has not been set yet."""

    code = "TEAM_NOT_RECRUITING"


class DuplicateCandidacyError(ConflictError):
    """The developer is already on the team, or already has a pending
    application or invitation for it."""

    code = "DUPLICATE_CANDIDACY"


class CandidacyClosedError(InvalidStateTransitionError):
    """The application or invitation was already accepted or closed."""

    code = "CANDIDACY_CLOSED"
