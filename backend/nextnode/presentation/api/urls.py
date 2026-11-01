from django.urls import path

from nextnode.presentation.api.accounts import AccountView, MeView, OnboardingView, SkillsView
from nextnode.presentation.api.conversations import (
    ConversationDetailView,
    ConversationListView,
    ConversationMessagesView,
    ConversationReadView,
)
from nextnode.presentation.api.hiring import (
    AcceptInvitationView,
    DeclineInvitationView,
    HireView,
    LeadApplicationsView,
    LeadCandidacyView,
    LeadInvitationsView,
    MyLeadCandidaciesView,
    ProjectLeadChatsView,
    WithdrawApplicationView,
)
from nextnode.presentation.api.payments import DepositCheckoutView, StripeWebhookView
from nextnode.presentation.api.portfolios import (
    DeveloperDirectoryView,
    DeveloperPortfolioView,
    MyPortfolioView,
)
from nextnode.presentation.api.projects import (
    DocumentLinkView,
    FileDownloadView,
    MyProjectsView,
    ProjectDetailView,
    ProjectDocumentsView,
    ProjectIdeasView,
    ProjectsView,
)
from nextnode.presentation.api.teams import TeamSizeView
from nextnode.presentation.api.views import HealthView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("me/", MeView.as_view(), name="me"),
    path("accounts/<int:account_id>/", AccountView.as_view(), name="account"),
    path("onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("skills/", SkillsView.as_view(), name="skills"),
    # Portfolios (#2). "me/" comes first so it isn't read as an id.
    path("developers/", DeveloperDirectoryView.as_view(), name="developers"),
    path("developers/me/portfolio/", MyPortfolioView.as_view(), name="my-portfolio"),
    path("developers/<int:account_id>/", DeveloperPortfolioView.as_view(), name="developer"),
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
    # Projects and requirement documents (#3). "mine/" comes first so it isn't read as an id.
    path("projects/", ProjectsView.as_view(), name="projects"),
    path("projects/mine/", MyProjectsView.as_view(), name="my-projects"),
    path("project-ideas/", ProjectIdeasView.as_view(), name="project-ideas"),
    path("projects/<int:project_id>/", ProjectDetailView.as_view(), name="project"),
    path("projects/<int:project_id>/documents/", ProjectDocumentsView.as_view(), name="project-documents"),
    path(
        "projects/<int:project_id>/documents/<uuid:document_id>/link/",
        DocumentLinkView.as_view(),
        name="project-document-link",
    ),
    path("files/<str:token>/", FileDownloadView.as_view(), name="file-download"),
    # Hire Lead (#4)
    path("projects/<int:project_id>/lead-applications/", LeadApplicationsView.as_view(), name="lead-apply"),
    path("projects/<int:project_id>/lead-invitations/", LeadInvitationsView.as_view(), name="lead-invite"),
    path("projects/<int:project_id>/lead-chats/", ProjectLeadChatsView.as_view(), name="lead-chats"),
    path("lead-candidacies/mine/", MyLeadCandidaciesView.as_view(), name="my-lead-candidacies"),
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
    # Hire Devs (#5)
    path("projects/<int:project_id>/team/size/", TeamSizeView.as_view(), name="team-size"),
    path(
        "projects/<int:project_id>/deposit/checkout/",
        DepositCheckoutView.as_view(),
        name="deposit-checkout",
    ),
    path("payments/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
