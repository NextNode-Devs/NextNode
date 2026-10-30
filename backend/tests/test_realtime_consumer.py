"""The authenticated socket: Origin, first-frame token, re-auth, limits and
deny-by-default handlers. In-memory channel layer and fake accounts: no Redis,
no database."""

import asyncio
import time

import pytest
from channels.routing import URLRouter
from channels.security.websocket import OriginValidator
from channels.testing import WebsocketCommunicator
from django.urls import path

from nextnode.domain.accounts import Account, ClientProfile, Role
from nextnode.infrastructure.access_rules import build_access_policy
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.realtime.publisher import ChannelsEventPublisher
from nextnode.presentation.realtime.consumer import RealtimeConsumer
from nextnode.presentation.realtime.registry import Access, HandlerRegistry
from tests.account_fakes import InMemoryAccounts
from tests.conftest import FRONTEND


class FastConsumer(RealtimeConsumer):
    AUTH_TIMEOUT = 0.2
    REAUTH_LEEWAY = 0.0
    RATE_LIMIT = 5
    handlers = HandlerRegistry()


async def echo(ctx, frame):
    await ctx.send_json({"type": "echo", "account_id": ctx.actor.account_id})


FastConsumer.handlers.register(
    "echo.account", echo, access=Access("account", "read", lambda f: f["account_id"])
)
FastConsumer.handlers.register("echo.note", echo, access=Access("note", "read", lambda f: f["note_id"]))


@pytest.fixture
def accounts():
    fake = InMemoryAccounts()
    fake.add(Account.onboard("user_123", Role.CLIENT, "Grace", ClientProfile("Acme", "Retail")))
    return fake


@pytest.fixture(autouse=True)
def container(verifier, accounts):
    with override_container(token_verifier=verifier, accounts=accounts, access_policy=build_access_policy()):
        yield


def connect(origin: str = FRONTEND, query: str = ""):
    app = OriginValidator(URLRouter([path("ws/", FastConsumer.as_asgi())]), [FRONTEND])
    url = f"/ws/{'?' + query if query else ''}"
    return WebsocketCommunicator(app, url, headers=[(b"origin", origin.encode())])


async def expect_close(communicator, code: int):
    output = await communicator.receive_output(timeout=2)
    while output["type"] != "websocket.close":
        output = await communicator.receive_output(timeout=2)
    assert output.get("code") == code


async def authed(make_token, **claims):
    communicator = connect()
    connected, _ = await communicator.connect()
    assert connected
    await communicator.send_json_to({"type": "auth", "token": make_token(**claims)})
    reply = await communicator.receive_json_from(timeout=2)
    assert reply["type"] == "auth.ok"
    return communicator


async def test_a_foreign_origin_is_refused_at_the_handshake():
    connected, _ = await connect(origin="https://evil.example").connect()
    assert not connected


async def test_a_valid_first_frame_authenticates(make_token):
    communicator = await authed(make_token)
    await communicator.send_json_to({"type": "ping"})
    assert await communicator.receive_json_from() == {"type": "pong"}
    await communicator.disconnect()


@pytest.mark.parametrize(
    "claims",
    [
        {"exp": int(time.time()) - 60},
        {"iss": "https://someone-else.clerk.accounts.dev"},
        {"azp": "https://x.y"},
    ],
)
async def test_expired_or_foreign_tokens_close_4401(make_token, claims):
    communicator = connect()
    await communicator.connect()
    await communicator.send_json_to({"type": "auth", "token": make_token(**claims)})
    await expect_close(communicator, 4401)


async def test_a_token_in_the_url_is_refused(make_token):
    communicator = connect(query=f"token={make_token()}")
    await communicator.connect()
    await expect_close(communicator, 4401)


async def test_no_token_within_the_deadline_closes_4401():
    communicator = connect()
    await communicator.connect()
    await expect_close(communicator, 4401)


async def test_frames_before_auth_close_4401():
    communicator = connect()
    await communicator.connect()
    await communicator.send_json_to({"type": "ping"})
    await expect_close(communicator, 4401)


async def test_a_user_who_has_not_onboarded_is_refused_4403(make_token):
    communicator = connect()
    await communicator.connect()
    await communicator.send_json_to({"type": "auth", "token": make_token(sub="user_new")})
    await expect_close(communicator, 4403)


async def test_refreshing_before_expiry_keeps_the_socket_open(make_token):
    # +2, not +1: int() truncates, so +1 can expire before the refresh is verified.
    first_exp = int(time.time()) + 2
    communicator = await authed(make_token, exp=first_exp)
    await communicator.send_json_to({"type": "auth.refresh", "token": make_token(exp=int(time.time()) + 60)})
    assert (await communicator.receive_json_from(timeout=2))["type"] == "auth.ok"
    await asyncio.sleep(first_exp - time.time() + 0.5)  # past the first token's expiry
    await communicator.send_json_to({"type": "ping"})
    assert await communicator.receive_json_from(timeout=2) == {"type": "pong"}
    await communicator.disconnect()


async def test_a_missed_refresh_closes_4401(make_token):
    communicator = await authed(make_token, exp=int(time.time()) + 1)
    await expect_close(communicator, 4401)


async def test_a_refresh_cannot_switch_users(make_token):
    communicator = await authed(make_token)
    await communicator.send_json_to({"type": "auth.refresh", "token": make_token(sub="user_456")})
    await expect_close(communicator, 4401)


async def test_an_oversized_frame_closes_1009(make_token):
    communicator = await authed(make_token)
    await communicator.send_to(text_data="x" * (17 * 1024))
    await expect_close(communicator, 1009)


async def test_too_many_frames_close_4429(make_token):
    communicator = await authed(make_token)
    for _ in range(FastConsumer.RATE_LIMIT):
        await communicator.send_json_to({"type": "ping"})
    await expect_close(communicator, 4429)


async def test_unknown_frame_types_get_an_error_frame(make_token):
    communicator = await authed(make_token)
    await communicator.send_json_to({"type": "nope"})
    assert (await communicator.receive_json_from())["code"] == "UNKNOWN_TYPE"
    await communicator.disconnect()


async def test_the_shared_policy_guards_registered_handlers(make_token):
    communicator = await authed(make_token)
    await communicator.send_json_to({"type": "echo.account", "account_id": 1})  # own account: allowed
    assert await communicator.receive_json_from() == {"type": "echo", "account_id": 1}
    await communicator.send_json_to({"type": "echo.account", "account_id": 2})  # someone else's
    await expect_close(communicator, 4403)


async def test_a_resource_with_no_registered_rule_is_refused_4403(make_token):
    communicator = await authed(make_token)
    await communicator.send_json_to({"type": "echo.note", "note_id": 1})
    await expect_close(communicator, 4403)


def test_handlers_cannot_be_registered_without_an_access_check():
    registry = HandlerRegistry()
    with pytest.raises(TypeError):
        registry.register("x", echo, access=None)  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="connection itself"):
        registry.register("auth", echo, access=Access("a", "b", lambda f: 1))


async def test_published_events_reach_the_accounts_sockets(make_token):
    communicator = await authed(make_token)
    from asgiref.sync import sync_to_async

    await sync_to_async(ChannelsEventPublisher().publish_to_account)(1, {"type": "realtime.test"})
    assert await communicator.receive_json_from(timeout=2) == {"type": "realtime.test"}
    await communicator.disconnect()
