"""Private requirement documents (#3; FR4, NFR2).

The owning client uploads PDF/DOCX files while its project is ``Posted``.
Readers are the owning client, the Team Lead and approved members (the
``project_document`` access rule). Everyone else, applicants and invitees
included, gets 404 on the list, the link and the download, as if there were
nothing there. A link lasts 15 minutes and the download re-checks access, so a
reader who loses access loses the link at once.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID, uuid4

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.conversations.ports import Clock
from nextnode.application.ports import Actor
from nextnode.application.projects.commands import PROJECT_NOT_FOUND
from nextnode.application.projects.dto import DocumentDownload, DocumentLinkView, DocumentView
from nextnode.application.projects.ports import (
    DocumentRepository,
    FileGrant,
    FileStorage,
    InvalidLinkError,
    LinkSigner,
    ProjectRepository,
    UnitOfWork,
)
from nextnode.domain.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from nextnode.domain.projects import LINK_LIFETIME_SECONDS, ProjectStatus, RequirementDocument, UploadLimits
from nextnode.domain.projects.documents import (
    FILE_FIELD,
    clean_filename,
    detect_type,
    ensure_room_for_another,
    ensure_size_allowed,
)

DOCUMENTS_NOT_FOUND = "We couldn't find that document."


class LinkNotValidError(NotFoundError):
    code = "LINK_NOT_VALID"


@dataclass(frozen=True)
class Upload:
    """An uploaded file. ``read`` is called only after the cheap checks pass."""

    filename: str
    size: int
    read: Callable[[], bytes]


class DocumentDeps:
    def __init__(
        self,
        projects: ProjectRepository,
        documents: DocumentRepository,
        storage: FileStorage,
        signer: LinkSigner,
        policy: AccessPolicy,
        clock: Clock,
        uow: UnitOfWork,
        limits: UploadLimits,
        new_id: Callable[[], UUID] = uuid4,
    ) -> None:
        self.projects = projects
        self.documents = documents
        self.storage = storage
        self.signer = signer
        self.policy = policy
        self.clock = clock
        self.uow = uow
        self.limits = limits
        self.new_id = new_id

    def ensure_reader(self, actor: Actor, project_id: int) -> None:
        """404 for anyone who may not read, so the refusal reveals nothing."""
        if not self.policy.allows(actor, "read", ResourceRef("project_document", project_id)):
            raise NotFoundError(DOCUMENTS_NOT_FOUND)


class UploadRequirementDocument:
    def __init__(self, deps: DocumentDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, upload: Upload | None) -> DocumentView:
        if actor.account_id is None:
            raise ForbiddenError("Finish setting up your account first.")
        if upload is None:
            raise ValidationError("Choose a file to upload.", {FILE_FIELD: ["Choose a file to upload."]})
        with self._d.uow.atomic():
            record = self._d.projects.get_for_update(project_id)  # serialises the count check
            if record is None:
                raise NotFoundError(PROJECT_NOT_FOUND)
            project = record.project
            if project.owner_account_id != actor.account_id or not project.is_client_project:
                raise ForbiddenError("Only the project's client can upload requirement documents.")
            if project.status is not ProjectStatus.POSTED:
                raise ConflictError(f"This project is {project.status}; documents can no longer be added.")
            ensure_room_for_another(self._d.documents.count_for_project(project_id), self._d.limits)
            ensure_size_allowed(upload.size, self._d.limits)
            content = upload.read()
            ensure_size_allowed(len(content), self._d.limits)  # the declared size can lie
            document_type = detect_type(upload.filename, content)
            document_id = self._d.new_id()
            key = document_id.hex
            self._d.storage.save(key, content)
            try:
                stored = self._d.documents.add(
                    RequirementDocument(
                        id=document_id,
                        project_id=project_id,
                        storage_key=key,
                        filename=clean_filename(upload.filename),
                        type=document_type,
                        size_bytes=len(content),
                        uploaded_by_account_id=actor.account_id,
                    )
                )
            except Exception:
                self._d.storage.delete(key)
                raise
            return DocumentView.of(stored)


class ListRequirementDocuments:
    def __init__(self, deps: DocumentDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> list[DocumentView]:
        self._d.ensure_reader(actor, project_id)
        return [DocumentView.of(document) for document in self._d.documents.for_project(project_id)]


class GetDocumentLink:
    """A download link for one reader, valid for 15 minutes."""

    def __init__(self, deps: DocumentDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, document_id: UUID) -> DocumentLinkView:
        self._d.ensure_reader(actor, project_id)
        if self._d.documents.get(project_id, document_id) is None:
            raise NotFoundError(DOCUMENTS_NOT_FOUND)
        assert actor.account_id is not None  # the access policy refuses anyone without one
        expires_at = self._d.clock.now() + timedelta(seconds=LINK_LIFETIME_SECONDS)
        token = self._d.signer.sign(FileGrant(project_id, document_id, actor.account_id, expires_at))
        return DocumentLinkView(token=token, expires_at=expires_at.isoformat())


class DownloadDocument:
    """The link is the credential (a browser download sends no bearer token),
    so its signature, its expiry and the holder's access are all checked now."""

    def __init__(self, deps: DocumentDeps) -> None:
        self._d = deps

    def execute(self, token: str) -> DocumentDownload:
        try:
            grant = self._d.signer.verify(token)
        except InvalidLinkError:
            raise LinkNotValidError("This download link isn't valid.") from None
        if self._d.clock.now() >= grant.expires_at:
            raise LinkNotValidError("This download link has expired. Get a new one from the project page.")
        holder = Actor(clerk_user_id="", session_id=None, account_id=grant.account_id)
        self._d.ensure_reader(holder, grant.project_id)
        document = self._d.documents.get(grant.project_id, grant.document_id)
        if document is None:
            raise NotFoundError(DOCUMENTS_NOT_FOUND)
        return DocumentDownload(
            filename=document.filename,
            content_type=document.type.content_type,
            content=self._d.storage.read(document.storage_key),
        )
