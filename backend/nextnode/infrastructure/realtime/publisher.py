"""Channels adapter for ``RealtimePublisher``. Through the Redis channel layer
an event published by one backend process reaches sockets held by another."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def account_group(account_id: int) -> str:
    return f"account.{account_id}"


class ChannelsEventPublisher:
    def publish_to_account(self, account_id: int, event: dict) -> None:
        if "type" not in event:
            raise ValueError("A realtime event needs a type.")
        layer = get_channel_layer()
        async_to_sync(layer.group_send)(
            account_group(account_id), {"type": "realtime.event", "payload": event}
        )
