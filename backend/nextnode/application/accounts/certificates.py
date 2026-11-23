"""Certificates on a developer's portfolio (NN-34, #102).

The owner uploads PDF certificates and may remove them. Anyone signed in and
onboarded may list a developer's certificates and open one, like the rest of
the portfolio. Files live in private storage under a generated key and are
served only through the API, to a signed-in user.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID, uuid4

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.accounts.portfolio import NO_PORTFOLIO, NOT_FOUND
from nextnode.application.accounts.ports import PortfolioRepository, UnitOfWork
from nextnode.application.conversations.ports import Clock
from nextnode.application.ports import Actor
from nextnode.application.projects.documents import Upload
from nextnode.application.projects.ports import FileStorage
from nextnode.domain.accounts.certificates import (
    CONTENT_TYPE,
    Certificate,
    clean_filename,
    ensure_pdf,
    ensure_room_for_another,
    ensure_size_allowed,
)
from nextnode.domain.errors import ForbiddenError, NotFoundError, ValidationError
from nextnode.domain.projects import UploadLimits
from nextnode.domain.projects.documents import FILE_FIELD

CERTIFICATE_NOT_FOUND = "We couldn't find that certificate."


class CertificateRepository(Protocol):
    def add(self, certificate: Certificate) -> Certificate: ...

    def get(self, account_id: int, certificate_id: UUID) -> Certificate | None: ...

    def for_account(self, account_id: int) -> list[Certificate]:
        """Oldest first, the order they were uploaded in."""
        ...

    def count_for_account(self, account_id: int) -> int: ...

    def delete(self, certificate_id: UUID) -> None: ...


@dataclass(frozen=True)
class CertificateView:
    id: str
    filename: str
    size_bytes: int
    uploaded_at: str | None

    @classmethod
    def of(cls, certificate: Certificate) -> CertificateView:
        uploaded = certificate.uploaded_at
        return cls(
            str(certificate.id),
            certificate.filename,
            certificate.size_bytes,
            uploaded.isoformat() if uploaded else None,
        )


@dataclass(frozen=True)
class CertificateFile:
    filename: str
    content_type: str
    content: bytes


class CertificateDeps:
    def __init__(
        self,
        certificates: CertificateRepository,
        portfolios: PortfolioRepository,
        storage: FileStorage,
        policy: AccessPolicy,
        clock: Clock,
        uow: UnitOfWork,
        limits: UploadLimits,
        new_id: Callable[[], UUID] = uuid4,
    ) -> None:
        self.certificates = certificates
        self.portfolios = portfolios
        self.storage = storage
        self.policy = policy
        self.clock = clock
        self.uow = uow
        self.limits = limits
        self.new_id = new_id

    def ensure_reader(self, actor: Actor, account_id: int) -> None:
        """Same rule as the portfolio; a client or unknown id answers 404."""
        self.policy.check(actor, "read", ResourceRef("portfolio", account_id))
        if self.portfolios.get(account_id) is None:
            raise NotFoundError(NOT_FOUND)

    def ensure_owner(self, actor: Actor) -> int:
        if actor.account_id is None or self.portfolios.get(actor.account_id) is None:
            raise ForbiddenError(NO_PORTFOLIO)
        return actor.account_id


class UploadCertificate:
    def __init__(self, deps: CertificateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, upload: Upload | None) -> CertificateView:
        owner = self._d.ensure_owner(actor)
        if upload is None:
            raise ValidationError("Choose a PDF to upload.", {FILE_FIELD: ["Choose a PDF to upload."]})
        with self._d.uow.atomic():
            ensure_room_for_another(self._d.certificates.count_for_account(owner))
            ensure_size_allowed(upload.size, self._d.limits)
            content = upload.read()
            ensure_size_allowed(len(content), self._d.limits)  # the declared size can lie
            ensure_pdf(upload.filename, content)
            certificate_id = self._d.new_id()
            key = certificate_id.hex  # storage keys are 32 hex characters, unique like the id
            self._d.storage.save(key, content)
            try:
                stored = self._d.certificates.add(
                    Certificate(
                        id=certificate_id,
                        account_id=owner,
                        storage_key=key,
                        filename=clean_filename(upload.filename),
                        size_bytes=len(content),
                        uploaded_at=self._d.clock.now(),
                    )
                )
            except Exception:
                self._d.storage.delete(key)
                raise
            return CertificateView.of(stored)


class DeleteCertificate:
    """Only the owner; another developer's certificate answers 404."""

    def __init__(self, deps: CertificateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, certificate_id: UUID) -> CertificateView:
        owner = self._d.ensure_owner(actor)
        with self._d.uow.atomic():
            certificate = self._d.certificates.get(owner, certificate_id)
            if certificate is None:
                raise NotFoundError(CERTIFICATE_NOT_FOUND)
            self._d.certificates.delete(certificate_id)
        self._d.storage.delete(certificate.storage_key)
        return CertificateView.of(certificate)


class ListCertificates:
    def __init__(self, deps: CertificateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, account_id: int) -> list[CertificateView]:
        self._d.ensure_reader(actor, account_id)
        return [CertificateView.of(c) for c in self._d.certificates.for_account(account_id)]


class OpenCertificate:
    """The PDF itself, for the preview and download on the portfolio."""

    def __init__(self, deps: CertificateDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, account_id: int, certificate_id: UUID) -> CertificateFile:
        self._d.ensure_reader(actor, account_id)
        certificate = self._d.certificates.get(account_id, certificate_id)
        if certificate is None:
            raise NotFoundError(CERTIFICATE_NOT_FOUND)
        return CertificateFile(
            certificate.filename, CONTENT_TYPE, self._d.storage.read(certificate.storage_key)
        )


class CertificateUseCases:
    """Built once, so the container wires one property."""

    def __init__(self, deps: CertificateDeps) -> None:
        self.upload = UploadCertificate(deps)
        self.delete = DeleteCertificate(deps)
        self.list = ListCertificates(deps)
        self.open = OpenCertificate(deps)
