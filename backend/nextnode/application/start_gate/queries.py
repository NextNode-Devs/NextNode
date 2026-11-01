"""Reading the start gate (#6) and previewing a deposit while the Lead writes an offer."""

from __future__ import annotations

from nextnode.application.ports import Actor
from nextnode.application.start_gate.deps import StartGateDeps
from nextnode.application.start_gate.dto import DepositPreview, StartGateView
from nextnode.domain.errors import ForbiddenError, InvalidStateTransitionError
from nextnode.domain.payments import CURRENCY, deposit_for
from nextnode.domain.projects import ensure_meets_minimum_budget


class GetStartGate:
    """Each condition, its state and who acts next, for the client, the Team Lead and members."""

    def __init__(self, deps: StartGateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> StartGateView:
        return self._d.view(self._d.load(project_id, lock=False), actor)


class PreviewDeposit:
    """The deposit an offer total would carry, so the Lead's form shows the
    server's figure. Refuses a total below the minimum, naming the field."""

    def __init__(self, deps: StartGateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, total_cents: int) -> DepositPreview:
        record = self._d.load(project_id, lock=False)
        if not record.team.is_lead(actor.account_id):
            raise ForbiddenError("Only this project's Team Lead can preview an offer.")
        if not record.project.is_client_project:
            raise InvalidStateTransitionError("Developer project ideas have no offer or deposit.")
        ensure_meets_minimum_budget(total_cents, field="total_cents")
        percent = self._d.deposit_percent
        return DepositPreview(total_cents, deposit_for(total_cents, percent), percent, CURRENCY)
