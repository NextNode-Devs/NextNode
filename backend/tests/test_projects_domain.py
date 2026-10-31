"""Project, Team and requirement document rules (#3), with no database."""

import io
import zipfile
from datetime import date

import pytest

from nextnode.domain.errors import ConflictError, ForbiddenError, InvalidStateTransitionError, ValidationError
from nextnode.domain.hiring import LeadAlreadyHiredError
from nextnode.domain.projects import Project, ProjectDetails, ProjectKind, ProjectStatus, Team, UploadLimits
from nextnode.domain.projects.documents import (
    DocumentType,
    clean_filename,
    detect_type,
    ensure_room_for_another,
    ensure_size_allowed,
)

TODAY = date(2026, 10, 31)


def details(kind=ProjectKind.CLIENT, **overrides) -> ProjectDetails:
    fields = {
        "title": "Booking app",
        "description": "A booking app for a small yoga studio.",
        "tech_stack": ["React", "Django"],
        "target_delivery_date": date(2027, 2, 1),
        "proposed_budget_cents": 150_000 if kind is ProjectKind.CLIENT else None,
        **overrides,
    }
    return ProjectDetails.create(kind, today=TODAY, **fields)


def fields_of(error: pytest.ExceptionInfo) -> dict:
    return error.value.fields


# --- details ---------------------------------------------------------------------


def test_a_brief_at_exactly_the_minimum_budget_is_accepted():
    assert details(proposed_budget_cents=150_000).proposed_budget_cents == 150_000


def test_a_brief_below_the_minimum_budget_is_refused_on_the_field():
    with pytest.raises(ValidationError) as error:
        details(proposed_budget_cents=149_999)
    assert fields_of(error) == {"proposed_budget_cents": ["Must be at least CAD 1,500.00."]}


def test_a_brief_needs_a_budget():
    with pytest.raises(ValidationError) as error:
        details(proposed_budget_cents=None)
    assert "proposed_budget_cents" in fields_of(error)


def test_an_idea_never_has_a_budget():
    assert details(ProjectKind.DEVELOPER).proposed_budget_cents is None
    with pytest.raises(ValidationError) as error:
        details(ProjectKind.DEVELOPER, proposed_budget_cents=200_000)
    assert "proposed_budget_cents" in fields_of(error)


def test_required_fields_are_named_together():
    with pytest.raises(ValidationError) as error:
        details(title=" ab ", description="short", target_delivery_date=TODAY)
    assert set(fields_of(error)) == {"title", "description", "target_delivery_date"}


def test_tech_stack_uses_the_shared_skill_rules():
    with pytest.raises(ValidationError) as error:
        details(tech_stack=[])
    assert "tech_stack" in fields_of(error)
    assert [s.key for s in details(tech_stack=[" React "]).tech_stack] == ["react"]


# --- status machines ----------------------------------------------------------------


def client_project(status=ProjectStatus.POSTED) -> Project:
    return Project(1, ProjectKind.CLIENT, 10, status, details())


def idea(status=ProjectStatus.POSTED) -> Project:
    return Project(2, ProjectKind.DEVELOPER, 20, status, details(ProjectKind.DEVELOPER))


def test_a_client_project_walks_its_whole_status_machine():
    project = client_project()
    for step, expected in [
        (Project.send_offer, ProjectStatus.OFFER_SENT),
        (Project.accept_offer, ProjectStatus.ASSIGNED),
        (Project.start, ProjectStatus.IN_PROGRESS),
        (Project.complete, ProjectStatus.COMPLETED),
        (Project.archive, ProjectStatus.ARCHIVED),
    ]:
        project = step(project)
        assert project.status is expected


def test_a_client_project_cannot_skip_a_step():
    with pytest.raises(InvalidStateTransitionError):
        client_project().start()
    with pytest.raises(InvalidStateTransitionError):
        client_project(ProjectStatus.OFFER_SENT).send_offer()


def test_an_idea_goes_posted_to_in_progress_and_never_offer_sent_or_assigned():
    assert idea().start().status is ProjectStatus.IN_PROGRESS
    assert idea(ProjectStatus.IN_PROGRESS).complete().archive().status is ProjectStatus.ARCHIVED
    with pytest.raises(InvalidStateTransitionError, match="never OfferSent or Assigned"):
        idea().send_offer()
    with pytest.raises(InvalidStateTransitionError, match="never OfferSent or Assigned"):
        idea().accept_offer()


# --- editing -------------------------------------------------------------------------


def test_only_the_owner_edits():
    with pytest.raises(ForbiddenError):
        client_project().edit(99, details(), has_lead=False)


def test_a_client_project_with_a_lead_cannot_be_edited():
    with pytest.raises(ConflictError, match="Team Lead"):
        client_project().edit(10, details(), has_lead=True)


def test_a_project_past_posted_cannot_be_edited():
    with pytest.raises(ConflictError, match="OfferSent"):
        client_project(ProjectStatus.OFFER_SENT).edit(10, details(), has_lead=False)


def test_an_idea_can_be_edited_by_its_creator_who_is_its_lead():
    edited = idea().edit(20, details(ProjectKind.DEVELOPER, title="New title"), has_lead=True)
    assert edited.details.title == "New title"


# --- team ----------------------------------------------------------------------------


def test_a_lead_can_be_assigned_once():
    team = Team.for_new_project().assign_lead(7)
    assert team.lead_account_id == 7 and team.headcount == 1
    with pytest.raises(LeadAlreadyHiredError):
        team.assign_lead(8)


def test_a_new_team_has_no_open_spots_until_the_lead_sets_a_size():
    assert Team.for_new_project(lead_account_id=7).open_spots == 0


# --- documents -----------------------------------------------------------------------


def docx_bytes() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as package:
        package.writestr("[Content_Types].xml", "<Types/>")
        package.writestr("word/document.xml", "<document/>")
    return buffer.getvalue()


def test_real_pdf_and_docx_files_are_accepted():
    assert detect_type("brief.PDF", b"%PDF-1.7 ...") is DocumentType.PDF
    assert detect_type("brief.docx", docx_bytes()) is DocumentType.DOCX


@pytest.mark.parametrize(
    ("name", "content", "message"),
    [
        ("notes.txt", b"hello", "Upload a PDF or DOCX file."),
        ("brief", b"%PDF-1.7", "Upload a PDF or DOCX file."),
        ("empty.pdf", b"", "This file is empty."),
        ("renamed.pdf", b"MZ\x90\x00 an exe", "isn't a real PDF"),
        ("renamed.docx", b"%PDF-1.7", "isn't a real DOCX"),
        ("any.docx", b"PK\x03\x04 not really a zip", "isn't a real DOCX"),
    ],
)
def test_other_files_are_refused_on_the_file_field(name, content, message):
    with pytest.raises(ValidationError, match=message) as error:
        detect_type(name, content)
    assert "file" in fields_of(error)


def test_a_zip_that_is_not_a_word_document_is_refused():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as package:
        package.writestr("readme.txt", "hi")
    with pytest.raises(ValidationError):
        detect_type("archive.docx", buffer.getvalue())


def test_size_and_count_limits():
    limits = UploadLimits(max_bytes=10, max_files_per_project=2)
    ensure_size_allowed(10, limits)
    with pytest.raises(ValidationError, match="at most"):
        ensure_size_allowed(11, limits)
    ensure_room_for_another(1, limits)
    with pytest.raises(ValidationError, match="at most 2 documents"):
        ensure_room_for_another(2, limits)


def test_filenames_are_kept_for_display_without_paths():
    assert clean_filename("C:\\Users\\me\\brief.pdf") == "brief.pdf"
    assert clean_filename("../../etc/passwd.pdf") == "passwd.pdf"
    assert clean_filename('a"b<c>.pdf') == "abc.pdf"
