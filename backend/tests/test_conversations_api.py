"""/api/conversations/ end to end: real PostgreSQL, Clerk-shaped tokens signed
locally, conversations opened through the use case the hiring flows call."""

from uuid import UUID, uuid4

import pytest

from nextnode.domain.conversations import Subject, SubjectKind
from nextnode.infrastructure.container import get_container, override_container
from nextnode.infrastructure.persistence.models import AccountModel, ConversationModel
from tests.conversation_fakes import make_account

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def container(verifier):
    with override_container(token_verifier=verifier):
        yield


@pytest.fixture
def people():
    make = make_account
    return {
        "client": make("user_client", "Grace", "client"),
        "dev": make("user_dev", "Ada", "developer"),
        "other": make("user_other", "Linus", "developer"),
    }


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def conversation(people) -> UUID:
    view = get_container().open_conversation.execute(
        Subject(SubjectKind.LEAD_APPLICATION, "app-1"), [people["client"], people["dev"]]
    )
    return UUID(view.id)


def post(conversation_id, actor_sub, body):
    from nextnode.application.ports import Actor

    account = AccountModel.objects.get(clerk_user_id=actor_sub)
    return get_container().post_message.execute(
        Actor(actor_sub, None, account_id=account.id), conversation_id, body
    )


def test_the_list_needs_a_token(api):
    assert api.get("/api/conversations/").status_code == 401


def test_each_participant_lists_it_with_their_own_unread_count(api, auth, conversation):
    post(conversation, "user_dev", "Hi Grace")
    post(conversation, "user_dev", "Any questions?")
    [for_client] = api.get("/api/conversations/", **auth("user_client")).json()["data"]
    [for_dev] = api.get("/api/conversations/", **auth("user_dev")).json()["data"]
    assert for_client["unread_count"] == 2
    assert for_dev["unread_count"] == 0
    assert for_client["last_message"]["body"] == "Any questions?"
    assert [p["display_name"] for p in for_client["participants"]] == ["Grace", "Ada"]
    assert for_client["status"] == "open"


def test_an_outsider_sees_nothing_and_gets_404(api, auth, conversation):
    assert api.get("/api/conversations/", **auth("user_other")).json()["data"] == []
    for path in ("", "messages/"):
        response = api.get(f"/api/conversations/{conversation}/{path}", **auth("user_other"))
        assert response.status_code == 404
        assert response.json()["error"]["message"] == "Conversation not found."
    response = api.post(
        f"/api/conversations/{conversation}/read/", {"message_id": 1}, format="json", **auth("user_other")
    )
    assert response.status_code == 404


def test_an_unknown_id_is_404(api, auth, conversation):
    assert api.get(f"/api/conversations/{uuid4()}/", **auth("user_client")).status_code == 404


def test_history_and_catch_up(api, auth, conversation):
    ids = [post(conversation, "user_dev", str(n)).id for n in range(5)]
    url = f"/api/conversations/{conversation}/messages/"
    latest = api.get(url, {"limit": 2}, **auth("user_client")).json()["data"]
    assert [m["body"] for m in latest] == ["3", "4"]
    older = api.get(url, {"before": ids[3], "limit": 2}, **auth("user_client")).json()["data"]
    assert [m["body"] for m in older] == ["1", "2"]
    newer = api.get(url, {"after": ids[2]}, **auth("user_client")).json()["data"]
    assert [m["body"] for m in newer] == ["3", "4"]


def test_a_bad_page_query_is_400(api, auth, conversation):
    url = f"/api/conversations/{conversation}/messages/"
    assert api.get(url, {"limit": 0}, **auth("user_client")).status_code == 400
    assert api.get(url, {"before": 2, "after": 1}, **auth("user_client")).status_code == 400
    assert api.get(url, {"before": "x"}, **auth("user_client")).status_code == 400


def test_marking_read_clears_the_unread_count(api, auth, conversation):
    last = [post(conversation, "user_dev", t).id for t in ("a", "b")][-1]
    response = api.post(
        f"/api/conversations/{conversation}/read/", {"message_id": last}, format="json", **auth("user_client")
    )
    assert response.status_code == 204
    [row] = api.get("/api/conversations/", **auth("user_client")).json()["data"]
    assert row["unread_count"] == 0


def test_a_closed_conversation_stays_readable_with_its_reason(api, auth, conversation):
    post(conversation, "user_dev", "before")
    get_container().close_conversation.execute(conversation, "The client hired another Team Lead.")
    detail = api.get(f"/api/conversations/{conversation}/", **auth("user_dev")).json()["data"]
    assert (detail["status"], detail["close_reason"]) == ("closed", "The client hired another Team Lead.")
    messages = api.get(f"/api/conversations/{conversation}/messages/", **auth("user_dev")).json()["data"]
    assert [m["body"] for m in messages] == ["before"]
    assert ConversationModel.objects.get().closed_at is not None


def test_opening_the_same_subject_twice_keeps_one_conversation(people, conversation):
    again = get_container().open_conversation.execute(
        Subject(SubjectKind.LEAD_APPLICATION, "app-1"), [people["client"], people["dev"]]
    )
    assert UUID(again.id) == conversation
    assert ConversationModel.objects.count() == 1


def test_team_candidacies_use_the_same_conversations(people):
    candidacy = uuid4()
    port = get_container().candidacy_conversations
    port.open_for_candidacy(candidacy, 1, "user_dev", "user_other")
    port.close_for_candidacy(candidacy, "The team is full.")
    row = ConversationModel.objects.get(subject_id=str(candidacy))
    assert (row.subject_kind, row.status) == ("team_candidacy", "closed")
    assert row.close_reason == "The team is full."
