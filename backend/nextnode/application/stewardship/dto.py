"""What the Assistant Lead and inactivity use cases (NN-39) return."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from nextnode.domain.projects import LEAD_INACTIVE_DAYS, QUESTION, ActivityCheck

# What the roster says an Assistant Lead may and may not do (Phase 2 decisions, 17 Nov).
# ``True``: enforced today. ``False``: planned; the screen labels it so.
ASSISTANT_LEAD_CAN = (
    ("Mark the project closed", True),
    ("Add members", False),
    ("Remove members other than the Team Lead", False),
    ("Update project details", False),
    ("Mark the project complete", False),
)
ASSISTANT_LEAD_CANNOT = (
    "Remove the Team Lead",
    "Override the Team Lead's decisions",
    "Choose another Assistant Lead",
)

# The socket frame #5 already sends; the project page refetches its team on it.
TEAM_UPDATED = "team.updated"


def team_updated_frame(project_id: int, reason: str) -> dict:
    return {"type": TEAM_UPDATED, "project_id": project_id, "reason": reason}


def _iso(at: datetime | None) -> str | None:
    return at.isoformat() if at else None


@dataclass(frozen=True)
class PermissionView:
    label: str
    available: bool  # False: planned, not built yet


@dataclass(frozen=True)
class PersonView:
    account_id: int
    display_name: str


@dataclass(frozen=True)
class ActivityCheckView:
    status: str
    question: str
    started_at: str | None
    answer_by: str | None
    ended_at: str | None
    answered_by: PersonView | None

    @classmethod
    def of(cls, check: ActivityCheck, names: dict[int, str]) -> ActivityCheckView:
        who = check.answered_by_account_id
        return cls(
            status=check.status.value,
            question=QUESTION,
            started_at=_iso(check.started_at),
            answer_by=_iso(check.answer_by),
            ended_at=_iso(check.ended_at),
            answered_by=PersonView(who, names.get(who, "Unknown")) if who is not None else None,
        )


@dataclass(frozen=True)
class StewardshipActions:
    """What the viewer may do now; the UI shows only these. The API re-checks each."""

    choose_assistant_lead: bool
    confirm_active: bool
    close_project: bool


@dataclass(frozen=True)
class StewardshipView:
    """``GET /api/projects/{id}/stewardship/``, for the project's Team Lead and members."""

    project_id: int
    project_status: str
    assistant_lead: PersonView | None
    assistant_lead_can: list[PermissionView]
    assistant_lead_cannot: list[str]
    lead_last_active_at: str | None
    activity_check_due_at: str | None  # when members are asked if the Lead stays silent
    activity_check: ActivityCheckView | None  # the pending one, else the latest that ended
    hidden_from_feed: bool
    members: list[PersonView]  # who the Lead may choose as Assistant Lead
    actions: StewardshipActions


def check_due_at(baseline: datetime | None) -> str | None:
    return _iso(baseline + timedelta(days=LEAD_INACTIVE_DAYS)) if baseline else None


@dataclass(frozen=True)
class ActivityRunReport:
    """What one run of the daily inactivity check did, by project id."""

    asked: list[int]
    closed: list[int]
    lead_returned: list[int]
