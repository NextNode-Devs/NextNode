from django.urls import path

from nextnode.presentation.api import certificates, milestones, notifications, start_gate, stewardship, teams
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
    path("developers/me/certificates/", certificates.MyCertificatesView.as_view(), name="my-certificates"),
    path(
        "developers/me/certificates/<uuid:certificate_id>/",
        certificates.MyCertificateView.as_view(),
        name="my-certificate",
    ),
    path(
        "developers/<int:account_id>/certificates/",
        certificates.DeveloperCertificatesView.as_view(),
        name="developer-certificates",
    ),
    path(
        "developers/<int:account_id>/certificates/<uuid:certificate_id>/file/",
        certificates.CertificateFileView.as_view(),
        name="certificate-file",
    ),
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
    path("projects/<int:project_id>/team/", teams.TeamView.as_view(), name="team"),
    path("projects/<int:project_id>/team/size/", teams.TeamSizeView.as_view(), name="team-size"),
    path("team-candidacies/mine/", teams.MyTeamCandidaciesView.as_view(), name="my-team-candidacies"),
    path("team-candidacies/<uuid:candidacy_id>/", teams.TeamCandidacyView.as_view(), name="team-candidacy"),
    path(
        "projects/<int:project_id>/team/applications/",
        teams.TeamApplicationsView.as_view(),
        name="team-apply",
    ),
    path(
        "projects/<int:project_id>/team/invitations/", teams.TeamInvitationsView.as_view(), name="team-invite"
    ),
    path(
        "team-invitations/<uuid:candidacy_id>/accept/",
        teams.AcceptInvitationView.as_view(),
        name="team-invitation-accept",
    ),
    path(
        "team-invitations/<uuid:candidacy_id>/decline/",
        teams.DeclineInvitationView.as_view(),
        name="team-invitation-decline",
    ),
    path(
        "team-applications/<uuid:candidacy_id>/accept/",
        teams.AcceptApplicationView.as_view(),
        name="team-application-accept",
    ),
    path(
        "team-applications/<uuid:candidacy_id>/reject/",
        teams.RejectApplicationView.as_view(),
        name="team-application-reject",
    ),
    path(
        "team-applications/<uuid:candidacy_id>/withdraw/",
        teams.WithdrawApplicationView.as_view(),
        name="team-application-withdraw",
    ),
    # Project start gate (#6)
    path("projects/<int:project_id>/start/", start_gate.StartGateView.as_view(), name="start-gate"),
    path(
        "projects/<int:project_id>/close-proposal/",
        start_gate.CloseProposalView.as_view(),
        name="close-proposal",
    ),
    path("projects/<int:project_id>/offers/", start_gate.OffersView.as_view(), name="offers"),
    path(
        "projects/<int:project_id>/offers/deposit-preview/",
        start_gate.DepositPreviewView.as_view(),
        name="offer-deposit-preview",
    ),
    path("projects/<int:project_id>/milestones/", start_gate.MilestonesView.as_view(), name="milestones"),
    # Notifications (A3, #177)
    path("notifications/", notifications.NotificationsView.as_view(), name="notifications"),
    path("notifications/read-all/", notifications.MarkAllReadView.as_view(), name="notifications-read-all"),
    path(
        "notifications/settings/",
        notifications.NotificationSettingsView.as_view(),
        name="notification-settings",
    ),
    path(
        "notifications/<int:notification_id>/read/",
        notifications.MarkReadView.as_view(),
        name="notification-read",
    ),
    # Milestone delivery and review (A2, #176)
    path(
        "projects/<int:project_id>/milestones/reviews/",
        milestones.MilestoneBoardView.as_view(),
        name="milestone-board",
    ),
    path(
        "milestones/<int:milestone_id>/submit/",
        milestones.SubmitMilestoneView.as_view(),
        name="milestone-submit",
    ),
    path(
        "milestones/<int:milestone_id>/approve/",
        milestones.ApproveMilestoneView.as_view(),
        name="milestone-approve",
    ),
    path(
        "milestones/<int:milestone_id>/request-revision/",
        milestones.RequestRevisionView.as_view(),
        name="milestone-request-revision",
    ),
    path("offers/<int:offer_id>/accept/", start_gate.AcceptOfferView.as_view(), name="offer-accept"),
    path("offers/<int:offer_id>/decline/", start_gate.DeclineOfferView.as_view(), name="offer-decline"),
    path("projects/<int:project_id>/timeline/", start_gate.TimelineView.as_view(), name="timeline"),
    path(
        "projects/<int:project_id>/deposit/checkout/",
        DepositCheckoutView.as_view(),
        name="deposit-checkout",
    ),
    path("payments/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    # Assistant Lead and inactivity on developer projects (NN-39)
    path("projects/<int:project_id>/stewardship/", stewardship.StewardshipView.as_view(), name="stewardship"),
    path(
        "projects/<int:project_id>/assistant-lead/",
        stewardship.AssistantLeadView.as_view(),
        name="assistant-lead",
    ),
    path(
        "projects/<int:project_id>/activity-check/confirm/",
        stewardship.ConfirmActiveView.as_view(),
        name="activity-confirm",
    ),
    path("projects/<int:project_id>/close/", stewardship.CloseProjectView.as_view(), name="project-close"),
]
