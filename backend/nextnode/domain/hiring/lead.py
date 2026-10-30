"""Workflow A, Hire Lead (spec; issue #4), for client-funded projects only.

A developer applies to lead a project, or its client invites one. Each opens a
hiring conversation. An invitation becomes a candidacy only when the developer
accepts it; applying makes you a candidate at once. The client hires one
candidate as Team Lead; every other open candidacy for the project closes. The
project stays ``Posted`` (``Assigned`` means an accepted offer, #6).

The project and its team belong to #3. This module sees only what hiring needs
of them (``LeadProject``) and never changes a project's status.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from nextnode.domain.errors import ConflictError, ForbiddenError, InvalidStateTransitionError, ValidationError

NOTE_MAX = 1000
POSTED = "Posted"


class LeadCandidacyKind(StrEnum):
    APPLICATION = "application"  # the developer applied
    INVITATION = "invitation"  # the client invited them


class LeadCandidacyStatus(StrEnum):
    INVITED = "invited"  # invitation awaiting the developer's answer
    CANDIDATE = "candidate"  # applied, or accepted an invitation; can be hired
    HIRED = "hired"
    DECLINED = "declined"  # the developer declined the invitation
    WITHDRAWN = "withdrawn"  # the developer withdrew the application
    CLOSED = "closed"  # another candidate was hired


ACTIVE = frozenset({LeadCandidacyStatus.INVITED, LeadCandidacyStatus.CANDIDATE})

ANOTHER_HIRED = "Another candidate was hired."
DECLINED_REASON = "The developer declined the invitation."
WITHDRAWN_REASON = "The developer withdrew their application."


class LeadAlreadyHiredError(ConflictError):
    code = "LEAD_ALREADY_HIRED"

    def __init__(self) -> None:
        super().__init__("This project already has a Team Lead.")


@dataclass(frozen=True)
class LeadProject:
    """What Hire Lead needs to know about a project (#3 owns the project itself)."""

    id: int
    client_account_id: int
    client_funded: bool  # False for developer-created projects
    status: str
    lead_account_id: int | None

    def ensure_open_for_lead(self) -> None:
        if not self.client_funded:
            raise ValidationError(
                "Developer-created projects already have their Team Lead: the developer who created them."
            )
        if self.lead_account_id is not None:
            raise LeadAlreadyHiredError()
        if self.status != POSTED:
            raise ValidationError("This project isn't looking for a Team Lead.")


def clean_note(note: str | None) -> str:
    text = (note or "").strip()
    if len(text) > NOTE_MAX:
        raise ValidationError(f"Keep the note under {NOTE_MAX:,} characters.", {"note": ["Too long."]})
    return text


@dataclass(frozen=True)
class LeadCandidacy:
    id: UUID
    project_id: int
    client_account_id: int
    developer_account_id: int
    kind: LeadCandidacyKind
    status: LeadCandidacyStatus
    note: str = ""
    created_at: datetime | None = None
    decided_at: datetime | None = None

    @classmethod
    def apply(
        cls, candidacy_id: UUID, project: LeadProject, developer_id: int, note: str | None
    ) -> LeadCandidacy:
        project.ensure_open_for_lead()
        return cls(
            id=candidacy_id,
            project_id=project.id,
            client_account_id=project.client_account_id,
            developer_account_id=developer_id,
            kind=LeadCandidacyKind.APPLICATION,
            status=LeadCandidacyStatus.CANDIDATE,
            note=clean_note(note),
        )

    @classmethod
    def invite(
        cls, candidacy_id: UUID, project: LeadProject, developer_id: int, note: str | None
    ) -> LeadCandidacy:
        project.ensure_open_for_lead()
        return cls(
            id=candidacy_id,
            project_id=project.id,
            client_account_id=project.client_account_id,
            developer_account_id=developer_id,
            kind=LeadCandidacyKind.INVITATION,
            status=LeadCandidacyStatus.INVITED,
            note=clean_note(note),
        )

    @property
    def is_active(self) -> bool:
        return self.status in ACTIVE

    @property
    def participant_ids(self) -> tuple[int, int]:
        return (self.client_account_id, self.developer_account_id)

    def involves(self, account_id: int | None) -> bool:
        return account_id is not None and account_id in self.participant_ids

    # --- the developer's answers ---------------------------------------------------

    def accept(self, actor_id: int, at: datetime) -> LeadCandidacy:
        self._ensure_developer(actor_id, "accept this invitation")
        self._ensure(LeadCandidacyStatus.INVITED, "This invitation has already been answered.")
        return replace(self, status=LeadCandidacyStatus.CANDIDATE, decided_at=at)

    def decline(self, actor_id: int, at: datetime) -> LeadCandidacy:
        self._ensure_developer(actor_id, "decline this invitation")
        self._ensure(LeadCandidacyStatus.INVITED, "This invitation has already been answered.")
        return replace(self, status=LeadCandidacyStatus.DECLINED, decided_at=at)

    def withdraw(self, actor_id: int, at: datetime) -> LeadCandidacy:
        self._ensure_developer(actor_id, "withdraw this application")
        if self.kind is not LeadCandidacyKind.APPLICATION:
            raise InvalidStateTransitionError(
                "Only an application can be withdrawn; decline an invitation instead."
            )
        self._ensure(LeadCandidacyStatus.CANDIDATE, "This application is no longer open.")
        return replace(self, status=LeadCandidacyStatus.WITHDRAWN, decided_at=at)

    # --- the client's decision -------------------------------------------------------

    def hire(self, actor_id: int, at: datetime) -> LeadCandidacy:
        if actor_id != self.client_account_id:
            raise ForbiddenError("Only the project's client can hire its Team Lead.")
        if self.status is LeadCandidacyStatus.INVITED:
            raise InvalidStateTransitionError(
                "The developer has to accept your invitation before you can hire them."
            )
        self._ensure(LeadCandidacyStatus.CANDIDATE, "This candidacy is no longer open.")
        return replace(self, status=LeadCandidacyStatus.HIRED, decided_at=at)

    def close_because_another_was_hired(self, at: datetime) -> LeadCandidacy:
        if not self.is_active:
            return self
        return replace(self, status=LeadCandidacyStatus.CLOSED, decided_at=at)

    # --- helpers -----------------------------------------------------------------------

    def _ensure_developer(self, actor_id: int, action: str) -> None:
        if actor_id != self.developer_account_id:
            raise ForbiddenError(f"Only the developer can {action}.")

    def _ensure(self, expected: LeadCandidacyStatus, message: str) -> None:
        if self.status is not expected:
            raise InvalidStateTransitionError(message)
