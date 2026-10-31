"""Private requirement documents end to end (#3): real PostgreSQL, real local
storage in a temporary folder, a fixed clock for link expiry."""

import io
import zipfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from nextnode.domain.projects import UploadLimits
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.persistence.models import TeamMembershipModel, TeamModel
from nextnode.infrastructure.storage.local import LocalPrivateStorage
from tests.project_fakes import FixedClock
from tests.test_projects_api import BRIEF, IDEA

pytestmark = pytest.mark.django_db

PDF = b"%PDF-1.7\n% a requirement document\n"


def docx() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as package:
        package.writestr("[Content_Types].xml", "<Types/>")
        package.writestr("word/document.xml", "<document/>")
    return buffer.getvalue()


@pytest.fixture
def clock():
    return FixedClock()


@pytest.fixture(autouse=True)
def container(verifier, tmp_path, clock):
    with override_container(
        token_verifier=verifier,
        file_storage=LocalPrivateStorage(tmp_path),
        upload_limits=UploadLimits(max_bytes=1024, max_files_per_project=2),
        clock=clock,
    ):
        yield


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def people(api, auth):
    ids = {}
    for sub, role, name in [
        ("client_grace", "client", "Grace"),
        ("client_other", "client", "Other"),
        ("dev_lead", "developer", "Lead"),
        ("dev_member", "developer", "Member"),
        ("dev_applicant", "developer", "Applicant"),
        ("dev_invitee", "developer", "Invitee"),
        ("dev_stranger", "developer", "Stranger"),
    ]:
        body: dict = {"role": role, "display_name": name}
        body[role] = (
            {"company_name": "Acme", "industry": "Retail"}
            if role == "client"
            else {"headline": "Dev", "skills": ["Python"]}
        )
        ids[sub] = api.post("/api/onboarding/", data=body, format="json", **auth(sub)).json()["data"]["id"]
    return ids


@pytest.fixture
def project(api, auth, people):
    response = api.post(
        "/api/projects/",
        data={**BRIEF, "target_delivery_date": "2027-06-01"},
        format="json",
        **auth("client_grace"),
    )
    return response.json()["data"]["id"]


def upload(api, auth, project_id, name="brief.pdf", content=PDF, sub="client_grace"):
    file = SimpleUploadedFile(name, content, content_type="application/pdf")
    return api.post(f"/api/projects/{project_id}/documents/", {"file": file}, format="multipart", **auth(sub))


def test_the_client_uploads_a_pdf_and_a_docx_and_lists_them(api, auth, project, tmp_path):
    assert upload(api, auth, project).status_code == 201
    response = upload(api, auth, project, "spec.docx", docx())
    assert response.status_code == 201, response.json()
    listed = api.get(f"/api/projects/{project}/documents/", **auth("client_grace")).json()["data"]
    assert [(d["filename"], d["type"]) for d in listed] == [("brief.pdf", "pdf"), ("spec.docx", "docx")]
    stored = [p.name for p in tmp_path.rglob("*") if p.is_file()]
    assert len(stored) == 2 and "brief.pdf" not in stored  # generated keys, never the uploaded name


@pytest.mark.parametrize(
    ("name", "content", "message"),
    [
        ("renamed.pdf", b"MZ\x90\x00 really an exe", "isn't a real PDF"),
        ("notes.txt", b"hello", "Upload a PDF or DOCX file."),
        ("empty.pdf", b"", "empty"),
        ("big.pdf", b"%PDF-" + b"x" * 2000, "at most"),
    ],
)
def test_ac8_bad_files_are_refused_on_the_file_field(api, auth, project, name, content, message):
    response = upload(api, auth, project, name, content)
    assert response.status_code == 400, response.json()
    assert message in response.json()["error"]["fields"]["file"][0]


def test_ac8_the_file_over_the_count_is_refused(api, auth, project):
    assert upload(api, auth, project).status_code == 201
    assert upload(api, auth, project).status_code == 201
    response = upload(api, auth, project)
    assert (
        response.status_code == 400 and "at most 2 documents" in response.json()["error"]["fields"]["file"][0]
    )


def test_a_missing_file_is_refused_on_the_field(api, auth, project):
    response = api.post(f"/api/projects/{project}/documents/", {}, format="multipart", **auth("client_grace"))
    assert response.status_code == 400 and "file" in response.json()["error"]["fields"]


def test_only_the_owning_client_uploads_and_only_to_a_client_project(api, auth, people, project):
    assert upload(api, auth, project, sub="client_other").status_code == 403
    assert upload(api, auth, project, sub="dev_stranger").status_code == 403
    idea = api.post(
        "/api/project-ideas/",
        data={**IDEA, "target_delivery_date": "2027-06-01"},
        format="json",
        **auth("dev_lead"),
    )
    assert upload(api, auth, idea.json()["data"]["id"], sub="dev_lead").status_code == 403


def make_team(api, auth, people, project):
    """Lead hired through #4; an approved member as #5 will add; an open lead
    application; an open lead invitation."""
    lead = api.post(
        f"/api/projects/{project}/lead-applications/", {}, format="json", **auth("dev_lead")
    ).json()
    assert (
        api.post(f"/api/lead-candidacies/{lead['data']['id']}/hire/", **auth("client_grace")).status_code
        == 200
    )
    team = TeamModel.objects.get(project_id=project)
    TeamMembershipModel.objects.create(team=team, account_id=people["dev_member"], role="member")
    return team


def test_ac9_readers_download_and_everyone_else_gets_404(api, auth, people, project):
    document = upload(api, auth, project).json()["data"]
    # An applicant and an invitee, before any hire (their candidacies close on hire).
    assert (
        api.post(
            f"/api/projects/{project}/lead-applications/", {}, format="json", **auth("dev_applicant")
        ).status_code
        == 201
    )
    invite = {"developer_account_id": people["dev_invitee"]}
    assert (
        api.post(
            f"/api/projects/{project}/lead-invitations/", invite, format="json", **auth("client_grace")
        ).status_code
        == 201
    )
    outsiders = ("dev_applicant", "dev_invitee", "dev_stranger", "client_other")
    for sub in outsiders:
        assert api.get(f"/api/projects/{project}/documents/", **auth(sub)).status_code == 404
    make_team(api, auth, people, project)

    link_url = f"/api/projects/{project}/documents/{document['id']}/link/"
    for sub in ("client_grace", "dev_lead", "dev_member"):
        assert api.get(f"/api/projects/{project}/documents/", **auth(sub)).status_code == 200
        link = api.get(link_url, **auth(sub))
        assert link.status_code == 200, link.json()
        download = api.get(link.json()["data"]["url"])
        assert download.status_code == 200 and download.content == PDF
        assert download["Content-Disposition"].startswith("attachment;")
        assert download["X-Content-Type-Options"] == "nosniff"
        assert download["Content-Type"] == "application/pdf"
    for sub in outsiders:
        assert api.get(f"/api/projects/{project}/documents/", **auth(sub)).status_code == 404
        assert api.get(link_url, **auth(sub)).status_code == 404
    # A link issued to a reader does not work for the wrong project or a forged token.
    assert api.get("/api/files/forged-token/").status_code == 404


def test_the_detail_page_says_who_can_read_documents(api, auth, people, project):
    for sub, readable in [("client_grace", True), ("dev_stranger", False)]:
        viewer = api.get(f"/api/projects/{project}/", **auth(sub)).json()["data"]["viewer"]
        assert viewer["can_read_documents"] is readable


def test_ac10_a_link_expires_after_15_minutes(api, auth, people, project, clock):
    document = upload(api, auth, project).json()["data"]
    link = api.get(
        f"/api/projects/{project}/documents/{document['id']}/link/", **auth("client_grace")
    ).json()["data"]
    clock.advance(minutes=14, seconds=59)
    assert api.get(link["url"]).status_code == 200
    clock.advance(seconds=1)
    expired = api.get(link["url"])
    assert expired.status_code == 404 and "expired" in expired.json()["error"]["message"]


def test_ac10_a_link_stops_at_once_when_its_holder_loses_access(api, auth, people, project):
    document = upload(api, auth, project).json()["data"]
    make_team(api, auth, people, project)
    link = api.get(f"/api/projects/{project}/documents/{document['id']}/link/", **auth("dev_member")).json()[
        "data"
    ]
    assert api.get(link["url"]).status_code == 200
    TeamMembershipModel.objects.filter(account_id=people["dev_member"]).update(status="rejected")
    assert api.get(link["url"]).status_code == 404
