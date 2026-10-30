"""The one access policy REST views and socket consumers both use (#1).

Deny by default: an action on a resource type nobody registered a rule for is
refused, and so is any actor who has not finished onboarding. Later issues add
their rules in ``infrastructure/access_rules.py`` (conversation participant in
#4, project document reader in #3, team member in #5).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from nextnode.application.ports import Actor
from nextnode.domain.errors import ForbiddenError

DENIED = "You don't have access to this."


@dataclass(frozen=True)
class ResourceRef:
    type: str
    id: str | int


AccessRule = Callable[[Actor, ResourceRef], bool]


class AccessPolicy:
    def __init__(self) -> None:
        self._rules: dict[tuple[str, str], AccessRule] = {}

    def register(self, resource_type: str, action: str, rule: AccessRule) -> None:
        key = (resource_type, action)
        if key in self._rules:
            raise ValueError(f"An access rule for {action!r} on {resource_type!r} is already registered.")
        self._rules[key] = rule

    def allows(self, actor: Actor, action: str, resource: ResourceRef) -> bool:
        rule = self._rules.get((resource.type, action))
        if rule is None or actor.account_id is None:
            return False
        return bool(rule(actor, resource))

    def check(self, actor: Actor, action: str, resource: ResourceRef) -> None:
        """Raises ``ForbiddenError`` unless a registered rule allows it."""
        if not self.allows(actor, action, resource):
            raise ForbiddenError(DENIED)
