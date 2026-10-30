"""Conversation events go to each participant's account group (#1), so every
tab they have open receives them, on any backend process. Sent only once the
surrounding transaction commits: a message is never broadcast unless saved."""

from __future__ import annotations

import logging

from django.db import transaction

from nextnode.application.ports import RealtimePublisher

logger = logging.getLogger(__name__)


class OnCommitConversationEvents:
    def __init__(self, publisher: RealtimePublisher) -> None:
        self._publisher = publisher

    def publish(self, account_ids: tuple[int, ...], event: dict) -> None:
        def send() -> None:
            for account_id in account_ids:
                try:
                    self._publisher.publish_to_account(account_id, event)
                except Exception:  # the data is saved; a live push failing must not undo it
                    logger.exception("Could not push %s to account %s", event.get("type"), account_id)

        transaction.on_commit(send)
