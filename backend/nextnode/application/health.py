"""Reference use case: the smallest complete example of the endpoint pattern
(use case + ports + DTO → adapter → container → view). Copy its shape."""

from dataclasses import dataclass
from typing import Literal

from nextnode.application.ports import DatabaseProbe, TokenVerifier


@dataclass(frozen=True)
class HealthReport:
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
    auth: Literal["configured", "unconfigured"]


class CheckHealth:
    def __init__(self, database: DatabaseProbe, token_verifier: TokenVerifier) -> None:
        self._database = database
        self._token_verifier = token_verifier

    def execute(self) -> HealthReport:
        database_ok = self._database.is_reachable()
        return HealthReport(
            status="ok" if database_ok else "degraded",
            database="ok" if database_ok else "unavailable",
            auth="configured" if self._token_verifier.configured else "unconfigured",
        )
