from django.urls import path

from nextnode.presentation.api.payments import DepositCheckoutView, StripeWebhookView
from nextnode.presentation.api.views import HealthView, MeView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("me/", MeView.as_view(), name="me"),
    path(
        "projects/<int:project_id>/deposit/checkout/",
        DepositCheckoutView.as_view(),
        name="deposit-checkout",
    ),
    path("payments/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
