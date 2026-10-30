"""The authenticated socket at ``/ws/`` (#1), per docs/proposals/realtime-messaging.md.

1. ``Origin`` must be a FRONTEND_ORIGIN (checked in ``config/asgi.py``).
2. The first frame is ``{"type": "auth", "token": "<Clerk session token>"}``,
   within ``AUTH_TIMEOUT`` seconds. Never a token in the URL.
3. Before the token expires the client sends ``{"type": "auth.refresh", ...}``.
4. Every other frame type goes to a handler registered by a later issue,
   after the shared access policy allows it.

Close codes: 4401 not authenticated, 4403 not allowed, 4429 too many frames,
1009 frame too large.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import deque
from datetime import UTC, datetime
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from nextnode.application.access import ResourceRef
from nextnode.application.ports import Actor, InvalidTokenError, VerifiedSession
from nextnode.infrastructure.container import get_container
from nextnode.infrastructure.realtime.publisher import account_group
from nextnode.presentation.realtime.registry import Frame, HandlerContext, HandlerRegistry, registry

logger = logging.getLogger(__name__)

UNAUTHENTICATED = 4401
FORBIDDEN = 4403
RATE_LIMITED = 4429
TOO_LARGE = 1009


class RealtimeConsumer(AsyncWebsocketConsumer):
    AUTH_TIMEOUT = 5.0
    REAUTH_LEEWAY = 5.0
    MAX_FRAME_BYTES = 16 * 1024
    RATE_LIMIT = 20
    RATE_WINDOW = 10.0
    handlers: HandlerRegistry = registry

    actor: Actor | None = None
    session: VerifiedSession | None = None

    async def connect(self) -> None:
        self._recent: deque[float] = deque()
        self._timer: asyncio.Task | None = None
        self._group: str | None = None
        await self.accept()
        query = parse_qs(self.scope.get("query_string", b"").decode("latin-1"))
        if "token" in query:
            await self.close(code=UNAUTHENTICATED)  # tokens in URLs end up in logs
            return
        self._arm(self.AUTH_TIMEOUT)

    async def disconnect(self, code: int) -> None:
        if self._timer:
            self._timer.cancel()
        if self._group:
            await self.channel_layer.group_discard(self._group, self.channel_name)

    async def receive(self, text_data: str | None = None, bytes_data: bytes | None = None) -> None:
        raw = text_data if text_data is not None else (bytes_data or b"").decode("utf-8", "replace")
        if len(raw.encode()) > self.MAX_FRAME_BYTES:
            await self.close(code=TOO_LARGE)
            return
        if self._over_rate_limit():
            await self.close(code=RATE_LIMITED)
            return
        try:
            frame = json.loads(raw)
            frame_type = frame["type"]
        except (ValueError, KeyError, TypeError):
            await self.send_json(
                {"type": "error", "code": "BAD_FRAME", "message": "Frames are JSON with a type."}
            )
            return

        if frame_type in ("auth", "auth.refresh"):
            await self._authenticate(frame, refresh=frame_type == "auth.refresh")
        elif self.actor is None:
            await self.close(code=UNAUTHENTICATED)
        elif frame_type == "ping":
            await self.send_json({"type": "pong"})
        else:
            await self._dispatch(frame_type, frame)

    async def realtime_event(self, event: dict) -> None:
        """Events published to this account's group (see ``ChannelsEventPublisher``)."""
        await self.send_json(event["payload"])

    async def send_json(self, frame: Frame) -> None:
        await self.send(text_data=json.dumps(frame))

    # --- authentication -------------------------------------------------------

    async def _authenticate(self, frame: Frame, *, refresh: bool) -> None:
        if refresh and self.session is None:
            await self.close(code=UNAUTHENTICATED)
            return
        container = get_container()
        try:
            session = await database_sync_to_async(container.token_verifier.verify)(
                str(frame.get("token", ""))
            )
        except InvalidTokenError:
            await self.close(code=UNAUTHENTICATED)
            return
        if refresh and session.clerk_user_id != self.session.clerk_user_id:
            await self.close(code=UNAUTHENTICATED)  # a refresh can't switch users
            return
        actor = await database_sync_to_async(container.resolve_actor.execute)(session)
        if actor.account_id is None:
            await self.close(code=FORBIDDEN)  # finish onboarding first
            return

        self.session, self.actor = session, actor
        if self._group is None:
            self._group = account_group(actor.account_id)
            await self.channel_layer.group_add(self._group, self.channel_name)
        self._arm(max(0.0, session.expires_at.timestamp() - time.time()) + self.REAUTH_LEEWAY)
        await self.send_json(
            {"type": "auth.ok", "expires_at": session.expires_at.astimezone(UTC).isoformat()}
        )

    def _arm(self, seconds: float) -> None:
        """(Re)starts the deadline by which a valid token must arrive."""
        if self._timer:
            self._timer.cancel()
        self._timer = asyncio.ensure_future(self._expire_after(seconds))

    async def _expire_after(self, seconds: float) -> None:
        await asyncio.sleep(seconds)
        logger.info("Socket closed: no valid token by %s", datetime.now(UTC).isoformat())
        await self.close(code=UNAUTHENTICATED)

    def _over_rate_limit(self) -> bool:
        now = time.monotonic()
        while self._recent and now - self._recent[0] > self.RATE_WINDOW:
            self._recent.popleft()
        self._recent.append(now)
        return len(self._recent) > self.RATE_LIMIT

    # --- registered handlers -----------------------------------------------------

    async def _dispatch(self, frame_type: str, frame: Frame) -> None:
        registration = self.handlers.get(frame_type)
        if registration is None:
            await self.send_json(
                {"type": "error", "code": "UNKNOWN_TYPE", "message": f"Unknown frame {frame_type!r}."}
            )
            return
        access = registration.access
        try:
            resource = ResourceRef(access.resource_type, access.resource_id(frame))
        except (KeyError, ValueError, TypeError):
            await self.send_json(
                {"type": "error", "code": "BAD_FRAME", "message": "The frame is missing its id."}
            )
            return
        policy = get_container().access_policy
        allowed = await database_sync_to_async(policy.allows)(self.actor, access.action, resource)
        if not allowed:
            await self.close(code=FORBIDDEN)
            return
        context = HandlerContext(
            actor=self.actor,
            send_json=self.send_json,
            group_add=lambda group: self.channel_layer.group_add(group, self.channel_name),
            group_discard=lambda group: self.channel_layer.group_discard(group, self.channel_name),
        )
        await registration.handler(context, frame)
