"""Conversation rules and use cases with in-memory fakes: participants only,
closed means read-only, persisted before broadcast, read markers, and #5's
HiringConversations port."""

from uuid import UUID, uuid4

import pytest

from nextnode.application.conversations.candidacies import CandidacyConversations
from nextnode.application.conversations.commands import (
    CloseConversation,
    MarkRead,
    OpenConversation,
    PostMessage,
)
from nextnode.application.conversations.queries import GetConversation, ListConversations, ListMessages
from nextnode.application.ports import Actor
from nextnode.domain.conversations import (
    MESSAGE_MAX,
    Conversation,
    ConversationClosedError,
    Subject,
    SubjectKind,
)
from nextnode.domain.errors import InvalidStateTransitionError, NotFoundError, ValidationError
from tests.conversation_fakes import (
    T0,
    FakeClock,
    FakeConversations,
    FakeEvents,
    FakeMarkers,
    FakeMessages,
    FakeNames,
    FakeUnitOfWork,
    Store,
)

CLIENT, DEV, OTHER = 1, 2, 3
SUBJECT = Subject(SubjectKind.LEAD_APPLICATION, "app-1")


def actor(account_id: int | None) -> Actor:
    return Actor(clerk_user_id=f"user_{account_id}", session_id=None, account_id=account_id)


class UseCases:
    def __init__(self, store: Store) -> None:
        convs, msgs, marks = FakeConversations(store), FakeMessages(store), FakeMarkers(store)
        names, events, uow = FakeNames(store), FakeEvents(store), FakeUnitOfWork()
        self.open = OpenConversation(convs, names, events, uow)
        self.post = PostMessage(convs, msgs, marks, events, uow)
        self.mark_read = MarkRead(convs, msgs, marks)
        self.close = CloseConversation(convs, events, uow, FakeClock(store))
        self.list = ListConversations(convs, names)
        self.get = GetConversation(convs, names)
        self.messages = ListMessages(convs, msgs)
        self.candidacies = CandidacyConversations(self.open, self.close, convs)


@pytest.fixture
def store() -> Store:
    s = Store()
    s.names = {CLIENT: "Grace", DEV: "Ada", OTHER: "Linus"}
    return s


@pytest.fixture
def uc(store) -> UseCases:
    return UseCases(store)


@pytest.fixture
def conv_id(uc) -> UUID:
    return UUID(uc.open.execute(SUBJECT, [CLIENT, DEV]).id)


# --- domain ---------------------------------------------------------------------


def test_a_conversation_needs_at_least_two_different_people():
    with pytest.raises(ValidationError):
        Conversation.start(uuid4(), SUBJECT, [CLIENT, CLIENT])
    # The workspace chat (#6) has the whole team in one conversation.
    team = Subject(SubjectKind.PROJECT_WORKSPACE, "7")
    everyone = Conversation.start(uuid4(), team, [CLIENT, DEV, OTHER, DEV])
    assert everyone.participant_ids == (CLIENT, DEV, OTHER)


def test_closing_twice_is_an_illegal_transition():
    closed = Conversation.start(uuid4(), SUBJECT, [CLIENT, DEV]).close("Hired someone else", T0)
    with pytest.raises(InvalidStateTransitionError):
        closed.close("Again", T0)


def test_a_close_needs_a_reason():
    with pytest.raises(ValidationError):
        Conversation.start(uuid4(), SUBJECT, [CLIENT, DEV]).close("   ", T0)


# --- open -------------------------------------------------------------------------


def test_opening_tells_both_people_live(uc, store):
    view = uc.open.execute(SUBJECT, [CLIENT, DEV])
    assert view.status == "open"
    assert [p.display_name for p in view.participants] == ["Grace", "Ada"]
    (to, frame) = store.published[-1]
    assert to == (CLIENT, DEV)
    assert frame["type"] == "conversation.opened"


def test_one_subject_has_one_conversation(uc, store):
    first = uc.open.execute(SUBJECT, [CLIENT, DEV])
    again = uc.open.execute(SUBJECT, [CLIENT, DEV])
    assert first.id == again.id
    assert len(store.conversations) == 1
    assert len(store.published) == 1


# --- post -------------------------------------------------------------------------


def test_a_participant_posts_and_both_receive_it_with_the_client_id(uc, store, conv_id):
    view = uc.post.execute(actor(DEV), conv_id, "  Hi Grace, I'd love to lead this.  ", client_id="c-1")
    assert view.body == "Hi Grace, I'd love to lead this."
    (to, frame) = store.published[-1]
    assert to == (CLIENT, DEV)
    assert frame["type"] == "message.new"
    assert frame["client_id"] == "c-1"
    assert frame["message"]["id"] == view.id


def test_the_message_is_stored_before_it_is_broadcast(uc, store, conv_id):
    uc.post.execute(actor(DEV), conv_id, "hello")
    stored_id = store.messages[-1].id
    assert store.published[-1][1]["message"]["id"] == stored_id


def test_someone_outside_the_conversation_cannot_post_or_learn_it_exists(uc, store, conv_id):
    with pytest.raises(NotFoundError, match="Conversation not found"):
        uc.post.execute(actor(OTHER), conv_id, "let me in")
    with pytest.raises(NotFoundError):
        uc.post.execute(actor(None), conv_id, "not onboarded")
    assert store.messages == []


def test_an_unknown_conversation_looks_the_same_as_a_foreign_one(uc):
    with pytest.raises(NotFoundError, match="Conversation not found"):
        uc.post.execute(actor(DEV), uuid4(), "hello")


@pytest.mark.parametrize("body", ["", "   ", "x" * (MESSAGE_MAX + 1)])
def test_empty_or_too_long_messages_are_refused(uc, store, conv_id, body):
    with pytest.raises(ValidationError):
        uc.post.execute(actor(DEV), conv_id, body)
    assert store.messages == []


def test_a_message_of_exactly_the_limit_is_accepted(uc, conv_id):
    assert len(uc.post.execute(actor(DEV), conv_id, "x" * MESSAGE_MAX).body) == MESSAGE_MAX


# --- close ------------------------------------------------------------------------


def test_closing_makes_it_read_only_and_both_see_the_reason(uc, store, conv_id):
    uc.post.execute(actor(DEV), conv_id, "before")
    assert uc.close.execute(conv_id, "The client hired another Team Lead.") is True
    (to, frame) = store.published[-1]
    assert to == (CLIENT, DEV)
    assert frame == {
        "type": "conversation.closed",
        "conversation_id": str(conv_id),
        "reason": "The client hired another Team Lead.",
        "closed_at": frame["closed_at"],
    }
    with pytest.raises(ConversationClosedError, match="hired another Team Lead"):
        uc.post.execute(actor(CLIENT), conv_id, "after")
    # Still readable.
    assert [m.body for m in uc.messages.execute(actor(CLIENT), conv_id)] == ["before"]
    assert uc.get.execute(actor(DEV), conv_id).close_reason == "The client hired another Team Lead."


def test_closing_again_changes_nothing(uc, store, conv_id):
    uc.close.execute(conv_id, "First reason")
    published = len(store.published)
    assert uc.close.execute(conv_id, "Second reason") is False
    assert len(store.published) == published
    assert uc.get.execute(actor(DEV), conv_id).close_reason == "First reason"


def test_closing_an_unknown_conversation_is_not_found(uc):
    with pytest.raises(NotFoundError):
        uc.close.execute(uuid4(), "reason")


# --- reading -------------------------------------------------------------------------


def test_list_shows_unread_counts_per_person(uc, conv_id):
    for text in ("one", "two", "three"):
        uc.post.execute(actor(DEV), conv_id, text)
    [for_client] = uc.list.execute(actor(CLIENT))
    [for_dev] = uc.list.execute(actor(DEV))
    assert (for_client.unread_count, for_dev.unread_count) == (3, 0)
    assert for_client.last_message.body == "three"


def test_mark_read_lowers_the_count_and_never_goes_backwards(uc, conv_id):
    ids = [uc.post.execute(actor(DEV), conv_id, t).id for t in ("one", "two", "three")]
    uc.mark_read.execute(actor(CLIENT), conv_id, ids[1])
    assert uc.list.execute(actor(CLIENT))[0].unread_count == 1
    uc.mark_read.execute(actor(CLIENT), conv_id, ids[0])
    assert uc.list.execute(actor(CLIENT))[0].unread_count == 1


def test_mark_read_refuses_a_message_that_is_not_there(uc, conv_id):
    with pytest.raises(ValidationError):
        uc.mark_read.execute(actor(CLIENT), conv_id, 99)


def test_outsiders_see_no_conversations(uc, conv_id):
    assert uc.list.execute(actor(OTHER)) == []
    assert uc.list.execute(actor(None)) == []
    with pytest.raises(NotFoundError):
        uc.get.execute(actor(OTHER), conv_id)
    with pytest.raises(NotFoundError):
        uc.messages.execute(actor(OTHER), conv_id)


def test_history_pages_backwards_and_catch_up_goes_forwards(uc, conv_id):
    ids = [uc.post.execute(actor(DEV), conv_id, str(n)).id for n in range(5)]
    assert [m.body for m in uc.messages.execute(actor(CLIENT), conv_id, limit=2)] == ["3", "4"]
    older = uc.messages.execute(actor(CLIENT), conv_id, before=ids[3], limit=2)
    assert [m.body for m in older] == ["1", "2"]
    newer = uc.messages.execute(actor(CLIENT), conv_id, after=ids[2])
    assert [m.body for m in newer] == ["3", "4"]


def test_before_and_after_together_or_a_bad_limit_are_refused(uc, conv_id):
    with pytest.raises(ValidationError):
        uc.messages.execute(actor(CLIENT), conv_id, before=3, after=1)
    with pytest.raises(ValidationError):
        uc.messages.execute(actor(CLIENT), conv_id, limit=0)


# --- #5's HiringConversations port ---------------------------------------------------


def test_a_team_candidacy_opens_and_closes_its_conversation(uc, store):
    candidacy = uuid4()
    uc.candidacies.open_for_candidacy(candidacy, DEV, OTHER)
    [conversation] = store.conversations.values()
    assert conversation.subject == Subject(SubjectKind.TEAM_CANDIDACY, str(candidacy))
    assert conversation.participant_ids == (DEV, OTHER)

    uc.candidacies.close_for_candidacy(candidacy, "The team is full.")
    assert store.conversations[conversation.id].close_reason == "The team is full."


def test_closing_a_candidacy_without_a_conversation_does_nothing(uc, store):
    uc.candidacies.close_for_candidacy(uuid4(), "The team is full.")
    assert store.published == []
