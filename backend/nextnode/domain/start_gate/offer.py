"""The Team Lead's offer on a client project (#6; class diagram
``sendOfferToClient``, ``signAgreement``, ``reviewOffer``).

Each version is immutable once signed: its estimate, total and timeline never
change. The client decides it once (accept, or decline with a reason) and that
record is never edited either. A declined version stays readable; the Lead
negotiates by sending a new version. Only one version is open at a time.

This is an in-app acknowledgement for a student prototype, not a legal
contract, and nothing here adds legal terms.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, datetime
from enum import StrEnum

from nextnode.domain.errors import ConflictError, ForbiddenError, InvalidStateTransitionError, ValidationError
from nextnode.domain.projects.budget import MIN_PROJECT_BUDGET, format_cad
from nextnode.domain.projects.project import MAX_BUDGET
from nextnode.domain.start_gate.timeline import Timeline

SUMMARY_MIN = 20
SUMMARY_MAX = 2000
REASON_MAX = 500


class OfferStatus(StrEnum):
    SENT = "sent"  # signed by the Team Lead, waiting for the client
    ACCEPTED = "accepted"
    DECLINED = "declined"


class OfferOpenError(ConflictError):
    code = "OFFER_OPEN"

    def __init__(self, version: int) -> None:
        super().__init__(f"Version {version} of the offer is still waiting for the client's answer.")


@dataclass(frozen=True)
class OfferTerms:
    """What the Team Lead writes: the estimate summary, the total in CAD cents and the timeline."""

    summary: str
    total_cents: int
    timeline: Timeline

    @classmethod
    def create(
        cls, *, summary: str, total_cents: int, start_date: date, delivery_date: date, today: date
    ) -> OfferTerms:
        summary = summary.strip()
        errors = Timeline.errors(start_date, delivery_date, today)
        if not SUMMARY_MIN <= len(summary) <= SUMMARY_MAX:
            errors["summary"] = [f"Use {SUMMARY_MIN} to {SUMMARY_MAX:,} characters."]
        # The same floor as the brief and checkout (#3, #7): the API refuses less, whatever the UI did.
        if total_cents < MIN_PROJECT_BUDGET:
            errors["total_cents"] = [f"Must be at least {format_cad(MIN_PROJECT_BUDGET)}."]
        elif total_cents > MAX_BUDGET:
            errors["total_cents"] = [f"Must be at most {format_cad(MAX_BUDGET)}."]
        if errors:
            message = (
                f"The offer total must be at least {format_cad(MIN_PROJECT_BUDGET)}; "
                f"this is {format_cad(total_cents)}."
                if total_cents < MIN_PROJECT_BUDGET
                else "Some fields need attention."
            )
            raise ValidationError(message, errors)
        return cls(summary, total_cents, Timeline(start_date, delivery_date))


@dataclass(frozen=True)
class Offer:
    id: int | None
    project_id: int
    version: int  # 1, 2, ... per project
    terms: OfferTerms
    signed_by_account_id: int  # the Team Lead
    signed_at: datetime
    status: OfferStatus = OfferStatus.SENT
    decided_by_account_id: int | None = None
    decided_at: datetime | None = None
    decline_reason: str | None = None

    @classmethod
    def sign(
        cls, project_id: int, previous: list[Offer], terms: OfferTerms, lead_account_id: int, at: datetime
    ) -> Offer:
        """The next version, signed by the Lead. Refused while another version is open or accepted."""
        latest = max(previous, key=lambda offer: offer.version, default=None)
        if latest is not None and latest.status is OfferStatus.SENT:
            raise OfferOpenError(latest.version)
        if latest is not None and latest.status is OfferStatus.ACCEPTED:
            raise InvalidStateTransitionError("The client has already accepted an offer for this project.")
        version = 1 if latest is None else latest.version + 1
        return cls(None, project_id, version, terms, lead_account_id, at)

    @property
    def is_open(self) -> bool:
        return self.status is OfferStatus.SENT

    def _decide(self, client_account_id: int, owner_account_id: int) -> None:
        if client_account_id != owner_account_id:
            raise ForbiddenError("Only the project's client can accept or decline the offer.")
        if not self.is_open:
            raise InvalidStateTransitionError(
                f"Version {self.version} of the offer was already {self.status}; it can't be changed."
            )

    def accept(self, client_account_id: int, owner_account_id: int, at: datetime) -> Offer:
        self._decide(client_account_id, owner_account_id)
        return replace(
            self, status=OfferStatus.ACCEPTED, decided_by_account_id=client_account_id, decided_at=at
        )

    def decline(self, client_account_id: int, owner_account_id: int, reason: str, at: datetime) -> Offer:
        self._decide(client_account_id, owner_account_id)
        text = " ".join(reason.split())
        if not text:
            raise ValidationError(
                "Tell the Team Lead why, so they can revise the offer.",
                {"reason": ["Say why you're declining."]},
            )
        if len(text) > REASON_MAX:
            raise ValidationError(
                f"Keep the reason to {REASON_MAX} characters.",
                {"reason": [f"Up to {REASON_MAX} characters."]},
            )
        return replace(
            self,
            status=OfferStatus.DECLINED,
            decided_by_account_id=client_account_id,
            decided_at=at,
            decline_reason=text,
        )


def latest_offer(offers: list[Offer]) -> Offer | None:
    return max(offers, key=lambda offer: offer.version, default=None)


def accepted_offer(offers: list[Offer]) -> Offer | None:
    return next((offer for offer in offers if offer.status is OfferStatus.ACCEPTED), None)
