"""The container's milestone review wiring (A2, #176). Kept out of
``container.py`` for its 500-line limit; ``Container`` inherits it, so tests
still swap the store with ``override_container(milestone_store=...)``."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from nextnode.application.milestones.ports import MilestoneStore
from nextnode.application.milestones.use_cases import MilestoneDeps, MilestoneUseCases
from nextnode.infrastructure.persistence.milestones import DjangoMilestoneStore


@dataclass(frozen=True, kw_only=True)
class MilestoneWiring:
    milestone_store: MilestoneStore = field(default_factory=DjangoMilestoneStore)

    @property
    def milestones(self) -> MilestoneUseCases:
        c: Any = self  # the Container, which holds the shared adapters below
        return MilestoneUseCases(
            MilestoneDeps(
                projects=c.projects,
                store=self.milestone_store,
                names=c.account_names,
                notifications=c.notifications,
                clock=c.clock,
                uow=c.uow,
            )
        )
