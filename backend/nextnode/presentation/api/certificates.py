"""Portfolio certificates over REST (NN-34, #102). PDF only."""

from dataclasses import asdict
from uuid import UUID

from django.http import HttpResponse
from django.utils.http import content_disposition_header
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.application.projects.documents import Upload
from nextnode.infrastructure.container import get_container


class MyCertificatesView(APIView):
    """POST: the developer uploads one PDF, as multipart field ``file``."""

    parser_classes = (MultiPartParser,)

    def post(self, request: Request) -> Response:
        file = request.FILES.get("file")
        upload = Upload(file.name or "", file.size or 0, file.read) if file is not None else None
        view = get_container().portfolio_certificates.upload.execute(request.user.actor, upload)
        return Response({"data": asdict(view)}, status=201)


class MyCertificateView(APIView):
    """DELETE: the developer removes one of their certificates."""

    def delete(self, request: Request, certificate_id: UUID) -> Response:
        view = get_container().portfolio_certificates.delete.execute(request.user.actor, certificate_id)
        return Response({"data": asdict(view)})


class DeveloperCertificatesView(APIView):
    """GET: a developer's certificates, oldest first."""

    def get(self, request: Request, account_id: int) -> Response:
        views = get_container().portfolio_certificates.list.execute(request.user.actor, account_id)
        return Response({"data": [asdict(v) for v in views]})


class CertificateFileView(APIView):
    """GET: the PDF itself, shown inline for the preview. It needs the bearer
    token like every other API call, so the browser fetches it, never links to it."""

    def get(self, request: Request, account_id: int, certificate_id: UUID) -> HttpResponse:
        file = get_container().portfolio_certificates.open.execute(
            request.user.actor, account_id, certificate_id
        )
        response = HttpResponse(file.content, content_type=file.content_type)
        response["Content-Disposition"] = content_disposition_header(False, file.filename)
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        return response
