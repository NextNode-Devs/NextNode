"""Portfolio endpoints (#2). Request in, one use case call, response out."""

from dataclasses import asdict

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.domain.errors import ForbiddenError
from nextnode.infrastructure.container import get_container
from nextnode.presentation.api.portfolio_serializers import PortfolioSerializer


def _update(request: Request, account_id: int) -> Response:
    serializer = PortfolioSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    view = get_container().update_portfolio.execute(request.user.actor, account_id, serializer.to_command())
    return Response({"data": asdict(view)})


class DeveloperDirectoryView(APIView):
    """``?q=&skills=react,django&available=true&page=2``. Skills are keys
    (case-insensitive); a developer must have every one listed."""

    def get(self, request: Request) -> Response:
        params = request.query_params
        view = get_container().search_developers.execute(
            request.user.actor,
            q=params.get("q"),
            skills=params.get("skills"),
            available=params.get("available"),
            page=params.get("page"),
        )
        return Response({"data": asdict(view)})


class DeveloperPortfolioView(APIView):
    """GET: any signed-in user views a developer's portfolio.
    PUT: only its owner; anyone else gets 403."""

    def get(self, request: Request, account_id: int) -> Response:
        view = get_container().get_portfolio.execute(request.user.actor, account_id)
        return Response({"data": asdict(view)})

    def put(self, request: Request, account_id: int) -> Response:
        return _update(request, account_id)


class MyPortfolioView(APIView):
    """The signed-in developer's own portfolio, without needing their id."""

    def get(self, request: Request) -> Response:
        actor = request.user.actor
        if actor.account_id is None:
            raise ForbiddenError("Finish setting up your account first.")
        view = get_container().get_portfolio.execute(actor, actor.account_id)
        return Response({"data": asdict(view)})

    def put(self, request: Request) -> Response:
        actor = request.user.actor
        if actor.account_id is None:
            raise ForbiddenError("Finish setting up your account first.")
        return _update(request, actor.account_id)
