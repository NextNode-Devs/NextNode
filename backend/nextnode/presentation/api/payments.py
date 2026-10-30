"""Payment endpoints: the client's deposit checkout and Stripe's webhook."""

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


class DepositCheckoutView(APIView):
    """The project's client opens Stripe Checkout for the deposit. The body is
    ignored: the amount comes from the accepted offer on the server."""

    def post(self, request: Request, project_id: int) -> Response:
        checkout = get_container().start_deposit_checkout.execute(request.user.actor, project_id)
        return Response({"data": asdict(checkout)})
