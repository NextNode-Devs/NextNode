from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from nextnode.application.ports import Actor, InvalidTokenError
from nextnode.infrastructure.container import get_container


class ApiUser:
    """DRF's view of the caller. Views pass ``request.user.actor`` to use cases."""

    is_authenticated = True

    def __init__(self, actor: Actor) -> None:
        self.actor = actor


class ClerkBearerAuthentication(BaseAuthentication):
    """`Authorization: Bearer <Clerk session token>`. No cookies are consulted."""

    keyword = b"bearer"

    def authenticate(self, request: Request) -> tuple[ApiUser, None] | None:
        parts = get_authorization_header(request).split()
        if not parts or parts[0].lower() != self.keyword:
            return None
        if len(parts) != 2:
            raise AuthenticationFailed("The Authorization header must be 'Bearer <token>'.")
        try:
            actor = get_container().token_verifier.verify(parts[1].decode("ascii"))
        except (InvalidTokenError, UnicodeDecodeError) as error:
            raise AuthenticationFailed(str(error) or "The session token is invalid.") from None
        return ApiUser(actor), None

    def authenticate_header(self, request: Request) -> str:
        return 'Bearer realm="api"'
