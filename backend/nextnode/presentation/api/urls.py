from django.urls import path

from nextnode.presentation.api.accounts import AccountView, MeView, OnboardingView, SkillsView
from nextnode.presentation.api.conversations import (
    ConversationDetailView,
    ConversationListView,
    ConversationMessagesView,
    ConversationReadView,
)
from nextnode.presentation.api.dev_conversations import DevTestConversationView, DevTestPartnersView
from nextnode.presentation.api.payments import DepositCheckoutView, StripeWebhookView
from nextnode.presentation.api.views import HealthView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("me/", MeView.as_view(), name="me"),
    path("accounts/<int:account_id>/", AccountView.as_view(), name="account"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("skills/", SkillsView.as_view(), name="skills"),
    path("conversations/", ConversationListView.as_view(), name="conversations"),
    path("conversations/<uuid:conversation_id>/", ConversationDetailView.as_view(), name="conversation"),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        ConversationMessagesView.as_view(),
        name="conversation-messages",
    ),
    path(
        "conversations/<uuid:conversation_id>/read/",
        ConversationReadView.as_view(),
        name="conversation-read",
    ),
    # Development only (404 elsewhere): try the chat before Hire Lead exists.
    path("dev/test-partners/", DevTestPartnersView.as_view(), name="dev-test-partners"),
    path("dev/test-conversations/", DevTestConversationView.as_view(), name="dev-test-conversations"),
    path(
        "projects/<int:project_id>/deposit/checkout/",
        DepositCheckoutView.as_view(),
        name="deposit-checkout",
    ),
    path("payments/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
