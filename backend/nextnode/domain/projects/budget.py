"""The minimum budget of a client project: one rule shared by the brief (#3),
every offer (#6) and the deposit checkout (#7), so all three refuse the same
totals. Amounts are whole CAD cents."""

from nextnode.domain.errors import ValidationError

MIN_PROJECT_BUDGET = 150_000  # in CAD cents: CAD 1,500.00


def format_cad(cents: int) -> str:
    return f"CAD {cents // 100:,}.{cents % 100:02d}"


def ensure_meets_minimum_budget(total_cents: int, field: str = "total") -> None:
    if total_cents < MIN_PROJECT_BUDGET:
        raise ValidationError(
            # Neutral wording: shown for a brief's proposed budget, an offer total and a checkout.
            f"Must be at least {format_cad(MIN_PROJECT_BUDGET)}; this is {format_cad(total_cents)}.",
            fields={field: [f"Must be at least {format_cad(MIN_PROJECT_BUDGET)}."]},
        )
