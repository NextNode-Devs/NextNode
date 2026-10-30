"""Account endpoints: who am I, onboarding, and the skills vocabulary."""

from dataclasses import asdict

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.infrastructure.container import get_container
from nextnode.presentation.api.account_serializers import OnboardingSerializer


class MeView(APIView):
    """The verified Clerk user and their account, or ``account: null`` before
    onboarding. Requires a valid token."""

    def get(self, request: Request) -> Response:
        me = get_container().get_me.execute(request.user.actor)
        return Response({"data": asdict(me)})


class AccountView(APIView):
    """One account, through the shared access policy: today only your own."""

    def get(self, request: Request, account_id: int) -> Response:
        account = get_container().get_account.execute(request.user.actor, account_id)
        return Response({"data": asdict(account)})


class OnboardingView(APIView):
    """Creates the caller's one account. A second attempt answers 409."""

    def post(self, request: Request) -> Response:
        serializer = OnboardingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = get_container().complete_onboarding.execute(request.user.actor, serializer.to_command())
        return Response({"data": asdict(account)}, status=201)


class SkillsView(APIView):
    """``?q=`` narrows the list; prefix matches come first."""

    def get(self, request: Request) -> Response:
        skills = get_container().list_skills.execute(request.query_params.get("q"))
        return Response({"data": [asdict(skill) for skill in skills]})
