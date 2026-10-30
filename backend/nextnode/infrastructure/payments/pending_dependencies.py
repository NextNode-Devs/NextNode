"""Stand-ins for what #3 and #6 provide, until those issues merge.

They answer 503 and never invent a project or start one, so the deposit flow
cannot run against fake data. #6 replaces both in ``container.py`` with its
real project adapters; nothing else changes.
"""

from nextnode.application.payments.ports import DepositTerms, PaymentsUnavailableError

NOT_READY = "Deposits need projects and the project start gate (#3, #6), which are not built yet."


class ProjectsNotReady:
    def get_for_update(self, project_id: int) -> DepositTerms | None:
        raise PaymentsUnavailableError(NOT_READY)

    def start_client_project(self, project_id: int, offer_version_id: int) -> None:
        raise PaymentsUnavailableError(NOT_READY)
