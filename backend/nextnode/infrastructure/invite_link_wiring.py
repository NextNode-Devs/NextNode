"""The container's invite-link wiring (A4, #178). Kept out of ``container.py``
for its 500-line limit; ``Container`` inherits it, so tests still swap the
store with ``override_container(invite_links_store=...)``."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from nextnode.application.teams.invite_links import InviteLinkRepository, InviteLinks
from nextnode.infrastructure.persistence.invite_links import DjangoInviteLinkRepository


@dataclass(frozen=True, kw_only=True)
class InviteLinkWiring:
    invite_links_store: InviteLinkRepository = field(default_factory=DjangoInviteLinkRepository)

    @property
    def invite_links(self) -> InviteLinks:
        c: Any = self  # the Container, which holds the shared adapters below
        return InviteLinks(c.team_deps, self.invite_links_store, c.notifications)
