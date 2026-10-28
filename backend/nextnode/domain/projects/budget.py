"""The minimum budget of a client project: one rule shared by the brief (#3),
every offer (#6) and the deposit checkout (#7), so all three refuse the same
totals. Amounts are whole CAD cents."""

from nextnode.domain.errors import ValidationError

MIN_PROJECT_BUDGET_CENTS = 150_000  # CAD 1,500.00


def format_cad(cents: int) -> str:
    return f"CAD {cents // 100:,}.{cents % 100:02d}"


def ensure_meets_minimum_budget(total_cents: int, field: str = "total") -> None:
    if total_cents < MIN_PROJECT_BUDGET_CENTS:
        raise ValidationError(
            f"The project total must be at least {format_cad(MIN_PROJECT_BUDGET_CENTS)}; "
            f"this one is {format_cad(total_cents)}.",
            fields={field: [f"Must be at least {format_cad(MIN_PROJECT_BUDGET_CENTS)}."]},
        )
