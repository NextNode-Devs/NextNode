"""Composition root: the one place adapters are chosen and use cases built.

Views get use cases from ``get_container()``; tests swap adapters with
``override_container()`` instead of mocking.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, replace
from typing import Any

from django.conf import settings

from nextnode.application.health import CheckHealth
from nextnode.application.ports import DatabaseProbe, TokenVerifier
from nextnode.infrastructure.auth.clerk import ClerkTokenVerifier, UnconfiguredTokenVerifier
from nextnode.infrastructure.persistence.database_probe import DjangoDatabaseProbe


@dataclass(frozen=True)
class Container:
    token_verifier: TokenVerifier
    database: DatabaseProbe

    @property
    def check_health(self) -> CheckHealth:
        return CheckHealth(self.database, self.token_verifier)


def build_container() -> Container:
    clerk = settings.ENV.clerk
    verifier: TokenVerifier = (
        ClerkTokenVerifier(
            issuer=clerk.issuer,
            authorized_parties=clerk.authorized_parties,
            jwks_url=clerk.jwks_url,
        )
        if clerk
        else UnconfiguredTokenVerifier()
    )
    return Container(token_verifier=verifier, database=DjangoDatabaseProbe())


_container: Container | None = None


def get_container() -> Container:
    global _container
    if _container is None:
        _container = build_container()
    return _container


@contextmanager
def override_container(**adapters: Any) -> Iterator[Container]:
    global _container
    previous = get_container()
    _container = replace(previous, **adapters)
    try:
        yield _container
    finally:
        _container = previous
