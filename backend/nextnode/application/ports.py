"""Interfaces the application layer depends on. Infrastructure implements them."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Actor:
    """The authenticated caller, as every use case receives it.

    Application roles (Developer / Client) are added once account profiles
    exist; Team Lead is per project and never stored here.
    """

    clerk_user_id: str
    session_id: str | None


class InvalidTokenError(Exception):
    """The presented credential cannot be trusted. Message is safe to show."""


class TokenVerifier(Protocol):
    @property
    def configured(self) -> bool: ...

    def verify(self, token: str) -> Actor: ...


class DatabaseProbe(Protocol):
    def is_reachable(self) -> bool: ...
