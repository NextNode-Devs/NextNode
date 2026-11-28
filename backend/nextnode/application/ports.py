"""Interfaces the application layer depends on. Infrastructure implements them."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol

from nextnode.domain.accounts import Role


@dataclass(frozen=True)
class Actor:
    """The authenticated caller, as every use case receives it.

    ``account_id`` and ``role`` are ``None`` until the user completes
    onboarding (#1). Team Lead is per project and never stored here.
    """

    clerk_user_id: str
    session_id: str | None
    account_id: int | None = None
    role: Role | None = None


@dataclass(frozen=True)
class VerifiedSession:
    """What a trusted Clerk session token says. ``expires_at`` lets sockets
    demand a fresh token before the old one lapses."""

    clerk_user_id: str
    session_id: str | None
    expires_at: datetime


class InvalidTokenError(Exception):
    """The presented credential cannot be trusted. Message is safe to show."""


class TokenVerifier(Protocol):
    @property
    def configured(self) -> bool: ...

    def verify(self, token: str) -> VerifiedSession: ...


class DatabaseProbe(Protocol):
    def is_reachable(self) -> bool: ...


class NotificationCategory(StrEnum):
    """The groups a person turns on or off in their notification settings (NN-19)."""

    HIRING = "hiring"
    TEAM = "team"
    PROJECTS = "projects"
    PAYMENTS = "payments"
    MESSAGES = "messages"


@dataclass(frozen=True)
class Notification:
    """One notification for one person (A0, #174). ``kind`` names the event
    (``interest_request``, ``handover_offered``, ``feature_change``, …) so the
    bell can choose an icon and wording; ``link`` is an app path such as
    ``/projects/12``, never a full URL."""

    recipient_account_id: int
    category: NotificationCategory
    kind: str
    title: str
    body: str
    link: str | None = None


class NotificationSender(Protocol):
    """Sends notifications. Call it inside the use case's unit of work: the
    real store (A3, #177) saves them with the change and pushes them once it
    commits. Until A3 lands, the container's store does nothing."""

    def send(self, notification: Notification) -> None: ...


class RealtimePublisher(Protocol):
    """Pushes an event to every socket an account has open, on any backend
    process (#1). ``event`` is a JSON-safe frame with a ``type``."""

    def publish_to_account(self, account_id: int, event: dict) -> None: ...
