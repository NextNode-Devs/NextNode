"""Deposit arithmetic. Pure, so #6 can preview the amount with the same rule."""

from nextnode.domain.errors import ValidationError
from nextnode.domain.projects.budget import ensure_meets_minimum_budget

CURRENCY = "cad"


def deposit_for(accepted_total_cents: int, percent: int) -> int:
    """The deposit for an accepted offer total: ``percent`` % of it in whole
    cents, half a cent rounding up. The total must meet the minimum budget."""
    if not 1 <= percent <= 100:
        raise ValidationError(f"The deposit percentage must be between 1 and 100, got {percent}.")
    ensure_meets_minimum_budget(accepted_total_cents)
    return (accepted_total_cents * percent + 50) // 100
