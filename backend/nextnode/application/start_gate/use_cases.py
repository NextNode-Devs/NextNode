"""Every start-gate use case, built once from the shared collaborators, so the
container wires one property (``container.start_gate``) instead of one per action."""

from __future__ import annotations

from nextnode.application.start_gate.commands import (
    AcceptOffer,
    CloseProposal,
    DeclineOffer,
    FinalizeTimeline,
    SendOffer,
    StartClientProject,
    StartProject,
)
from nextnode.application.start_gate.deps import StartGateDeps
from nextnode.application.start_gate.queries import GetStartGate, PreviewDeposit


class StartGateUseCases:
    def __init__(self, deps: StartGateDeps) -> None:
        self.get = GetStartGate(deps)
        self.preview_deposit = PreviewDeposit(deps)
        self.close_proposal = CloseProposal(deps)
        self.send_offer = SendOffer(deps)
        self.accept_offer = AcceptOffer(deps)
        self.decline_offer = DeclineOffer(deps)
        self.finalize_timeline = FinalizeTimeline(deps)
        self.start = StartProject(deps)
        self.start_client_project = StartClientProject(deps)
