"""Reading Hire Devs: the team profile, one candidacy, the viewer's lists."""

from datetime import UTC, datetime
from uuid import UUID

import pytest

from nextnode.application.access import AccessPolicy
from nextnode.application.ports import Actor
from nextnode.application.teams.ports import TeamMemberRecord
from nextnode.application.teams.queries import GetTeam
from nextnode.domain.errors import ForbiddenError, NotFoundError
from tests.team_fakes import CLIENT, DEV_IDS, LEAD, LEAD_ID, STRANGER, FakeMembers, World, dev


@pytest.fixture
def w() -> World:
    return World()


@pytest.fixture
def project(w: World) -> int:
    return w.project()


def test_get_team_puts_the_lead_first_and_links_portfolios(w, project):
    joined = datetime(2026, 11, 1, tzinfo=UTC)
    w.uc.set_team_size.execute(LEAD, project, 5)
    w.projects.add_member(project, DEV_IDS[0])
    members = FakeMembers(
        [
            TeamMemberRecord(DEV_IDS[0], "Linus", "member", joined),
            TeamMemberRecord(LEAD_ID, "Ada", "lead", joined),
        ]
    )
    policy = AccessPolicy()
    policy.register("team", "read", lambda actor, resource: True)
    team = GetTeam(w.projects, members, policy).execute(CLIENT, project)
    assert (team.size, team.open_spots, team.status) == (5, 3, "open")
    assert [m.role for m in team.members] == ["lead", "member"]
    assert team.members[1].portfolio_url == f"/developers/{DEV_IDS[0]}"
    assert team.members[1].joined_at == joined.isoformat()


def test_get_team_uses_the_access_policy_and_a_missing_project_is_not_found(w, project):
    with pytest.raises(ForbiddenError):
        GetTeam(w.projects, FakeMembers([]), AccessPolicy()).execute(CLIENT, project)
    policy = AccessPolicy()
    policy.register("team", "read", lambda actor, resource: True)
    with pytest.raises(NotFoundError):
        GetTeam(w.projects, FakeMembers([]), policy).execute(CLIENT, 99)


def test_a_candidacy_is_visible_to_its_two_people_only(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    invitation = w.uc.invite_developer.execute(LEAD, project, DEV_IDS[0])
    mine = w.uc.get_candidacy.execute(dev(0), UUID(invitation.id))
    assert (mine.actions.accept, mine.actions.decline, mine.actions.withdraw) == (True, True, False)
    theirs = w.uc.get_candidacy.execute(LEAD, UUID(invitation.id))
    assert (theirs.actions.accept, theirs.actions.reject) == (False, False)
    for who in (STRANGER, CLIENT):
        with pytest.raises(NotFoundError):
            w.uc.get_candidacy.execute(who, UUID(invitation.id))


def test_my_lists_show_each_person_their_part(w, project):
    w.uc.set_team_size.execute(LEAD, project, 5)
    application = w.uc.apply_to_join.execute(dev(0), project)
    w.uc.invite_developer.execute(LEAD, project, DEV_IDS[1])

    lead_rows = w.uc.list_my_candidacies.execute(LEAD)
    assert [(r.kind, r.my_part) for r in lead_rows] == [("invitation", "lead"), ("application", "lead")]
    assert lead_rows[1].actions.accept is True
    assert lead_rows[1].developer_name == f"Person {DEV_IDS[0]}"
    assert lead_rows[1].project_title == "Booking app"

    [dev_row] = w.uc.list_my_candidacies.execute(dev(0))
    assert (dev_row.candidacy_id, dev_row.my_part) == (application.id, "developer")
    assert w.uc.list_my_candidacies.execute(STRANGER) == []
    assert w.uc.list_my_candidacies.execute(Actor("user_new", None)) == []
