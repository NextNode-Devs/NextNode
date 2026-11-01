"""Private requirement documents (#3; FR4, NFR2; class diagram ``requirementDocs``).

Only PDF and DOCX, checked by extension **and** by the file's own bytes, so a
renamed file is refused. Size and count limits come from settings (confirmed:
10 MB per file, 10 files per project). Readers are the owning client, the Team
Lead and approved members; never applicants, invitees or lead candidates.
"""

from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from nextnode.domain.errors import ValidationError

FILE_FIELD = "file"
NAME_MAX = 200
LINK_LIFETIME_SECONDS = 15 * 60


class DocumentType(StrEnum):
    PDF = "pdf"
    DOCX = "docx"

    @property
    def content_type(self) -> str:
        if self is DocumentType.PDF:
            return "application/pdf"
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@dataclass(frozen=True)
class UploadLimits:
    max_bytes: int
    max_files_per_project: int


def _refuse(message: str) -> ValidationError:
    return ValidationError(message, {FILE_FIELD: [message]})


def _megabytes(size: int) -> str:
    return f"{size / (1024 * 1024):g} MB"


def _is_docx(content: bytes) -> bool:
    """A valid Office Open XML word-processing package, not just any zip."""
    if not content.startswith(b"PK\x03\x04"):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as package:
            names = set(package.namelist())
    except (zipfile.BadZipFile, ValueError):
        return False
    return "[Content_Types].xml" in names and "word/document.xml" in names


def detect_type(filename: str, content: bytes) -> DocumentType:
    """Raises ``ValidationError`` on the ``file`` field unless both the
    extension and the bytes say PDF, or both say DOCX."""
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ("pdf", "docx"):
        raise _refuse("Upload a PDF or DOCX file.")
    if not content:
        raise _refuse("This file is empty.")
    if extension == "pdf" and content.startswith(b"%PDF-"):
        return DocumentType.PDF
    if extension == "docx" and _is_docx(content):
        return DocumentType.DOCX
    raise _refuse(f"This file isn't a real {extension.upper()} file. Upload a PDF or DOCX file.")


def clean_filename(filename: str) -> str:
    """Kept for display only; storage uses a generated key."""
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(ch for ch in name if ch.isprintable() and ch not in '"<>|:*?').strip()
    if len(name) > NAME_MAX:
        stem, _, extension = name.rpartition(".")
        name = f"{stem[: NAME_MAX - len(extension) - 1]}.{extension}"
    return name or "document"


def ensure_size_allowed(size: int, limits: UploadLimits) -> None:
    if size > limits.max_bytes:
        raise _refuse(f"Files can be at most {_megabytes(limits.max_bytes)}; this one is {_megabytes(size)}.")


def ensure_room_for_another(existing_count: int, limits: UploadLimits) -> None:
    if existing_count >= limits.max_files_per_project:
        raise _refuse(
            f"A project can have at most {limits.max_files_per_project} documents, and this one already does."
        )


@dataclass(frozen=True)
class RequirementDocument:
    id: UUID
    project_id: int
    storage_key: str  # generated; never derived from the uploaded name
    filename: str  # display only
    type: DocumentType
    size_bytes: int
    uploaded_by_account_id: int
    uploaded_at: datetime | None = None
