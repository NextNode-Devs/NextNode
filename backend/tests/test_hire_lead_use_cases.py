"""Hire Lead (issue #4) with in-memory fakes and a stand-in for #3's projects:
apply once, invite, accept/decline/withdraw, hire one Lead, close the others."""

from uuid import UUID, uuid4

import pytest

from nextnode.application.conversations.commands import CloseConversation, OpenConversation
from nextnode.application.hiring.lead import (
    AcceptLeadInvitation,
    ApplyToLead,
    DeclineLeadInvitation,
    GetLeadCandidacy,
    HireLeadDeps,
    HireTeamLead,
    InviteToLead,
    WithdrawLeadApplication,
)
from nextnode.application.hiring.queries import ListMyLeadCandidacies, ListProjectLeadChats
from nextnode.application.ports import Actor
from nextnode.domain.accounts import Role
from nextnode.domain.errors import (
    ConflictError,
    ForbiddenError,
    InvalidStateTransitionError,
    NotFoundError,
    ValidationError,
)
from nextnode.domain.hiring import LeadAlreadyHiredError, LeadProject
from tests.conversation_fakes import (
    FakeClock,
    FakeConversations,
    FakeEvents,
    FakeNames,
    FakeUnitOfWork,
    Store,
)
from tests.hiring_fakes import FakeCandidacies, FakeHiringAccounts, FakeLeadProjects

CLIENT, ADA, LINUS, OTHER_CLIENT = 1, 2, 3, 4
PROJECT = 10


def person(account_id: int, role: Role) -> Actor:
    return Actor(f"user_{account_id}", None, account_id=account_id, role=role)


client, ada, linus = person(CLIENT, Role.CLIENT), person(ADA, Role.DEVELOPER), person(LINUS, Role.DEVELOPER)
other_client = person(OTHER_CLIENT, Role.CLIENT)


class World:
    def __init__(self) -> None:
        self.store = Store(names={CLIENT: "Grace", ADA: "Ada", LINUS: "Linus", OTHER_CLIENT: "Edsger"})
        clock, events, uow = FakeClock(self.store), FakeEvents(self.store), FakeUnitOfWork()
        self.conversations = FakeConversations(self.store)
        names = FakeNames(self.store)
        self.projects = FakeLeadProjects()
        self.projects.put(
            LeadProject(
                PROJECT, CLIENT, client_funded=True, status="Posted", lead_account_id=None, title="Shop"
            )
        )
        self.candidacies = FakeCandidacies(clock)
        deps = HireLeadDeps(
            projects=self.projects,
            candidacies=self.candidacies,
            accounts=FakeHiringAccounts(
                {CLIENT: Role.CLIENT, ADA: Role.DEVELOPER, LINUS: Role.DEVELOPER, OTHER_CLIENT: Role.CLIENT}
            ),
            conversations=self.conversations,
            open_conversation=OpenConversation(self.conversations, names, events, uow),
            close_conversation=CloseConversation(self.conversations, events, uow, clock),
            events=events,
            clock=clock,
            uow=uow,
        )
        self.deps = deps
        self.apply = ApplyToLead(deps)
        self.invite = InviteToLead(deps)
        self.accept = AcceptLeadInvitation(deps)
        self.decline = DeclineLeadInvitation(deps)
        self.withdraw = WithdrawLeadApplication(deps)
        self.hire = HireTeamLead(deps)
        self.get = GetLeadCandidacy(deps)

    def conversation(self, view):
        return self.store.conversations[UUID(view.conversation_id)]

    def frames(self, frame_type: str) -> list[dict]:
        return [frame for _, frame in self.store.published if frame["type"] == frame_type]


@pytest.fixture
def w() -> World:
    return World()


# --- apply -----------------------------------------------------------------------------


def test_applying_opens_a_conversation_with_the_client_and_makes_a_candidate(w):
    view = w.apply.execute(ada, PROJECT, "I've led three React teams.")
    assert (view.kind, view.status, view.note) == ("application", "candidate", "I've led three React teams.")
    conversation = w.conversation(view)
    assert conversation.participant_ids == (CLIENT, ADA)
    assert conversation.subject.kind.value == "lead_application"
    assert w.frames("lead.updated")[-1]["status"] == "candidate"


def test_a_developer_applies_to_lead_a_project_once(w):
    view = w.apply.execute(ada, PROJECT)
    with pytest.raises(ConflictError, match="already applied"):
        w.apply.execute(ada, PROJECT)
    w.withdraw.execute(ada, UUID(view.id))
    with pytest.raises(ConflictError, match="once"):
        w.apply.execute(ada, PROJECT)


def test_clients_cannot_apply(w):
    with pytest.raises(ForbiddenError):
        w.apply.execute(other_client, PROJECT)


def test_no_applying_to_lead_a_developer_created_project(w):
    w.projects.put(LeadProject(11, ADA, client_funded=False, status="Posted", lead_account_id=ADA))
    with pytest.raises(ValidationError, match="Developer-created"):
        w.apply.execute(linus, 11)


def test_no_applying_once_the_project_has_a_lead(w):
    w.projects.put(LeadProject(12, CLIENT, client_funded=True, status="Posted", lead_account_id=LINUS))
    with pytest.raises(LeadAlreadyHiredError):
        w.apply.execute(ada, 12)


def test_applying_to_a_missing_project_is_not_found(w):
    with pytest.raises(NotFoundError):
        w.apply.execute(ada, 999)


def test_a_note_over_the_limit_is_refused(w):
    with pytest.raises(ValidationError):
        w.apply.execute(ada, PROJECT, "x" * 1001)


# --- invite ----------------------------------------------------------------------------


def test_the_client_invites_and_a_duplicate_invitation_is_refused(w):
    view = w.invite.execute(client, PROJECT, ADA, "Would you lead this?")
    assert (view.kind, view.status) == ("invitation", "invited")
    assert w.conversation(view).subject.kind.value == "lead_invitation"
    with pytest.raises(ConflictError, match="already has an invitation"):
        w.invite.execute(client, PROJECT, ADA)


def test_an_invited_developer_cannot_also_apply(w):
    w.invite.execute(client, PROJECT, ADA)
    with pytest.raises(ConflictError, match="already been invited"):
        w.apply.execute(ada, PROJECT)


def test_only_the_projects_client_can_invite_and_only_developers(w):
    with pytest.raises(NotFoundError):
        w.invite.execute(other_client, PROJECT, ADA)
    with pytest.raises(ForbiddenError):
        w.invite.execute(ada, PROJECT, LINUS)
    with pytest.raises(ValidationError, match="only invite a developer"):
        w.invite.execute(client, PROJECT, OTHER_CLIENT)


# --- answers ---------------------------------------------------------------------------


def test_accepting_makes_a_candidate_but_does_not_hire(w):
    invited = w.invite.execute(client, PROJECT, ADA)
    view = w.accept.execute(ada, UUID(invited.id))
    assert view.status == "candidate"
    assert w.projects.get(PROJECT).lead_account_id is None
    assert w.conversation(view).is_open


def test_declining_closes_the_conversation_with_the_reason(w):
    invited = w.invite.execute(client, PROJECT, ADA)
    view = w.decline.execute(ada, UUID(invited.id))
    assert view.status == "declined"
    assert w.conversation(view).close_reason == "The developer declined the invitation."


def test_withdrawing_closes_the_conversation(w):
    applied = w.apply.execute(ada, PROJECT)
    view = w.withdraw.execute(ada, UUID(applied.id))
    assert view.status == "withdrawn"
    assert w.conversation(view).close_reason == "The developer withdrew their application."


def test_only_the_developer_answers_and_only_once(w):
    invited = UUID(w.invite.execute(client, PROJECT, ADA).id)
    with pytest.raises(ForbiddenError):
        w.accept.execute(client, invited)
    w.accept.execute(ada, invited)
    with pytest.raises(InvalidStateTransitionError):
        w.decline.execute(ada, invited)


def test_strangers_get_not_found(w):
    applied = UUID(w.apply.execute(ada, PROJECT).id)
    for action in (w.get, w.withdraw, w.hire):
        with pytest.raises(NotFoundError):
            action.execute(linus, applied)
    with pytest.raises(NotFoundError):
        w.get.execute(ada, uuid4())


# --- hire -------------------------------------------------------------------------------


def test_hiring_sets_the_lead_and_closes_every_other_lead_conversation(w):
    ada_app = w.apply.execute(ada, PROJECT)
    linus_inv = w.invite.execute(client, PROJECT, LINUS)
    view = w.hire.execute(client, UUID(ada_app.id))

    assert view.status == "hired"
    assert w.projects.get(PROJECT).lead_account_id == ADA
    assert w.projects.get(PROJECT).status == "Posted"  # Assigned means an accepted offer (#6)
    assert w.conversation(view).is_open  # the hired Lead keeps talking to the client
    linus = w.get.execute(client, UUID(linus_inv.id))
    assert linus.status == "closed"
    assert w.conversation(linus).close_reason == "Another candidate was hired."
    statuses = {f["candidacy_id"]: f["status"] for f in w.frames("lead.updated")}
    assert statuses[ada_app.id] == "hired" and statuses[linus_inv.id] == "closed"


def test_only_the_client_hires_only_a_candidate_and_only_once(w):
    applied = UUID(w.apply.execute(ada, PROJECT).id)
    invited = UUID(w.invite.execute(client, PROJECT, LINUS).id)
    with pytest.raises(ForbiddenError):
        w.hire.execute(ada, applied)
    with pytest.raises(InvalidStateTransitionError, match="accept your invitation"):
        w.hire.execute(client, invited)
    w.hire.execute(client, applied)
    with pytest.raises(LeadAlreadyHiredError):
        w.hire.execute(client, applied)


def test_after_a_hire_late_answers_and_new_candidacies_are_refused(w):
    invited = UUID(w.invite.execute(client, PROJECT, LINUS).id)
    w.hire.execute(client, UUID(w.apply.execute(ada, PROJECT).id))
    with pytest.raises(InvalidStateTransitionError):
        w.accept.execute(linus, invited)
    with pytest.raises(LeadAlreadyHiredError):
        w.invite.execute(client, PROJECT, LINUS)


def test_actions_differ_per_viewer(w):
    invited = UUID(w.invite.execute(client, PROJECT, ADA).id)
    for_ada = w.get.execute(ada, invited).actions
    for_client = w.get.execute(client, invited).actions
    assert (for_ada.accept, for_ada.decline, for_ada.hire) == (True, True, False)
    assert (for_client.accept, for_client.hire) == (False, False)
    w.accept.execute(ada, invited)
    assert w.get.execute(client, invited).actions.hire is True
    assert w.get.execute(ada, invited).actions.withdraw is False  # invitations are declined, not withdrawn


# --- the project's hiring chats (its page) ------------------------------------------


def test_the_client_sees_every_chat_on_their_project_and_a_developer_only_their_own(w):
    applied = w.apply.execute(ada, PROJECT, "")
    invited = w.invite.execute(client, PROJECT, LINUS)
    chats = ListProjectLeadChats(w.deps, FakeNames(w.store))

    seen_by_client = chats.execute(client, PROJECT)
    assert [(c.developer_name, c.kind, c.conversation_id) for c in seen_by_client] == [
        ("Ada", "application", applied.conversation_id),
        ("Linus", "invitation", invited.conversation_id),
    ]
    assert [c.developer_name for c in chats.execute(ada, PROJECT)] == ["Ada"]
    assert chats.execute(other_client, PROJECT) == []


def test_project_chats_of_a_missing_project_are_404(w):
    with pytest.raises(NotFoundError):
        ListProjectLeadChats(w.deps, FakeNames(w.store)).execute(client, 999)


# --- the dashboard's lists ------------------------------------------------------------


def test_dashboard_lists_the_clients_candidacies_and_each_developers_own_newest_first(w):
    w.apply.execute(ada, PROJECT, "")
    w.invite.execute(client, PROJECT, LINUS)
    mine = ListMyLeadCandidacies(w.deps, FakeNames(w.store))

    seen_by_client = mine.execute(client)
    assert [(v.developer_name, v.kind, v.project_title) for v in seen_by_client] == [
        ("Linus", "invitation", "Shop"),
        ("Ada", "application", "Shop"),
    ]
    assert all(v.client_name == "Grace" and v.conversation_id for v in seen_by_client)
    assert [(v.kind, v.status) for v in mine.execute(linus)] == [("invitation", "invited")]
    assert mine.execute(other_client) == []


def test_dashboard_leaves_out_projects_that_no_longer_exist(w):
    w.apply.execute(ada, PROJECT, "")
    del w.projects.projects[PROJECT]
    assert ListMyLeadCandidacies(w.deps, FakeNames(w.store)).execute(ada) == []
