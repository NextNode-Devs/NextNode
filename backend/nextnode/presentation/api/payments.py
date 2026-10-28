"""Payment endpoints. The deposit checkout route arrives with #6."""

from dataclasses import asdict

from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nextnode.infrastructure.container import get_container


class StripeWebhookView(APIView):
    """Stripe's signature is the authentication: no Clerk token, and no CSRF
    check (DRF views are CSRF-exempt unless SessionAuthentication is used, and
    it is not). The raw body is verified, so ``request.data`` is never read."""

    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request: Request) -> Response:
        outcome = get_container().handle_payment_webhook.execute(
            request.body, request.headers.get("Stripe-Signature")
        )
        return Response({"data": asdict(outcome)})
