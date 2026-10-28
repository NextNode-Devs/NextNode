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
from nextnode.application.payments.ports import (
    PaymentGateway,
    PaymentRepository,
    UnitOfWork,
    WebhookEventLog,
)
from nextnode.application.payments.webhook import HandlePaymentWebhook
from nextnode.application.ports import DatabaseProbe, TokenVerifier
from nextnode.infrastructure.auth.clerk import ClerkTokenVerifier, UnconfiguredTokenVerifier
from nextnode.infrastructure.payments.stripe_gateway import StripeGateway, UnconfiguredPaymentGateway
from nextnode.infrastructure.persistence.database_probe import DjangoDatabaseProbe
from nextnode.infrastructure.persistence.payments import (
    DjangoPaymentRepository,
    DjangoUnitOfWork,
    DjangoWebhookEventLog,
)


@dataclass(frozen=True)
class Container:
    token_verifier: TokenVerifier
    database: DatabaseProbe
    payment_gateway: PaymentGateway
    payments: PaymentRepository
    webhook_events: WebhookEventLog
    uow: UnitOfWork

    @property
    def check_health(self) -> CheckHealth:
        return CheckHealth(self.database, self.token_verifier)

    @property
    def handle_payment_webhook(self) -> HandlePaymentWebhook:
        return HandlePaymentWebhook(self.payment_gateway, self.payments, self.webhook_events, self.uow)


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
    stripe = settings.ENV.stripe
    gateway: PaymentGateway = (
        StripeGateway(stripe.secret_key, stripe.webhook_secret) if stripe else UnconfiguredPaymentGateway()
    )
    return Container(
        token_verifier=verifier,
        database=DjangoDatabaseProbe(),
        payment_gateway=gateway,
        payments=DjangoPaymentRepository(),
        webhook_events=DjangoWebhookEventLog(),
        uow=DjangoUnitOfWork(),
    )


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
