"""Live hiring conversations over the real socket stack: message.send is saved,
then reaches both people; outsiders are cut off; closed conversations refuse
messages; a close reaches both people live. Real PostgreSQL, in-memory channel
layer."""

from uuid import UUID

import pytest
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.security.websocket import OriginValidator
from channels.testing import WebsocketCommunicator
from django.db import connections

from nextnode.domain.conversations import Subject, SubjectKind
from nextnode.infrastructure.container import get_container, override_container
from nextnode.infrastructure.persistence.models import MessageModel
from nextnode.presentation.realtime.routing import websocket_urlpatterns
from tests.conftest import FRONTEND
from tests.conversation_fakes import make_account

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture(autouse=True)
async def close_socket_thread_connections():
    """Channels runs ORM calls on a shared worker thread; close its connection
    so later tests without database access don't trip over it."""
    yield
    await database_sync_to_async(connections.close_all)()


@pytest.fixture
def conversation_id(db) -> UUID:
    ids = [
        make_account(sub, name, role)
        for sub, role, name in (
            ("user_client", "client", "Grace"),
            ("user_dev", "developer", "Ada"),
            ("user_other", "developer", "Linus"),
        )
    ]
    view = get_container().open_conversation.execute(Subject(SubjectKind.LEAD_APPLICATION, "a-1"), ids[:2])
    return UUID(view.id)


async def connect(make_token, sub):
    app = OriginValidator(URLRouter(websocket_urlpatterns), [FRONTEND])
    socket = WebsocketCommunicator(app, "/ws/", headers=[(b"origin", FRONTEND.encode())])
    connected, _ = await socket.connect()
    assert connected
    await socket.send_json_to({"type": "auth", "token": make_token(sub=sub)})
    assert (await socket.receive_json_from(timeout=3))["type"] == "auth.ok"
    return socket


async def next_of(socket, frame_type):
    while True:
        frame = await socket.receive_json_from(timeout=3)
        if frame["type"] == frame_type:
            return frame


async def test_a_message_is_saved_then_delivered_to_both_people(make_token, conversation_id):
    client = await connect(make_token, "user_client")
    dev = await connect(make_token, "user_dev")
    await dev.send_json_to(
        {"type": "message.send", "conversation_id": str(conversation_id), "client_id": "c-1", "body": "Hi!"}
    )
    to_client = await next_of(client, "message.new")
    to_sender = await next_of(dev, "message.new")
    assert to_client["message"]["body"] == "Hi!"
    assert to_sender["client_id"] == "c-1"
    saved = await database_sync_to_async(MessageModel.objects.get)()
    assert to_client["message"]["id"] == saved.id
    await client.disconnect()
    await dev.disconnect()


async def test_an_outsider_sending_into_it_is_disconnected(make_token, conversation_id):
    other = await connect(make_token, "user_other")
    await other.send_json_to(
        {"type": "message.send", "conversation_id": str(conversation_id), "client_id": "x", "body": "hi"}
    )
    output = await other.receive_output(timeout=3)
    assert output == {"type": "websocket.close", "code": 4403}
    assert await database_sync_to_async(MessageModel.objects.count)() == 0


async def test_an_empty_message_gets_an_error_for_the_sender_only(make_token, conversation_id):
    dev = await connect(make_token, "user_dev")
    await dev.send_json_to(
        {"type": "message.send", "conversation_id": str(conversation_id), "client_id": "c-2", "body": "  "}
    )
    error = await next_of(dev, "error")
    assert (error["code"], error["client_id"]) == ("VALIDATION_ERROR", "c-2")
    await dev.disconnect()


async def test_a_bad_conversation_id_is_a_bad_frame(make_token, conversation_id):
    dev = await connect(make_token, "user_dev")
    await dev.send_json_to({"type": "message.send", "conversation_id": "nope", "body": "hi"})
    assert (await next_of(dev, "error"))["code"] == "BAD_FRAME"
    await dev.disconnect()


async def test_closing_reaches_both_people_and_then_messages_are_refused(make_token, conversation_id):
    client = await connect(make_token, "user_client")
    dev = await connect(make_token, "user_dev")
    await database_sync_to_async(get_container().close_conversation.execute)(
        conversation_id, "The client hired another Team Lead."
    )
    for socket in (client, dev):
        closed = await next_of(socket, "conversation.closed")
        assert closed["reason"] == "The client hired another Team Lead."
    await dev.send_json_to(
        {"type": "message.send", "conversation_id": str(conversation_id), "client_id": "c-3", "body": "wait"}
    )
    error = await next_of(dev, "error")
    assert error["code"] == "CONVERSATION_CLOSED"
    assert "hired another Team Lead" in error["message"]
    await client.disconnect()
    await dev.disconnect()
