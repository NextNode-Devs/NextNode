"""The container's portfolio-certificate wiring (NN-34). Kept out of
``container.py`` for its 500-line limit; ``Container`` inherits it, so tests
still swap the adapter with ``override_container()``."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from nextnode.application.accounts.certificates import (
    CertificateDeps,
    CertificateRepository,
    CertificateUseCases,
)
from nextnode.infrastructure.persistence.certificates import DjangoCertificates


@dataclass(frozen=True, kw_only=True)
class CertificateWiring:
    certificates: CertificateRepository = field(default_factory=DjangoCertificates)

    @property
    def portfolio_certificates(self) -> CertificateUseCases:
        c: Any = self  # the Container, which holds the shared adapters below
        return CertificateUseCases(
            CertificateDeps(
                certificates=self.certificates,
                portfolios=c.portfolios,
                storage=c.file_storage,
                policy=c.access_policy,
                clock=c.clock,
                uow=c.uow,
                limits=c.upload_limits,
            )
        )
