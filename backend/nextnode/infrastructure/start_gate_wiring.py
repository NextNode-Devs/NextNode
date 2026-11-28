"""The container's start-gate wiring (#6), with A2's milestone start (#176).
Kept out of ``container.py`` for its 500-line limit; ``Container`` inherits it."""

from __future__ import annotations

from typing import Any

from django.conf import settings

from nextnode.application.conversations.workspace import TeamWorkspaceChats
from nextnode.application.start_gate.deps import StartGateDeps
from nextnode.application.start_gate.use_cases import StartGateUseCases


class StartGateWiring:
    @property
    def start_gate(self) -> StartGateUseCases:
        c: Any = self  # the Container, which holds the shared adapters below
        return StartGateUseCases(
            StartGateDeps(
                projects=c.projects,
                offers=c.offers,
                timelines=c.timelines,
                deposits=c.deposit_status,
                workspace=TeamWorkspaceChats(c.open_conversation, c.conversations),
                recruitment=c.teams.close_recruitment,
                clock=c.clock,
                uow=c.uow,
                deposit_percent=settings.ENV.deposit_percent,
                milestones=c.milestones.begin,
            )
        )
