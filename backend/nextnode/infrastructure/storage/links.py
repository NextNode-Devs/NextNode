"""Signed download links (#3). The token names the document, the reader and
the expiry, signed with ``SECRET_KEY`` so it can't be forged or edited. Expiry
and the reader's access are checked by ``DownloadDocument`` on every use."""

from datetime import UTC, datetime
from uuid import UUID

from django.core import signing

from nextnode.application.projects.ports import FileGrant, InvalidLinkError

_SALT = "nextnode.requirement-document"


class DjangoLinkSigner:
    def sign(self, grant: FileGrant) -> str:
        payload = {
            "p": grant.project_id,
            "d": grant.document_id.hex,
            "a": grant.account_id,
            "e": int(grant.expires_at.timestamp()),
        }
        return signing.dumps(payload, salt=_SALT, compress=True)

    def verify(self, token: str) -> FileGrant:
        try:
            payload = signing.loads(token, salt=_SALT)
            return FileGrant(
                project_id=int(payload["p"]),
                document_id=UUID(hex=payload["d"]),
                account_id=int(payload["a"]),
                expires_at=datetime.fromtimestamp(int(payload["e"]), tz=UTC),
            )
        except (signing.BadSignature, KeyError, TypeError, ValueError):
            raise InvalidLinkError("This download link isn't valid.") from None
