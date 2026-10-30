"""Every access rule, registered in one place. Add one ``register`` line per
rule when an issue needs it; anything unregistered stays denied."""

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.ports import Actor
from nextnode.infrastructure.persistence.conversations import is_participant


def own_account(actor: Actor, resource: ResourceRef) -> bool:
    return str(actor.account_id) == str(resource.id)


def conversation_participant(actor: Actor, resource: ResourceRef) -> bool:
    return is_participant(resource.id, actor.account_id)


def build_access_policy() -> AccessPolicy:
    policy = AccessPolicy()
    policy.register("account", "read", own_account)
    # #3: policy.register("project_document", "read", ...)
    policy.register("conversation", "post", conversation_participant)
    # #5: policy.register("team", "read", ...)
    return policy
