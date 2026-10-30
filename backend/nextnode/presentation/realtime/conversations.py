"""Hiring-conversation frames on #1's authenticated socket.

Client → server::

    {"type": "message.send", "conversation_id": "<uuid>", "client_id": "<any>", "body": "..."}

Server → both participants, only after the message is saved::

    {"type": "message.new", "conversation_id", "message": {...}, "client_id"}
    {"type": "conversation.opened", "conversation": {...}}
    {"type": "conversation.closed", "conversation_id", "reason", "closed_at"}

A refused message answers the sender only:
``{"type": "error", "code", "message", "client_id"}``.

Events reach each participant through their account group (every tab, any
backend process), so there is no separate subscribe step: a socket only ever
receives conversations its account takes part in. The ``post`` access check
runs before the handler; a non-participant's frame closes the socket (4403).
Messages are sent only over the socket; REST loads history.
"""

from __future__ import annotations

import logging
from uuid import UUID

from channels.db import database_sync_to_async

from nextnode.domain.errors import DomainError
from nextnode.infrastructure.container import get_container
from nextnode.presentation.realtime.registry import Access, Frame, HandlerContext, register_handler

logger = logging.getLogger(__name__)


async def send_message(ctx: HandlerContext, frame: Frame) -> None:
    client_id = frame.get("client_id")
    client_id = str(client_id)[:64] if client_id is not None else None
    body = frame.get("body")
    if not isinstance(body, str):
        await ctx.send_json(_error("VALIDATION_ERROR", "Write a message first.", client_id))
        return
    try:
        conversation_id = UUID(str(frame["conversation_id"]))
        await database_sync_to_async(get_container().post_message.execute)(
            ctx.actor, conversation_id, body, client_id
        )
    except DomainError as error:
        await ctx.send_json(_error(error.code, error.message, client_id))
    except Exception:
        logger.exception("message.send failed")
        await ctx.send_json(_error("SERVER_ERROR", "Your message wasn't sent. Try again.", client_id))
    # Success needs no reply here: the sender's sockets get ``message.new``
    # with this client_id once the message is committed.


def _error(code: str, message: str, client_id: str | None) -> Frame:
    return {"type": "error", "code": code, "message": message, "client_id": client_id}


def _conversation_id(frame: Frame) -> str:
    return str(UUID(str(frame["conversation_id"])))


def register() -> None:
    register_handler("message.send", send_message, access=Access("conversation", "post", _conversation_id))
