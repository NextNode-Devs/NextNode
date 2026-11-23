"""Assistant Lead and inactivity on developer projects (NN-39), with fakes and a fixed clock."""

import pytest

from nextnode.domain.errors import ConflictError, ForbiddenError, ValidationError
from nextnode.domain.projects import ANSWER_DAYS, LEAD_INACTIVE_DAYS, ProjectKind, ProjectStatus
from tests.stewardship_fakes import StewardshipWorld
from tests.team_fakes import DEV_IDS, LEAD, LEAD_ID, STRANGER, dev


@pytest.fixture
def world() -> StewardshipWorld:
    return StewardshipWorld()


# --- the Assistant Lead -------------------------------------------------------------------


def test_the_lead_chooses_one_member_as_assistant_lead(world):
    pid = world.project()
    view = world.uc.choose_assistant_lead.execute(LEAD, pid, DEV_IDS[1])
    assert view.assistant_lead is not None and view.assistant_lead.account_id == DEV_IDS[1]
    assert "Remove the Team Lead" in view.assistant_lead_cannot
    # Choosing again replaces them: there is only ever one.
    world.uc.choose_assistant_lead.execute(LEAD, pid, DEV_IDS[2])
    assert world.team(pid).assistant_lead_account_id == DEV_IDS[2]
    assert world.events.frames[-1][1] == {
        "type": "team.updated",
        "project_id": pid,
        "reason": "assistant_lead",
    }


def test_only_the_lead_chooses_and_only_a_member(world):
    pid = world.project()
    world.uc.choose_assistant_lead.execute(LEAD, pid, DEV_IDS[0])
    with pytest.raises(ForbiddenError):  # the Assistant Lead can't pick another one
        world.uc.choose_assistant_lead.execute(dev(0), pid, DEV_IDS[1])
    with pytest.raises(ForbiddenError):
        world.uc.choose_assistant_lead.execute(dev(1), pid, DEV_IDS[1])
    with pytest.raises(ValidationError):  # never the Lead, never an outsider
        world.uc.choose_assistant_lead.execute(LEAD, pid, LEAD_ID)
    with pytest.raises(ValidationError):
        world.uc.choose_assistant_lead.execute(LEAD, pid, 999)


def test_client_projects_have_no_assistant_lead(world):
    pid = world.project(kind=ProjectKind.CLIENT)
    with pytest.raises(ConflictError, match="Client projects"):
        world.uc.choose_assistant_lead.execute(LEAD, pid, DEV_IDS[0])


def test_strangers_cannot_see_a_teams_stewardship(world):
    pid = world.project()
    with pytest.raises(ForbiddenError):
        world.uc.get.execute(STRANGER, pid)
    assert world.uc.get.execute(dev(0), pid).actions.close_project is False


def test_the_lead_or_assistant_lead_closes_the_project_but_not_other_members(world):
    pid = world.project()
    world.uc.choose_assistant_lead.execute(LEAD, pid, DEV_IDS[0])
    with pytest.raises(ForbiddenError):
        world.uc.close_project.execute(dev(1), pid)
    view = world.uc.close_project.execute(dev(0), pid)
    assert view.project_status == "Closed" and view.actions.close_project is False
    with pytest.raises(ConflictError):
        world.uc.choose_assistant_lead.execute(LEAD, pid, DEV_IDS[1])


# --- inactivity ------------------------------------------------------------------------------


def test_nothing_happens_before_thirty_days_of_lead_silence(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS - 0.01)
    assert world.run().asked == []
    assert world.uc.get.execute(LEAD, pid).activity_check is None


def test_lead_messages_keep_the_project_active(world):
    pid = world.project()
    world.after(20)
    world.lead_writes(pid)
    world.after(20)
    assert world.run().asked == []


def test_after_thirty_days_members_are_asked_and_the_project_is_hidden(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS)
    assert world.run().asked == [pid]
    view = world.uc.get.execute(dev(0), pid)
    assert view.activity_check is not None and view.activity_check.status == "pending"
    assert view.activity_check.question == "Is this project still active?"
    assert view.hidden_from_feed and view.actions.confirm_active
    recipients, frame = world.events.frames[-1]
    assert recipients == (LEAD_ID, *DEV_IDS[:3]) and frame["reason"] == "activity_check"
    assert world.run().asked == []  # asked once, not every day


def test_the_first_member_to_confirm_becomes_assistant_lead(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS)
    world.run()
    view = world.uc.confirm_active.execute(dev(1), pid)
    assert view.activity_check is not None and view.activity_check.status == "confirmed"
    assert view.assistant_lead is not None and view.assistant_lead.account_id == DEV_IDS[1]
    assert view.hidden_from_feed is False
    with pytest.raises(ConflictError):  # already answered
        world.uc.confirm_active.execute(dev(2), pid)


def test_confirming_keeps_an_existing_assistant_lead(world):
    pid = world.project()
    world.uc.choose_assistant_lead.execute(LEAD, pid, DEV_IDS[0])
    world.after(LEAD_INACTIVE_DAYS)
    world.run()
    world.uc.confirm_active.execute(dev(2), pid)
    assert world.team(pid).assistant_lead_account_id == DEV_IDS[0]


def test_strangers_cannot_answer(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS)
    world.run()
    with pytest.raises(ForbiddenError):
        world.uc.confirm_active.execute(STRANGER, pid)


def test_nobody_answers_in_seven_days_so_the_project_closes(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS)
    world.run()
    world.after(ANSWER_DAYS - 0.01)
    assert world.run().closed == []
    world.after(0.01)
    assert world.run().closed == [pid]
    assert world.status(pid) is ProjectStatus.CLOSED
    view = world.uc.get.execute(LEAD, pid)
    assert view.activity_check is not None and view.activity_check.status == "closed"
    assert view.activity_check_due_at is None  # closed projects are never asked again
    with pytest.raises(ConflictError):
        world.uc.confirm_active.execute(dev(0), pid)


def test_a_lead_who_writes_again_ends_the_check(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS)
    world.run()
    world.after(2)
    world.lead_writes(pid)
    assert world.run().lead_returned == [pid]
    assert world.uc.get.execute(LEAD, pid).activity_check.status == "lead_returned"
    world.after(ANSWER_DAYS)
    assert world.run().closed == []
    assert world.status(pid) is ProjectStatus.IN_PROGRESS


def test_the_lead_may_answer_the_question_themselves(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS)
    world.run()
    view = world.uc.confirm_active.execute(LEAD, pid)
    assert view.activity_check.status == "lead_returned" and view.assistant_lead is None


def test_after_a_confirmation_the_thirty_days_start_again(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS)
    world.run()
    world.uc.confirm_active.execute(dev(0), pid)
    world.after(LEAD_INACTIVE_DAYS - 1)
    assert world.run().asked == []
    world.after(1)
    assert world.run().asked == [pid]


def test_closing_while_asked_ends_the_check(world):
    pid = world.project()
    world.after(LEAD_INACTIVE_DAYS)
    world.run()
    world.uc.close_project.execute(LEAD, pid)
    assert world.checks.latest_for(pid).status.value == "closed"
    assert world.run() == world.run().__class__(asked=[], closed=[], lead_returned=[])


def test_client_projects_are_never_checked(world):
    pid = world.project(kind=ProjectKind.CLIENT)
    world.after(LEAD_INACTIVE_DAYS * 3)
    assert world.run().asked == []
    assert world.status(pid) is ProjectStatus.IN_PROGRESS
