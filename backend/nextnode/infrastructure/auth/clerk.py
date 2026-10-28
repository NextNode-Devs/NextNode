"""Clerk session-token verification (networkless after the JWKS is cached).

Checks, per Clerk's manual JWT verification guidance: RS256 signature against
the instance JWKS, `exp`/`nbf` (5 s leeway), `iss` equals the instance's
Frontend API URL, `azp` (when present) is an allowed frontend origin, and a
session that is not active (`sts` other than "active") is refused.
Tokens are never logged.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

import jwt

from nextnode.application.ports import Actor, InvalidTokenError

logger = logging.getLogger(__name__)

KeyResolver = Callable[[str], Any]
LEEWAY_SECONDS = 5


class ClerkTokenVerifier:
    configured = True

    def __init__(
        self,
        issuer: str,
        authorized_parties: tuple[str, ...],
        jwks_url: str | None = None,
        key_resolver: KeyResolver | None = None,
    ) -> None:
        if key_resolver is None:
            if not jwks_url:
                raise ValueError("jwks_url or key_resolver is required")
            client = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600, timeout=5)
            key_resolver = lambda token: client.get_signing_key_from_jwt(token).key  # noqa: E731
        self._issuer = issuer
        self._authorized_parties = frozenset(authorized_parties)
        self._resolve_key = key_resolver

    def verify(self, token: str) -> Actor:
        try:
            key = self._resolve_key(token)
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=self._issuer,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "iss", "sub"], "verify_aud": False},
            )
        except jwt.PyJWKClientError:
            logger.warning("Could not fetch Clerk signing keys")
            raise InvalidTokenError("Sign-in could not be verified right now. Try again shortly.") from None
        except jwt.ExpiredSignatureError:
            raise InvalidTokenError("Your session has expired. Sign in again.") from None
        except jwt.InvalidTokenError:
            raise InvalidTokenError("The session token is invalid.") from None

        azp = claims.get("azp")
        if azp is not None and azp not in self._authorized_parties:
            raise InvalidTokenError("The session token was issued for a different site.")

        status = claims.get("sts")
        if status is not None and status != "active":
            raise InvalidTokenError("Your session is not active. Finish signing in first.")

        return Actor(clerk_user_id=str(claims["sub"]), session_id=claims.get("sid"))


class UnconfiguredTokenVerifier:
    """Used when CLERK_ISSUER is unset (development only): refuses every token."""

    configured = False

    def verify(self, token: str) -> Actor:
        raise InvalidTokenError("Authentication is not configured on this server.")
