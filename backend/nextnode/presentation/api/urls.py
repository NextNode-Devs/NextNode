from django.urls import path

from nextnode.presentation.api.accounts import AccountView, MeView, OnboardingView, SkillsView
from nextnode.presentation.api.payments import DepositCheckoutView, StripeWebhookView
from nextnode.presentation.api.views import HealthView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("me/", MeView.as_view(), name="me"),
    path("accounts/<int:account_id>/", AccountView.as_view(), name="account"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("skills/", SkillsView.as_view(), name="skills"),
    path(
        "projects/<int:project_id>/deposit/checkout/",
        DepositCheckoutView.as_view(),
        name="deposit-checkout",
    ),
    path("payments/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
