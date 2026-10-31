"""In-memory PortfolioRepository for use case tests: no database."""

from nextnode.application.accounts.ports import DeveloperPortfolio
from nextnode.domain.accounts import DeveloperProfile, Portfolio


class InMemoryPortfolios:
    def __init__(self) -> None:
        self.rows: dict[int, DeveloperPortfolio] = {}

    def add_developer(self, account_id: int, display_name: str = "Ada") -> None:
        profile = DeveloperProfile.create("Backend dev", "", "ada", ["Python"])
        self.rows[account_id] = DeveloperPortfolio(
            account_id, display_name, Portfolio.from_onboarding(profile)
        )

    def get(self, account_id: int) -> DeveloperPortfolio | None:
        return self.rows.get(account_id)

    def save(self, account_id: int, portfolio: Portfolio) -> DeveloperPortfolio:
        existing = self.rows[account_id]
        self.rows[account_id] = DeveloperPortfolio(account_id, existing.display_name, portfolio)
        return self.rows[account_id]
