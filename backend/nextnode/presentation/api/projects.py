"""Project endpoints (#3). Request in, one use case call, response out.

Developer ideas never show a budget: the key is left out of their payloads."""

from dataclasses import asdict
from typing import Any
from uuid import UUID

from django.http import HttpResponse
from django.utils.http import content_disposition_header
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.application.projects.documents import Upload
from nextnode.domain.errors import NotFoundError
from nextnode.infrastructure.container import get_container
from nextnode.presentation.api.project_serializers import (
    ClientBriefSerializer,
    ProjectIdeaSerializer,
    project_serializer_for,
)


def project_payload(view: Any) -> dict:
    data = asdict(view)
    if data.get("kind") == "developer":
        data.pop("proposed_budget_cents", None)
    return data


class ProjectsView(APIView):
    """GET: search ``Posted`` projects, ``?kind=&tech=react,django&needs_lead=true&open_spots=true&page=``.
    POST: a client publishes a brief."""

    def get(self, request: Request) -> Response:
        params = request.query_params
        view = get_container().search_projects.execute(
            request.user.actor,
            kind=params.get("kind"),
            tech=params.get("tech"),
            needs_lead=params.get("needs_lead"),
            open_spots=params.get("open_spots"),
            page=params.get("page"),
        )
        data = asdict(view)
        data["results"] = [project_payload(card) for card in view.results]
        return Response({"data": data})

    def post(self, request: Request) -> Response:
        body = ClientBriefSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        view = get_container().publish_client_brief.execute(request.user.actor, body.to_command())
        return Response({"data": project_payload(view)}, status=201)


class ProjectIdeasView(APIView):
    """A developer publishes an idea and becomes its Team Lead."""

    def post(self, request: Request) -> Response:
        body = ProjectIdeaSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        view = get_container().propose_project_idea.execute(request.user.actor, body.to_command())
        return Response({"data": project_payload(view)}, status=201)


class MyProjectsView(APIView):
    def get(self, request: Request) -> Response:
        views = get_container().list_my_projects.execute(request.user.actor)
        return Response(
            {"data": [{"project": project_payload(v.project), "my_role": v.my_role} for v in views]}
        )


class ProjectDetailView(APIView):
    """GET: any signed-in user. PATCH: the owner, while the project may be edited."""

    def get(self, request: Request, project_id: int) -> Response:
        view = get_container().get_project.execute(request.user.actor, project_id)
        return Response({"data": project_payload(view)})

    def patch(self, request: Request, project_id: int) -> Response:
        container = get_container()
        current = container.get_project.execute(request.user.actor, project_id)
        body = project_serializer_for(current.kind)(data=request.data)
        body.is_valid(raise_exception=True)
        view = container.edit_project.execute(request.user.actor, project_id, body.to_command())
        return Response({"data": project_payload(view)})


class ProjectDocumentsView(APIView):
    """GET: readers list the documents (others get 404). POST: the owning client
    uploads one file, as multipart field ``file``."""

    parser_classes = (MultiPartParser,)

    def get(self, request: Request, project_id: int) -> Response:
        views = get_container().list_requirement_documents.execute(request.user.actor, project_id)
        return Response({"data": [asdict(v) for v in views]})

    def post(self, request: Request, project_id: int) -> Response:
        file = request.FILES.get("file")
        upload = Upload(file.name or "", file.size or 0, file.read) if file is not None else None
        view = get_container().upload_requirement_document.execute(request.user.actor, project_id, upload)
        return Response({"data": asdict(view)}, status=201)


class DocumentLinkView(APIView):
    """A download URL for one reader, expiring after 15 minutes."""

    def get(self, request: Request, project_id: int, document_id: UUID) -> Response:
        link = get_container().get_document_link.execute(request.user.actor, project_id, document_id)
        url = request.build_absolute_uri(f"/api/files/{link.token}/")
        return Response({"data": {"url": url, "expires_at": link.expires_at}})


class FileDownloadView(APIView):
    """The signed link is the credential: a browser download carries no bearer
    token. ``DownloadDocument`` checks the signature, expiry and access."""

    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request: Request, token: str) -> HttpResponse:
        if len(token) > 1000:
            raise NotFoundError("This download link isn't valid.")
        download = get_container().download_document.execute(token)
        response = HttpResponse(download.content, content_type=download.content_type)
        response["Content-Disposition"] = content_disposition_header(True, download.filename)
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        response["Referrer-Policy"] = "no-referrer"
        return response
