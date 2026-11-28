"""Account status (A0, #174; stakeholder Q6, Phase 3 decisions of 28 Nov 2026).

``paused`` and ``deleted`` accounts are left out of every listing other people
browse: the developer directory, the open-projects feed and suggestions.
Pausing, resuming and deleting are NN-48 (#191); this module only fixes the
states and the visibility rule, so every other slice can build on them now.
A deleted account's kept records (messages, payments, offers, agreements)
name the person ``DELETED_ACCOUNT_NAME``.
"""

from __future__ import annotations

from enum import StrEnum

DELETED_ACCOUNT_NAME = "NextNode User"


class AccountStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    DELETED = "deleted"


def is_visible(status: AccountStatus) -> bool:
    """Whether other people may find this account in a listing."""
    return status is AccountStatus.ACTIVE
