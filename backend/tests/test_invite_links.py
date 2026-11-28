"""A4 (#178): time-limited team invitation links. The link's rules without a
database, then the API with real PostgreSQL and a clock the tests move."""

from datetime import UTC, datetime, timedelta

import pytest

from nextnode.application.ports import Notification
from nextnode.domain.errors import ValidationError
from nextnode.domain.teams.invite_link import InviteLink, InviteLinkStatus, InviteLinkUnusableError
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.persistence.invite_link_models import InviteLinkModel
from nextnode.infrastructure.persistence.models import TeamMembershipModel
from tests.conversation_fakes import make_account
from tests.test_start_gate_api import make_project

T0 = datetime(2026, 12, 1, 12, 0, tzinfo=UTC)

# --- the link (no database) ---------------------------------------------------------------------


def link(hours=24) -> InviteLink:
    return InviteLink.create(1, "tok", 7, hours, T0)


@pytest.mark.parametrize("hours", [24, 72, 168])
def test_a_link_lasts_24_hours_3_days_or_7_days(hours):
    made = link(hours)
    assert made.expires_at == T0 + timedelta(hours=hours)
    assert made.status(T0) is InviteLinkStatus.ACTIVE


@pytest.mark.parametrize("hours", [0, 1, 48, 720])
def test_no_other_lifetime_is_allowed(hours):
    with pytest.raises(ValidationError) as caught:
        link(hours)
    assert list(caught.value.fields) == ["expires_in_hours"]


def test_status_follows_the_clock_use_and_revoke():
    made = link()
    assert made.status(T0 + timedelta(hours=23, minutes=59)) is InviteLinkStatus.ACTIVE
    assert made.status(T0 + timedelta(hours=24)) is InviteLinkStatus.EXPIRED
    assert made.use(9, T0).status(T0) is InviteLinkStatus.USED
    assert made.revoke(T0).status(T0) is InviteLinkStatus.REVOKED
    used = made.use(9, T0)
    assert used.revoke(T0) == used  # a used link stays used


@pytest.mark.parametrize(
    ("later", "words"),
    [
        (lambda m: m, "has expired"),
        (lambda m: m.use(9, T0), "already been used"),
        (lambda m: m.revoke(T0), "turned off"),
    ],
)
def test_only_an_active_link_can_be_used(later, words):
    made = later(link())
    with pytest.raises(InviteLinkUnusableError, match=words):
        made.use(10, T0 + timedelta(days=2))


# --- end to end --------------------------------------------------------------------------------


class Clock:
    def __init__(self) -> None:
        self.at = T0

    def now(self) -> datetime:
        return self.at


class Recorder:
    def __init__(self) -> None:
        self.sent: list[Notification] = []

    def send(self, notification: Notification) -> None:
        self.sent.append(notification)


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def notes() -> Recorder:
    return Recorder()


@pytest.fixture
def auth(make_token, verifier, clock, notes):
    with override_container(token_verifier=verifier, clock=clock, notifications=notes):
        yield lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def people(db):
    ids = {
        "client": make_account("user_client", "Grace", "client"),
        "lead": make_account("user_lead", "Ada", "developer"),
        "joiner": make_account("user_joiner", "Linus", "developer"),
        "second": make_account("user_second", "Margaret", "developer"),
    }
    for n in range(4):
        ids[f"dev{n}"] = make_account(f"user_dev{n}", f"Dev {n}", "developer")
    return ids


@pytest.fixture
def project(people) -> int:
    return make_project(people, members=2)  # size 5: the Lead, 2 members, 2 open spots


def make_link(api, auth, project, hours=None, sub="user_lead"):
    body = {} if hours is None else {"expires_in_hours": hours}
    return api.post(f"/api/projects/{project}/invite-links/", body, format="json", **auth(sub))


def accept(api, auth, token, sub="user_joiner"):
    return api.post(f"/api/invite-links/{token}/accept/", **auth(sub))


def members(project) -> set[int]:
    return set(
        TeamMembershipModel.objects.filter(team__project_id=project, status="approved").values_list(
            "account_id", flat=True
        )
    )


@pytest.mark.django_db
def test_the_lead_makes_a_link_and_a_developer_joins_with_it_once(api, auth, project, people, notes):
    made = make_link(api, auth, project)
    assert made.status_code == 201, made.json()
    newest = made.json()["data"][0]
    assert (newest["status"], newest["expires_at"]) == ("active", (T0 + timedelta(hours=72)).isoformat())
    token = newest["token"]
    assert len(token) >= 43

    # Anyone signed in reads its state; the joiner joins.
    assert api.get(f"/api/invite-links/{token}/", **auth("user_client")).json()["data"]["status"] == "active"
    joined = accept(api, auth, token)
    assert joined.status_code == 200, joined.json()
    assert joined.json()["data"] == {"project_id": project, "joined": True}
    assert people["joiner"] in members(project)

    shown = api.get(f"/api/invite-links/{token}/", **auth("user_lead")).json()["data"]
    assert (shown["status"], shown["used_by_name"], shown["used_at"]) == ("used", "Linus", T0.isoformat())
    assert [(n.recipient_account_id, n.kind) for n in notes.sent] == [(people["lead"], "invite_link_used")]

    # Single use: the next developer is refused and stays out.
    again = accept(api, auth, token, "user_second")
    assert again.status_code == 409 and "already been used" in again.json()["error"]["message"]
    assert people["second"] not in members(project)


@pytest.mark.django_db
def test_a_link_expires_on_the_servers_clock(api, auth, project, clock, people):
    token = make_link(api, auth, project, 24).json()["data"][0]["token"]
    clock.at = T0 + timedelta(hours=24)
    assert api.get(f"/api/invite-links/{token}/", **auth("user_joiner")).json()["data"]["status"] == "expired"
    refused = accept(api, auth, token)
    assert refused.status_code == 409 and "expired" in refused.json()["error"]["message"]
    assert people["joiner"] not in members(project)


@pytest.mark.django_db
def test_a_new_link_or_revoke_stops_the_old_one(api, auth, project):
    first = make_link(api, auth, project).json()["data"][0]["token"]
    links = make_link(api, auth, project, 168).json()["data"]
    assert [(x["status"], x["token"] == first) for x in links] == [("active", False), ("revoked", True)]
    assert accept(api, auth, first).status_code == 409
    revoked = api.post(f"/api/projects/{project}/invite-links/revoke/", **auth("user_lead")).json()["data"]
    assert {x["status"] for x in revoked} == {"revoked"}
    assert accept(api, auth, links[0]["token"]).status_code == 409
    assert InviteLinkModel.objects.filter(project_id=project, used_at=None, revoked_at=None).count() == 0


@pytest.mark.django_db
def test_only_the_lead_makes_lists_and_revokes_links(api, auth, project):
    for sub in ("user_dev0", "user_client", "user_joiner"):
        assert make_link(api, auth, project, sub=sub).status_code == 403
        assert api.get(f"/api/projects/{project}/invite-links/", **auth(sub)).status_code == 403
        assert api.post(f"/api/projects/{project}/invite-links/revoke/", **auth(sub)).status_code == 403
    assert make_link(api, auth, project, 48).status_code == 400
    assert api.get(f"/api/projects/{project}/invite-links/", **auth("user_lead")).json()["data"] == []


@pytest.mark.django_db
def test_who_cannot_join_with_a_link(api, auth, project):
    token = make_link(api, auth, project).json()["data"][0]["token"]
    assert accept(api, auth, token, "user_client").status_code == 403  # clients don't join teams
    assert accept(api, auth, token, "user_lead").status_code == 409  # already the Lead
    assert accept(api, auth, token, "user_dev0").status_code == 409  # already a member
    assert accept(api, auth, "not-a-real-token").status_code == 404
    assert api.get("/api/invite-links/not-a-real-token/", **auth("user_joiner")).status_code == 404
    assert api.get(f"/api/invite-links/{token}/").status_code == 401
    # Nothing above used the link.
    assert api.get(f"/api/invite-links/{token}/", **auth("user_joiner")).json()["data"]["status"] == "active"


@pytest.mark.django_db
def test_a_full_team_refuses_and_the_link_stays_unused(api, auth, people):
    full = make_project(people, members=4)  # 5 of 5
    from nextnode.infrastructure.persistence.models import TeamModel

    TeamModel.objects.filter(project_id=full).update(team_size=6)
    token = make_link(api, auth, full).json()["data"][0]["token"]
    TeamModel.objects.filter(project_id=full).update(team_size=5)
    refused = accept(api, auth, token)
    assert refused.status_code == 409
    assert api.get(f"/api/invite-links/{token}/", **auth("user_joiner")).json()["data"]["status"] == "active"
