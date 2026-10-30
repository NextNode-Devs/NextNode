"""Acceptance criterion 9: an event published by one backend process reaches a
socket held by another. Two separate Redis channel-layer instances stand in for
the two processes. Needs Redis at REDIS_URL (docker compose / CI); skipped
when it isn't reachable."""

import socket
from urllib.parse import urlsplit

import pytest
from channels_redis.core import RedisChannelLayer
from django.conf import settings

pytestmark = pytest.mark.redis


def redis_reachable() -> bool:
    parts = urlsplit(settings.ENV.redis_url)
    try:
        with socket.create_connection((parts.hostname, parts.port or 6379), timeout=0.5):
            return True
    except OSError:
        return False


@pytest.mark.skipif(not redis_reachable(), reason="Redis is not running at REDIS_URL")
async def test_an_event_crosses_processes_through_redis():
    process_a = RedisChannelLayer(hosts=[settings.ENV.redis_url])
    process_b = RedisChannelLayer(hosts=[settings.ENV.redis_url])
    channel = await process_b.new_channel()
    await process_b.group_add("account.42", channel)
    try:
        await process_a.group_send(
            "account.42", {"type": "realtime.event", "payload": {"type": "realtime.test"}}
        )
        message = await process_b.receive(channel)
        assert message["payload"] == {"type": "realtime.test"}
    finally:
        await process_b.group_discard("account.42", channel)
        await process_a.flush()
