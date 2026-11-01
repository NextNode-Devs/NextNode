"""A project's team (class diagram ``Team``, ``TeamMembership``).

One team per project and one project per team (confirmed for Phase 1). #3 owns
the team's creation and #4 its Lead; Hire Devs (#5) adds the roster rules: the
size the Lead sets, the members and the open spots between them. A team is 5-7
people in total, the Lead included.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import StrEnum

from nextnode.domain.errors import (
    ConflictError,
    ForbiddenError,
    InvalidStateTransitionError,
    ValidationError,
)
from nextnode.domain.hiring import LeadAlreadyHiredError

MIN_TEAM_SIZE = 5
MAX_TEAM_SIZE = 7

RECRUITMENT_CLOSED = "Recruitment has closed"


class TeamSizeError(ValidationError):
    """A team size outside 5-7, or smaller than the people already on it."""

    code = "TEAM_SIZE_INVALID"


class TeamFullError(ConflictError):
    code = "TEAM_FULL"


class TeamNotRecruitingError(InvalidStateTransitionError):
    """The team is not ``Open``, or its size has not been set yet."""

    code = "TEAM_NOT_RECRUITING"


class DuplicateCandidacyError(ConflictError):
    """The developer is already on the team, or has already applied or been invited."""

    code = "DUPLICATE_CANDIDACY"


class TeamStatus(StrEnum):
    OPEN = "open"  # recruiting
    LOCKED = "locked"  # roster finalised, awaiting the start gate (#6)
    ACTIVE = "active"  # start conditions met
    ARCHIVED = "archived"


@dataclass(frozen=True)
class Team:
    id: int | None
    project_id: int | None
    status: TeamStatus = TeamStatus.OPEN
    lead_account_id: int | None = None
    team_size: int | None = None  # total people, Lead included; None until the Lead sets it
    member_account_ids: tuple[int, ...] = field(default_factory=tuple)  # approved, Lead excluded

    @classmethod
    def for_new_project(cls, lead_account_id: int | None = None) -> Team:
        """A developer idea's team starts with its creator as Lead; a client
        project's team has no Lead until #4 hires one."""
        return cls(id=None, project_id=None, lead_account_id=lead_account_id)

    @property
    def headcount(self) -> int:
        return (1 if self.lead_account_id is not None else 0) + len(self.member_account_ids)

    @property
    def developer_spots(self) -> int:
        return 0 if self.team_size is None else self.team_size - 1

    @property
    def open_spots(self) -> int:
        if self.team_size is None or self.status is not TeamStatus.OPEN:
            return 0
        return max(0, self.team_size - self.headcount)

    @property
    def is_full(self) -> bool:
        return self.team_size is not None and self.headcount >= self.team_size

    def is_lead(self, account_id: int | None) -> bool:
        return account_id is not None and account_id == self.lead_account_id

    def is_member(self, account_id: int | None) -> bool:
        return account_id is not None and account_id in self.member_account_ids

    def assign_lead(self, developer_account_id: int) -> Team:
        """#4 calls this when a client hires a Team Lead. One Lead per project."""
        if self.lead_account_id is not None:
            raise LeadAlreadyHiredError()
        if developer_account_id in self.member_account_ids:
            raise ValidationError("This developer is already a member of the team.")
        return replace(self, lead_account_id=developer_account_id)

    # --- the roster (#5) -----------------------------------------------------------

    def ensure_lead(self, account_id: int | None, action: str) -> None:
        if not self.is_lead(account_id):
            raise ForbiddenError(f"Only this team's Team Lead can {action}.")

    def ensure_recruiting(self) -> None:
        """Every roster change is refused unless the team is ``Open``."""
        if self.status is not TeamStatus.OPEN:
            raise TeamNotRecruitingError(RECRUITMENT_CLOSED)

    def ensure_can_join(self, account_id: int) -> None:
        """The developer could take a spot: there is one, and they are not on the team."""
        self.ensure_recruiting()
        if self.is_lead(account_id):
            raise DuplicateCandidacyError("You are this team's Team Lead already.")
        if self.is_member(account_id):
            raise DuplicateCandidacyError("This developer is already a member of the team.")
        if self.team_size is None:
            raise TeamNotRecruitingError("The Team Lead has not set the team size yet.")
        if self.is_full:
            raise TeamFullError(f"This team already has {self.headcount} of {self.team_size} people.")

    def with_size(self, team_size: int) -> Team:
        self.ensure_recruiting()
        if not MIN_TEAM_SIZE <= team_size <= MAX_TEAM_SIZE:
            raise TeamSizeError(
                f"A team has {MIN_TEAM_SIZE} to {MAX_TEAM_SIZE} people including the Team Lead "
                f"({MIN_TEAM_SIZE - 1} to {MAX_TEAM_SIZE - 1} developer spots); you chose {team_size}.",
                {"size": [f"Choose between {MIN_TEAM_SIZE} and {MAX_TEAM_SIZE}."]},
            )
        if team_size < self.headcount:
            raise TeamSizeError(
                f"This team already has {self.headcount} people, so its size can't be less "
                f"than {self.headcount}.",
                {"size": [f"Choose at least {self.headcount}."]},
            )
        return replace(self, team_size=team_size)

    def with_member(self, account_id: int) -> Team:
        """Takes one open spot. Never over-fills: a full team refuses."""
        self.ensure_can_join(account_id)
        return replace(self, member_account_ids=(*self.member_account_ids, account_id))

    # --- the start gate (#6) ---------------------------------------------------------

    @property
    def participant_ids(self) -> tuple[int, ...]:
        """The Lead first, then the approved members: the workspace chat's people."""
        lead = () if self.lead_account_id is None else (self.lead_account_id,)
        return (*lead, *self.member_account_ids)

    def close_proposal(self, account_id: int | None) -> Team:
        """``Open -> Locked``: the Team Lead freezes the full roster. Never reopened."""
        self.ensure_lead(account_id, "close the project proposal")
        if self.status is not TeamStatus.OPEN:
            raise InvalidStateTransitionError("This project's proposal is already closed.")
        if not self.is_full:
            size = (
                "the team size has not been set"
                if self.team_size is None
                else (f"the team has {self.headcount} of {self.team_size} people")
            )
            raise TeamNotRecruitingError(f"Close the proposal once the team is full; {size}.")
        return replace(self, status=TeamStatus.LOCKED)

    def ensure_locked(self) -> None:
        if self.status is not TeamStatus.LOCKED:
            raise InvalidStateTransitionError(
                "The Team Lead closes the project proposal first, once the team is full."
                if self.status is TeamStatus.OPEN
                else f"This team is {self.status}, so the project has already started."
            )

    def activate(self) -> Team:
        """``Locked -> Active``: the start conditions are met and work begins."""
        self.ensure_locked()
        return replace(self, status=TeamStatus.ACTIVE)
