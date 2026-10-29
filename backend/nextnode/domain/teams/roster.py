"""A team's roster (class diagram: Team, TeamMembership; spec Workflow B).

The team itself (its project, its Lead, its creation) belongs to #3. This is
the part Hire Devs changes: the size the Team Lead sets, the members, and the
open spots between them. A team is 5-7 people in total, the Lead included.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from nextnode.domain.errors import ForbiddenError
from nextnode.domain.teams.errors import (
    DuplicateCandidacyError,
    TeamFullError,
    TeamNotRecruitingError,
    TeamSizeError,
)

MIN_TEAM_SIZE = 5
MAX_TEAM_SIZE = 7


class TeamStatus(StrEnum):
    OPEN = "open"  # recruiting
    LOCKED = "locked"  # roster finalised, awaiting the start gate (#6)
    ACTIVE = "active"  # start conditions met, work begun
    ARCHIVED = "archived"


@dataclass
class TeamRoster:
    team_id: int
    project_id: int
    lead_user_id: str  # Clerk user id of the Team Lead
    status: TeamStatus = TeamStatus.OPEN
    team_size: int | None = None  # total people, Lead included; None until the Lead sets it
    member_user_ids: list[str] = field(default_factory=list)  # developers, Lead excluded

    @property
    def headcount(self) -> int:
        return 1 + len(self.member_user_ids)

    @property
    def developer_spots(self) -> int:
        return 0 if self.team_size is None else self.team_size - 1

    @property
    def open_spots(self) -> int:
        return 0 if self.team_size is None else self.team_size - self.headcount

    @property
    def is_full(self) -> bool:
        return self.team_size is not None and self.open_spots == 0

    def is_on_team(self, user_id: str) -> bool:
        return user_id == self.lead_user_id or user_id in self.member_user_ids

    def ensure_lead(self, user_id: str, action: str) -> None:
        if user_id != self.lead_user_id:
            raise ForbiddenError(f"Only this team's Team Lead can {action}.")

    def ensure_open(self) -> None:
        """Every roster change is refused unless the team is recruiting."""
        if self.status is TeamStatus.OPEN:
            return
        if self.status is TeamStatus.LOCKED:
            raise TeamNotRecruitingError(
                "This team's roster is locked, so it no longer takes applications, "
                "invitations or new members."
            )
        raise TeamNotRecruitingError(f"This team is {self.status} and its roster can no longer change.")

    def ensure_has_open_spot(self) -> None:
        self.ensure_open()
        if self.team_size is None:
            raise TeamNotRecruitingError("The Team Lead has not set the team size yet.")
        if self.is_full:
            raise TeamFullError(f"This team already has {self.headcount} of {self.team_size} people.")

    def ensure_can_join(self, user_id: str) -> None:
        """``user_id`` could take a spot: there is one, and they are not on the team."""
        self.ensure_has_open_spot()
        if user_id == self.lead_user_id:
            raise DuplicateCandidacyError("You are this team's Team Lead already.")
        if user_id in self.member_user_ids:
            raise DuplicateCandidacyError("This developer is already a member of the team.")

    def set_size(self, team_size: int) -> None:
        self.ensure_open()
        if not MIN_TEAM_SIZE <= team_size <= MAX_TEAM_SIZE:
            raise TeamSizeError(
                f"A team has {MIN_TEAM_SIZE} to {MAX_TEAM_SIZE} people including the Team Lead "
                f"({MIN_TEAM_SIZE - 1} to {MAX_TEAM_SIZE - 1} developer spots); you chose {team_size}.",
                fields={"team_size": [f"Choose between {MIN_TEAM_SIZE} and {MAX_TEAM_SIZE}."]},
            )
        if team_size < self.headcount:
            raise TeamSizeError(
                f"This team already has {self.headcount} people, so its size cannot be less "
                f"than {self.headcount}.",
                fields={"team_size": [f"Choose at least {self.headcount}."]},
            )
        self.team_size = team_size

    def add_member(self, user_id: str) -> None:
        """Takes one open spot. Never over-fills: a full team refuses."""
        self.ensure_can_join(user_id)
        self.member_user_ids.append(user_id)
