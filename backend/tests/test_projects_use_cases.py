"""Project and document use cases (#3) with in-memory fakes: no database."""

from dataclasses import replace
from datetime import date
from uuid import UUID

import pytest

from nextnode.application.ports import Actor
from nextnode.application.projects.commands import (
    EditProject,
    ProjectCommand,
    ProjectDeps,
    ProposeProjectIdea,
    PublishClientBrief,
)
from nextnode.application.projects.documents import (
    DocumentDeps,
    DownloadDocument,
    GetDocumentLink,
    ListRequirementDocuments,
    Upload,
    UploadRequirementDocument,
)
from nextnode.application.projects.dto import APPLY_TO_JOIN, APPLY_TO_LEAD
from nextnode.application.projects.queries import GetProject, ListMyProjects, SearchProjects
from nextnode.domain.accounts import Role
from nextnode.domain.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from nextnode.domain.projects import UploadLimits
from nextnode.infrastructure.storage.links import DjangoLinkSigner
from tests.account_fakes import InMemorySkills, NoTransaction
from tests.project_fakes import FixedClock, InMemoryDocuments, InMemoryProjects, InMemoryStorage, policy_over

CLIENT = Actor("u_client", None, account_id=1, role=Role.CLIENT)
OTHER_CLIENT = Actor("u_other", None, account_id=2, role=Role.CLIENT)
DEV = Actor("u_dev", None, account_id=3, role=Role.DEVELOPER)
OTHER_DEV = Actor("u_dev2", None, account_id=4, role=Role.DEVELOPER)
NOT_ONBOARDED = Actor("u_new", None)

BRIEF = ProjectCommand(
    title="Booking app",
    description="A booking app for a small yoga studio.",
    tech_stack=["React", "Django"],
    target_delivery_date=date(2027, 2, 1),
    proposed_budget_cents=250_000,
)
IDEA = ProjectCommand(
    title="Open-source habit tracker",
    description="A habit tracker with streaks and reminders.",
    tech_stack=["Next.js"],
    target_delivery_date=date(2027, 3, 1),
)
PDF = b"%PDF-1.7 requirement"


class World:
    def __init__(self) -> None:
        self.projects = InMemoryProjects({1: "Grace", 3: "Ada", 4: "Linus"})
        self.documents = InMemoryDocuments()
        self.storage = InMemoryStorage()
        self.clock = FixedClock()
        self.policy = policy_over(self.projects)
        self.deps = ProjectDeps(self.projects, InMemorySkills(), self.policy, self.clock, NoTransaction())
        self.docs = DocumentDeps(
            self.projects,
            self.documents,
            self.storage,
            DjangoLinkSigner(),
            self.policy,
            self.clock,
            NoTransaction(),
            UploadLimits(max_bytes=100, max_files_per_project=2),
        )

    def brief(self) -> int:
        return PublishClientBrief(self.deps).execute(CLIENT, BRIEF).id

    def upload(self, actor=CLIENT, project_id=1, name="brief.pdf", content=PDF, size=None):
        upload = Upload(name, len(content) if size is None else size, lambda: content)
        return UploadRequirementDocument(self.docs).execute(actor, project_id, upload)


@pytest.fixture
def world() -> World:
    return World()


# --- publishing ---------------------------------------------------------------------


def test_a_client_publishes_a_brief_that_needs_a_lead(world):
    view = PublishClientBrief(world.deps).execute(CLIENT, BRIEF)
    assert (view.kind, view.status, view.proposed_budget_cents, view.lead) == (
        "client",
        "Posted",
        250_000,
        None,
    )
    assert view.viewer.is_owner and view.viewer.can_edit and view.viewer.can_upload_documents


def test_a_developer_publishes_an_idea_and_is_its_lead_at_once(world):
    view = ProposeProjectIdea(world.deps).execute(DEV, IDEA)
    assert view.kind == "developer" and view.proposed_budget_cents is None
    assert view.lead is not None and view.lead.account_id == DEV.account_id
    assert view.viewer.is_lead and not view.viewer.can_upload_documents


@pytest.mark.parametrize(
    ("use_case", "actor", "command"),
    [
        (PublishClientBrief, DEV, BRIEF),
        (ProposeProjectIdea, CLIENT, IDEA),
        (PublishClientBrief, NOT_ONBOARDED, BRIEF),
    ],
)
def test_each_role_creates_only_its_own_kind(world, use_case, actor, command):
    with pytest.raises(ForbiddenError):
        use_case(world.deps).execute(actor, command)


# --- editing ------------------------------------------------------------------------


def test_only_the_owner_edits_and_only_before_a_lead_is_hired(world):
    project_id = world.brief()
    edited = EditProject(world.deps).execute(CLIENT, project_id, replace(BRIEF, title="New title"))
    assert edited.title == "New title"
    with pytest.raises(ForbiddenError):
        EditProject(world.deps).execute(OTHER_CLIENT, project_id, BRIEF)
    world.projects.assign_lead(project_id, DEV.account_id)
    with pytest.raises(ConflictError, match="Team Lead"):
        EditProject(world.deps).execute(CLIENT, project_id, BRIEF)


def test_editing_a_missing_project_is_404(world):
    with pytest.raises(NotFoundError):
        EditProject(world.deps).execute(CLIENT, 99, BRIEF)


# --- finding ------------------------------------------------------------------------


def test_apply_to_lead_is_offered_only_on_a_client_project_without_a_lead(world):
    brief_id = world.brief()
    idea_id = ProposeProjectIdea(world.deps).execute(DEV, IDEA).id
    get = GetProject(world.deps)
    assert get.execute(OTHER_DEV, brief_id).viewer_actions == [APPLY_TO_LEAD]
    assert get.execute(OTHER_DEV, idea_id).viewer_actions == []  # never "Apply to lead" on an idea
    assert get.execute(OTHER_CLIENT, brief_id).viewer_actions == []
    world.projects.assign_lead(brief_id, DEV.account_id)
    assert get.execute(OTHER_DEV, brief_id).viewer_actions == []


def test_apply_to_join_appears_when_the_team_has_open_spots(world):
    idea_id = ProposeProjectIdea(world.deps).execute(DEV, IDEA).id
    project, team = world.projects.rows[idea_id]
    world.projects.rows[idea_id] = (project, replace(team, team_size=5))  # what #5 will set
    assert GetProject(world.deps).execute(OTHER_DEV, idea_id).viewer_actions == [APPLY_TO_JOIN]
    assert GetProject(world.deps).execute(DEV, idea_id).viewer_actions == []


def test_search_filters_combine_and_reject_unknown_values(world):
    world.brief()
    ProposeProjectIdea(world.deps).execute(DEV, IDEA)
    search = SearchProjects(world.projects, world.policy)
    assert [r.kind for r in search.execute(DEV).results] == ["developer", "client"]
    assert [r.kind for r in search.execute(DEV, kind="client", tech="react").results] == ["client"]
    assert search.execute(DEV, kind="developer", tech="react").results == []
    assert [r.kind for r in search.execute(DEV, needs_lead="true").results] == ["client"]
    with pytest.raises(ValidationError):
        search.execute(DEV, kind="robot")
    with pytest.raises(ValidationError):
        search.execute(DEV, needs_lead="yes")


def test_my_projects_lists_the_viewers_part(world):
    brief_id = world.brief()
    ProposeProjectIdea(world.deps).execute(DEV, IDEA)
    world.projects.assign_lead(brief_id, DEV.account_id)
    mine = ListMyProjects(world.projects)
    assert [(v.project.kind, v.my_role) for v in mine.execute(CLIENT)] == [("client", "owner")]
    assert sorted(v.my_role for v in mine.execute(DEV)) == ["lead", "owner"]


# --- documents ------------------------------------------------------------------------


def test_only_the_owning_client_uploads(world):
    project_id = world.brief()
    with pytest.raises(ForbiddenError):
        world.upload(actor=OTHER_CLIENT, project_id=project_id)
    idea_id = ProposeProjectIdea(world.deps).execute(DEV, IDEA).id
    with pytest.raises(ForbiddenError):
        world.upload(actor=DEV, project_id=idea_id)


@pytest.mark.parametrize(
    ("name", "content", "size"),
    [
        ("brief.pdf", b"MZ exe", None),
        ("brief.pdf", b"", None),
        ("brief.pdf", PDF, 101),
        ("big.pdf", b"%PDF-" + b"x" * 200, 5),
    ],
)
def test_bad_uploads_are_refused_on_the_file_field_and_nothing_is_stored(world, name, content, size):
    project_id = world.brief()
    with pytest.raises(ValidationError) as error:
        world.upload(project_id=project_id, name=name, content=content, size=size)
    assert "file" in error.value.fields
    assert world.storage.files == {} and world.documents.rows == {}


def test_the_count_limit_plus_one_is_refused(world):
    project_id = world.brief()
    world.upload(project_id=project_id)
    world.upload(project_id=project_id)
    with pytest.raises(ValidationError, match="at most 2"):
        world.upload(project_id=project_id)


def test_uploads_stop_once_the_project_leaves_posted(world):
    project_id = world.brief()
    project, _ = world.projects.rows[project_id]
    world.projects.save(project.send_offer())
    with pytest.raises(ConflictError):
        world.upload(project_id=project_id)


def test_readers_and_non_readers_of_documents(world):
    project_id = world.brief()
    document = world.upload(project_id=project_id)
    world.projects.assign_lead(project_id, DEV.account_id)
    member = Actor("u_member", None, account_id=5, role=Role.DEVELOPER)
    world.projects.add_member(project_id, member.account_id)
    for reader in (CLIENT, DEV, member):
        assert [d.id for d in ListRequirementDocuments(world.docs).execute(reader, project_id)] == [
            document.id
        ]
        GetDocumentLink(world.docs).execute(reader, project_id, UUID(document.id))
    for outsider in (OTHER_CLIENT, OTHER_DEV):  # applicants and invitees have no membership either
        with pytest.raises(NotFoundError):
            ListRequirementDocuments(world.docs).execute(outsider, project_id)
        with pytest.raises(NotFoundError):
            GetDocumentLink(world.docs).execute(outsider, project_id, UUID(document.id))


def test_a_link_downloads_for_15_minutes_then_stops(world):
    project_id = world.brief()
    document = world.upload(project_id=project_id)
    link = GetDocumentLink(world.docs).execute(CLIENT, project_id, UUID(document.id))
    download = DownloadDocument(world.docs)
    assert download.execute(link.token).content == PDF
    world.clock.advance(minutes=14, seconds=59)
    assert download.execute(link.token).filename == "brief.pdf"
    world.clock.advance(seconds=1)
    with pytest.raises(NotFoundError, match="expired"):
        download.execute(link.token)


def test_a_link_stops_at_once_when_its_holder_loses_access(world):
    project_id = world.brief()
    document = world.upload(project_id=project_id)
    world.projects.add_member(project_id, OTHER_DEV.account_id)
    link = GetDocumentLink(world.docs).execute(OTHER_DEV, project_id, UUID(document.id))
    assert DownloadDocument(world.docs).execute(link.token).content == PDF
    project, team = world.projects.rows[project_id]
    world.projects.rows[project_id] = (project, replace(team, member_account_ids=()))
    with pytest.raises(NotFoundError):
        DownloadDocument(world.docs).execute(link.token)


def test_a_tampered_link_is_refused(world):
    with pytest.raises(NotFoundError, match="isn't valid"):
        DownloadDocument(world.docs).execute("not-a-real-token")
