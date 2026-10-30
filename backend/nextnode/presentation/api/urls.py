from django.urls import path

from nextnode.presentation.api.accounts import AccountView, MeView, OnboardingView, SkillsView
from nextnode.presentation.api.conversations import (
    ConversationDetailView,
    ConversationListView,
    ConversationMessagesView,
    ConversationReadView,
)
from nextnode.presentation.api.dev_conversations import DevTestConversationView, DevTestPartnersView
from nextnode.presentation.api.hiring import (
    AcceptInvitationView,
    DeclineInvitationView,
    HireView,
    LeadApplicationsView,
    LeadCandidacyView,
    LeadInvitationsView,
    WithdrawApplicationView,
)
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
    # Hire Lead (#4)
    path("projects/<int:project_id>/lead-applications/", LeadApplicationsView.as_view(), name="lead-apply"),
    path("projects/<int:project_id>/lead-invitations/", LeadInvitationsView.as_view(), name="lead-invite"),
    path("lead-candidacies/<uuid:candidacy_id>/", LeadCandidacyView.as_view(), name="lead-candidacy"),
    path("lead-candidacies/<uuid:candidacy_id>/hire/", HireView.as_view(), name="lead-hire"),
    path("lead-invitations/<uuid:candidacy_id>/accept/", AcceptInvitationView.as_view(), name="lead-accept"),
    path(
        "lead-invitations/<uuid:candidacy_id>/decline/", DeclineInvitationView.as_view(), name="lead-decline"
    ),
    path(
        "lead-applications/<uuid:candidacy_id>/withdraw/",
        WithdrawApplicationView.as_view(),
        name="lead-withdraw",
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
