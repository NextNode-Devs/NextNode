"""A project timeline: when work starts and when it is delivered (#6).

A client project's timeline is part of each offer the Team Lead signs; a
developer idea's Team Lead finalises one, which starts the project.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from nextnode.domain.errors import ValidationError


@dataclass(frozen=True)
class Timeline:
    start_date: date
    delivery_date: date

    @staticmethod
    def errors(start_date: date, delivery_date: date, today: date) -> dict[str, list[str]]:
        """Field errors, so an offer can report them with its other fields."""
        errors: dict[str, list[str]] = {}
        if start_date < today:
            errors["start_date"] = ["Choose today or a later date."]
        if delivery_date <= start_date:
            errors["delivery_date"] = ["Choose a date after the start date."]
        return errors

    @classmethod
    def create(cls, start_date: date, delivery_date: date, today: date) -> Timeline:
        errors = cls.errors(start_date, delivery_date, today)
        if errors:
            raise ValidationError("Some fields need attention.", errors)
        return cls(start_date, delivery_date)


@dataclass(frozen=True)
class FinalisedTimeline:
    """A developer idea's timeline, recorded once with who finalised it and when."""

    project_id: int
    timeline: Timeline
    finalised_by_account_id: int
    finalised_at: datetime
