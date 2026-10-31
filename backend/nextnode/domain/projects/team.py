"""A project's team (#3; class diagram ``Team``, ``TeamMembership``).

One team per project and one project per team (confirmed for Phase 1). This
module owns the team's creation and its Lead; #5 owns the roster (size, members,
open spots) and extends the same records.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import StrEnum

from nextnode.domain.errors import ValidationError
from nextnode.domain.hiring import LeadAlreadyHiredError


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
    team_size: int | None = None  # total people, Lead included; set by the Lead in #5
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
    def open_spots(self) -> int:
        if self.team_size is None or self.status is not TeamStatus.OPEN:
            return 0
        return max(0, self.team_size - self.headcount)

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
