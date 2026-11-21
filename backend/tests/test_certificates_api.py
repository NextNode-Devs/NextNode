"""Portfolio certificates end to end (NN-34, #102): real PostgreSQL and real
local storage in a temporary folder. PDF only."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from nextnode.domain.accounts.certificates import MAX_CERTIFICATES
from nextnode.domain.projects import UploadLimits
from nextnode.infrastructure.container import override_container
from nextnode.infrastructure.persistence.models import CertificateModel
from nextnode.infrastructure.storage.local import LocalPrivateStorage
from tests.project_fakes import FixedClock

pytestmark = pytest.mark.django_db

PDF = b"%PDF-1.7\n% an AWS certificate\n"
MINE = "/api/developers/me/certificates/"


@pytest.fixture(autouse=True)
def container(verifier, tmp_path):
    with override_container(
        token_verifier=verifier,
        file_storage=LocalPrivateStorage(tmp_path),
        upload_limits=UploadLimits(max_bytes=1024, max_files_per_project=2),
        clock=FixedClock(),
    ):
        yield


@pytest.fixture
def auth(make_token):
    return lambda sub: {"HTTP_AUTHORIZATION": f"Bearer {make_token(sub=sub)}"}


@pytest.fixture
def people(api, auth):
    ids = {}
    for sub, role in [("dev_ada", "developer"), ("dev_linus", "developer"), ("client_grace", "client")]:
        body: dict = {"role": role, "display_name": sub}
        body[role] = (
            {"company_name": "Acme", "industry": "Retail"}
            if role == "client"
            else {"headline": "Dev", "skills": ["Python"]}
        )
        ids[sub] = api.post("/api/onboarding/", data=body, format="json", **auth(sub)).json()["data"]["id"]
    return ids


def upload(api, auth, sub="dev_ada", name="aws.pdf", content=PDF):
    file = SimpleUploadedFile(name, content, content_type="application/pdf")
    return api.post(MINE, {"file": file}, format="multipart", **auth(sub))


def test_a_developer_uploads_a_pdf_and_anyone_signed_in_sees_and_opens_it(api, auth, people):
    response = upload(api, auth)
    assert response.status_code == 201
    certificate = response.json()["data"]
    assert certificate["filename"] == "aws.pdf" and certificate["size_bytes"] == len(PDF)

    listed = api.get(f"/api/developers/{people['dev_ada']}/certificates/", **auth("client_grace"))
    assert [c["id"] for c in listed.json()["data"]] == [certificate["id"]]

    opened = api.get(
        f"/api/developers/{people['dev_ada']}/certificates/{certificate['id']}/file/", **auth("client_grace")
    )
    assert opened.status_code == 200 and opened.content == PDF
    assert opened["Content-Type"] == "application/pdf"
    assert opened["Content-Disposition"].startswith("inline")
    assert opened["X-Content-Type-Options"] == "nosniff"


@pytest.mark.parametrize(
    ("name", "content", "message"),
    [
        ("cert.docx", b"PK\x03\x04 not a pdf", "Certificates can only be PDFs"),
        ("cert.pdf", b"PK\x03\x04 renamed", "isn't a real PDF"),
        ("cert.pdf", b"%PDF-" + b"x" * 2000, "at most"),
    ],
)
def test_only_real_pdfs_within_the_size_limit_are_accepted(api, auth, people, name, content, message):
    response = upload(api, auth, name=name, content=content)
    assert response.status_code == 400
    assert message in response.json()["error"]["fields"]["file"][0]
    assert not CertificateModel.objects.exists()


def test_a_developer_has_at_most_ten(api, auth, people):
    for n in range(MAX_CERTIFICATES):
        assert upload(api, auth, name=f"c{n}.pdf").status_code == 201
    refused = upload(api, auth, name="one-more.pdf")
    assert refused.status_code == 400 and "at most 10" in refused.json()["error"]["message"]


def test_clients_have_no_certificates(api, auth, people):
    assert upload(api, auth, sub="client_grace").status_code == 403
    assert (
        api.get(f"/api/developers/{people['client_grace']}/certificates/", **auth("dev_ada")).status_code
        == 404
    )


def test_only_the_owner_removes_one(api, auth, people, tmp_path):
    certificate = upload(api, auth).json()["data"]
    assert api.delete(f"{MINE}{certificate['id']}/", **auth("dev_linus")).status_code == 404
    assert api.delete(f"{MINE}{certificate['id']}/", **auth("dev_ada")).status_code == 200
    assert not CertificateModel.objects.exists()
    assert not any(path.is_file() for path in tmp_path.rglob("*"))  # the file is gone too


def test_signed_out_people_get_nothing(api, people):
    assert api.get(f"/api/developers/{people['dev_ada']}/certificates/").status_code == 401
