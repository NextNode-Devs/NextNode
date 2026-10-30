"""The shared access policy: deny by default, explicit rules, one policy for
REST and sockets (the socket side is in test_realtime_consumer.py)."""

import pytest

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.accounts.queries import GetAccount
from nextnode.application.ports import Actor
from nextnode.domain.accounts import ClientProfile, Role
from nextnode.domain.errors import ForbiddenError
from nextnode.infrastructure.access_rules import build_access_policy
from tests.account_fakes import InMemoryAccounts

ONBOARDED = Actor("user_1", "sess_1", account_id=1, role=Role.CLIENT)
NOT_ONBOARDED = Actor("user_2", "sess_2")


def test_a_resource_with_no_rule_is_refused():
    with pytest.raises(ForbiddenError, match="don't have access"):
        AccessPolicy().check(ONBOARDED, "read", ResourceRef("project_document", 7))


def test_a_registered_rule_decides_and_other_actions_stay_denied():
    policy = AccessPolicy()
    policy.register("note", "read", lambda actor, ref: ref.id == 7)
    assert policy.allows(ONBOARDED, "read", ResourceRef("note", 7))
    assert not policy.allows(ONBOARDED, "read", ResourceRef("note", 8))
    assert not policy.allows(ONBOARDED, "delete", ResourceRef("note", 7))


def test_an_actor_without_an_account_is_always_refused():
    policy = AccessPolicy()
    policy.register("note", "read", lambda actor, ref: True)
    assert not policy.allows(NOT_ONBOARDED, "read", ResourceRef("note", 1))


def test_a_rule_cannot_be_registered_twice():
    policy = AccessPolicy()
    policy.register("note", "read", lambda actor, ref: True)
    with pytest.raises(ValueError, match="already registered"):
        policy.register("note", "read", lambda actor, ref: False)


def test_the_built_policy_lets_you_read_only_your_own_account():
    policy = build_access_policy()
    assert policy.allows(ONBOARDED, "read", ResourceRef("account", 1))
    assert not policy.allows(ONBOARDED, "read", ResourceRef("account", 2))


def test_get_account_goes_through_the_policy():
    from nextnode.domain.accounts import Account

    accounts = InMemoryAccounts()
    accounts.add(Account.onboard("user_1", Role.CLIENT, "Grace", ClientProfile("Acme", "Retail")))
    use_case = GetAccount(accounts, build_access_policy())
    assert use_case.execute(ONBOARDED, 1).display_name == "Grace"
    with pytest.raises(ForbiddenError):
        use_case.execute(ONBOARDED, 2)
    with pytest.raises(ForbiddenError):
        use_case.execute(NOT_ONBOARDED, 1)
