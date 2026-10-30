"""Every access rule, registered in one place. Add one ``register`` line per
rule when an issue needs it; anything unregistered stays denied."""

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.ports import Actor


def own_account(actor: Actor, resource: ResourceRef) -> bool:
    return str(actor.account_id) == str(resource.id)


def build_access_policy() -> AccessPolicy:
    policy = AccessPolicy()
    policy.register("account", "read", own_account)
    # #3: policy.register("project_document", "read", ...)
    # #4: policy.register("conversation", "subscribe", ...)
    # #5: policy.register("team", "read", ...)
    return policy
