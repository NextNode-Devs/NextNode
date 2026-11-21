"""The "New talent" tag (rule of 21 Nov 2026, recorded with NN-39): a developer
whose account was created within the past ``NEW_TALENT_DAYS`` days. It is
worked out from the account's creation time on every read, never stored, so it
expires by itself."""

from __future__ import annotations

from datetime import datetime, timedelta

NEW_TALENT_DAYS = 15


def is_new_talent(joined_at: datetime | None, now: datetime) -> bool:
    """True from the moment the account is created until ``NEW_TALENT_DAYS`` later."""
    return joined_at is not None and timedelta(0) <= now - joined_at <= timedelta(days=NEW_TALENT_DAYS)
