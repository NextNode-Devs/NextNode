"""Frame handlers later issues plug into the authenticated socket (#4 first).

Every handler declares the access check that guards it; the consumer runs that
check through the shared ``AccessPolicy`` before the handler sees the frame.
A handler cannot be registered without one, so frames stay deny-by-default.

    register_handler(
        "subscribe",
        subscribe_to_conversation,
        access=Access("conversation", "subscribe", lambda frame: frame["conversation_id"]),
    )
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from nextnode.application.ports import Actor

Frame = dict[str, Any]


@dataclass(frozen=True)
class HandlerContext:
    actor: Actor
    send_json: Callable[[Frame], Awaitable[None]]
    group_add: Callable[[str], Awaitable[None]]
    group_discard: Callable[[str], Awaitable[None]]


Handler = Callable[[HandlerContext, Frame], Awaitable[None]]


@dataclass(frozen=True)
class Access:
    resource_type: str
    action: str
    resource_id: Callable[[Frame], str | int]  # may raise KeyError/ValueError for a bad frame


@dataclass(frozen=True)
class Registration:
    handler: Handler
    access: Access


RESERVED = frozenset({"auth", "auth.refresh", "ping"})


class HandlerRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, Registration] = {}

    def register(self, frame_type: str, handler: Handler, *, access: Access) -> None:
        if frame_type in RESERVED:
            raise ValueError(f"{frame_type!r} is handled by the connection itself.")
        if frame_type in self._handlers:
            raise ValueError(f"A handler for {frame_type!r} is already registered.")
        if not isinstance(access, Access):
            raise TypeError("Every handler needs an Access check; frames are deny-by-default.")
        self._handlers[frame_type] = Registration(handler, access)

    def get(self, frame_type: str) -> Registration | None:
        return self._handlers.get(frame_type)


registry = HandlerRegistry()


def register_handler(frame_type: str, handler: Handler, *, access: Access) -> None:
    registry.register(frame_type, handler, access=access)
