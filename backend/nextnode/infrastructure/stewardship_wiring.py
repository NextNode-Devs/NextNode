"""The container's Assistant Lead and inactivity wiring (NN-39). Kept out of
``container.py`` for its 500-line limit; ``Container`` inherits it, so tests
still swap these adapters with ``override_container()``."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from nextnode.application.stewardship.ports import ActivityChecks, LeadActivity
from nextnode.application.stewardship.use_cases import StewardshipDeps, StewardshipUseCases
from nextnode.infrastructure.persistence.stewardship import DjangoActivityChecks, DjangoLeadActivity


@dataclass(frozen=True, kw_only=True)
class StewardshipWiring:
    activity_checks: ActivityChecks = field(default_factory=DjangoActivityChecks)
    lead_activity: LeadActivity = field(default_factory=DjangoLeadActivity)

    @property
    def stewardship(self) -> StewardshipUseCases:
        c: Any = self  # the Container, which holds the shared adapters below
        return StewardshipUseCases(
            StewardshipDeps(
                projects=c.projects,
                checks=self.activity_checks,
                activity=self.lead_activity,
                names=c.account_names,
                events=c.conversation_events,
                policy=c.access_policy,
                clock=c.clock,
                uow=c.uow,
            )
        )
