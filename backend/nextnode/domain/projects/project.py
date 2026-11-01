"""A project (#3; class diagram ``Project``). Two kinds, kept distinct:

- ``client``: a client publishes a brief with a proposed budget; a Team Lead is
  hired later (#4); an offer, agreement and deposit apply (#6, #7).
- ``developer``: a developer proposes an idea and is its Team Lead from the
  start; no budget, offer, agreement or payment ever applies.

Status changes only through the methods below, which refuse illegal moves.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, datetime
from enum import StrEnum

from nextnode.domain.accounts import SkillName, normalize_skills
from nextnode.domain.errors import ConflictError, ForbiddenError, InvalidStateTransitionError, ValidationError
from nextnode.domain.projects.budget import ensure_meets_minimum_budget, format_cad

TITLE_MIN = 5
TITLE_MAX = 100
DESCRIPTION_MIN = 20
DESCRIPTION_MAX = 5000
MAX_BUDGET = 100_000_000  # CAD 1,000,000.00, a sanity ceiling on a proposal


class ProjectKind(StrEnum):
    CLIENT = "client"
    DEVELOPER = "developer"


class ProjectStatus(StrEnum):
    POSTED = "Posted"
    OFFER_SENT = "OfferSent"  # the Team Lead sent an offer (#6)
    ASSIGNED = "Assigned"  # the client accepted it (#6)
    IN_PROGRESS = "InProgress"
    COMPLETED = "Completed"
    ARCHIVED = "Archived"


_CLIENT_FLOW = {
    ProjectStatus.POSTED: ProjectStatus.OFFER_SENT,
    ProjectStatus.OFFER_SENT: ProjectStatus.ASSIGNED,
    ProjectStatus.ASSIGNED: ProjectStatus.IN_PROGRESS,
    ProjectStatus.IN_PROGRESS: ProjectStatus.COMPLETED,
    ProjectStatus.COMPLETED: ProjectStatus.ARCHIVED,
}
_DEVELOPER_FLOW = {
    ProjectStatus.POSTED: ProjectStatus.IN_PROGRESS,
    ProjectStatus.IN_PROGRESS: ProjectStatus.COMPLETED,
    ProjectStatus.COMPLETED: ProjectStatus.ARCHIVED,
}


@dataclass(frozen=True)
class ProjectDetails:
    """What the owner writes. ``proposed_budget_cents`` exists only for client projects."""

    title: str
    description: str
    tech_stack: tuple[SkillName, ...]
    target_delivery_date: date
    proposed_budget_cents: int | None = None

    @classmethod
    def create(
        cls,
        kind: ProjectKind,
        *,
        title: str,
        description: str,
        tech_stack: list[str],
        target_delivery_date: date,
        proposed_budget_cents: int | None,
        today: date,
    ) -> ProjectDetails:
        title = " ".join(title.split())
        description = description.strip()
        errors: dict[str, list[str]] = {}
        if not TITLE_MIN <= len(title) <= TITLE_MAX:
            errors["title"] = [f"Use {TITLE_MIN} to {TITLE_MAX} characters."]
        if not DESCRIPTION_MIN <= len(description) <= DESCRIPTION_MAX:
            errors["description"] = [f"Use {DESCRIPTION_MIN} to {DESCRIPTION_MAX:,} characters."]
        if target_delivery_date <= today:
            errors["target_delivery_date"] = ["Choose a date after today."]
        if errors:
            raise ValidationError("Some fields need attention.", errors)
        skills = tuple(normalize_skills(tech_stack, field="tech_stack"))
        budget = _check_budget(kind, proposed_budget_cents)
        return cls(title, description, skills, target_delivery_date, budget)


def _check_budget(kind: ProjectKind, cents: int | None) -> int | None:
    if kind is ProjectKind.DEVELOPER:
        if cents is not None:
            raise ValidationError(
                "Developer project ideas have no budget.",
                {"proposed_budget_cents": ["Developer project ideas have no budget."]},
            )
        return None
    if cents is None:
        raise ValidationError(
            "Propose a budget for your project.", {"proposed_budget_cents": ["Propose a budget."]}
        )
    ensure_meets_minimum_budget(cents, field="proposed_budget_cents")
    if cents > MAX_BUDGET:
        raise ValidationError(
            f"Budgets above {format_cad(MAX_BUDGET)} aren't accepted.",
            {"proposed_budget_cents": [f"Must be at most {format_cad(MAX_BUDGET)}."]},
        )
    return cents


@dataclass(frozen=True)
class Project:
    id: int | None
    kind: ProjectKind
    owner_account_id: int  # the client (client projects) or the creating developer (ideas)
    status: ProjectStatus
    details: ProjectDetails
    created_at: datetime | None = None

    @classmethod
    def publish(cls, kind: ProjectKind, owner_account_id: int, details: ProjectDetails) -> Project:
        return cls(None, kind, owner_account_id, ProjectStatus.POSTED, details)

    @property
    def is_client_project(self) -> bool:
        return self.kind is ProjectKind.CLIENT

    # --- editing -----------------------------------------------------------------

    def edit(self, actor_id: int, details: ProjectDetails, *, has_lead: bool) -> Project:
        """Only the owner, only while ``Posted`` and, for a client project, before a Lead is hired."""
        if actor_id != self.owner_account_id:
            raise ForbiddenError("Only the project's owner can edit it.")
        if self.status is not ProjectStatus.POSTED:
            raise ConflictError(f"This project is {self.status} and can no longer be edited.")
        if self.is_client_project and has_lead:
            raise ConflictError("This project has a Team Lead now, so its brief can no longer be edited.")
        return replace(self, details=details)

    # --- status (#6 calls these) ------------------------------------------------

    def send_offer(self) -> Project:
        return self._move(ProjectStatus.OFFER_SENT)

    def revise_offer(self) -> Project:
        """A revised version after the client declined one (#6): the project stays ``OfferSent``."""
        if not self.is_client_project or self.status is not ProjectStatus.OFFER_SENT:
            self._move(ProjectStatus.OFFER_SENT)  # raises the same reason a first offer would
        return self

    def accept_offer(self) -> Project:
        return self._move(ProjectStatus.ASSIGNED)

    def start(self) -> Project:
        return self._move(ProjectStatus.IN_PROGRESS)

    def complete(self) -> Project:
        return self._move(ProjectStatus.COMPLETED)

    def archive(self) -> Project:
        return self._move(ProjectStatus.ARCHIVED)

    def _move(self, target: ProjectStatus) -> Project:
        flow = _CLIENT_FLOW if self.is_client_project else _DEVELOPER_FLOW
        if flow.get(self.status) is not target:
            if not self.is_client_project and target in (ProjectStatus.OFFER_SENT, ProjectStatus.ASSIGNED):
                raise InvalidStateTransitionError(
                    "Developer project ideas have no offer, so they are never OfferSent or Assigned."
                )
            raise InvalidStateTransitionError(f"A {self.status} project can't become {target}.")
        return replace(self, status=target)
