"""Certificates on a developer's portfolio (NN-34, #102; decision of 21 Nov 2026).

Import from this module, not from ``nextnode.domain.accounts``: it uses the
upload rules in ``domain.projects``, which itself imports ``domain.accounts``.

PDF only, checked by the extension **and** by the file's own bytes, so a
renamed file is refused. At most ``MAX_CERTIFICATES`` per developer; the size
limit is the same as for requirement documents (``UploadLimits.max_bytes``).
Certificates are shown "as provided": NextNode never says one is verified.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from nextnode.domain.errors import ValidationError
from nextnode.domain.projects.documents import FILE_FIELD, UploadLimits, clean_filename

__all__ = ["clean_filename"]  # re-exported: certificates keep the same display-name rule

MAX_CERTIFICATES = 10
CONTENT_TYPE = "application/pdf"


def _refuse(message: str) -> ValidationError:
    return ValidationError(message, {FILE_FIELD: [message]})


def ensure_pdf(filename: str, content: bytes) -> None:
    if not filename.lower().endswith(".pdf"):
        raise _refuse("Upload a PDF file. Certificates can only be PDFs.")
    if not content:
        raise _refuse("This file is empty.")
    if not content.startswith(b"%PDF-"):
        raise _refuse("This file isn't a real PDF. Upload a PDF file.")


def ensure_room_for_another(existing_count: int) -> None:
    if existing_count >= MAX_CERTIFICATES:
        raise _refuse(f"You can have at most {MAX_CERTIFICATES} certificates. Remove one to add another.")


def ensure_size_allowed(size: int, limits: UploadLimits) -> None:
    if size > limits.max_bytes:
        megabytes = limits.max_bytes / (1024 * 1024)
        raise _refuse(
            f"Certificates can be at most {megabytes:g} MB; this one is {size / (1024 * 1024):.1f} MB."
        )


@dataclass(frozen=True)
class Certificate:
    id: UUID
    account_id: int  # the developer it belongs to
    storage_key: str  # generated; never derived from the uploaded name
    filename: str  # display only
    size_bytes: int
    uploaded_at: datetime | None = None
