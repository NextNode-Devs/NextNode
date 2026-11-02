"""Composition root: the one place adapters are chosen and use cases built.

Views get use cases from ``get_container()``; tests swap adapters with
``override_container()`` instead of mocking.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, replace
from typing import Any

from django.conf import settings

from nextnode.application.access import AccessPolicy
from nextnode.application.accounts.directory import DeveloperSearch, SearchDevelopers
from nextnode.application.accounts.onboarding import CompleteOnboarding
from nextnode.application.accounts.portfolio import GetPortfolio, UpdatePortfolio
from nextnode.application.accounts.ports import (
    AccountDirectory,
    AccountRepository,
    PortfolioRepository,
    SkillRepository,
)
from nextnode.application.accounts.queries import GetAccount, GetMe, ListSkills, ResolveActor
from nextnode.application.conversations.candidacies import CandidacyConversations
from nextnode.application.conversations.commands import (
    CloseConversation,
    MarkRead,
    OpenConversation,
    PostMessage,
)
from nextnode.application.conversations.ports import (
    AccountNames,
    Clock,
    ConversationEvents,
    ConversationRepository,
    MessageRepository,
    ReadMarkers,
)
from nextnode.application.conversations.queries import GetConversation, ListConversations, ListMessages
from nextnode.application.conversations.workspace import TeamWorkspaceChats
from nextnode.application.health import CheckHealth
from nextnode.application.hiring.lead import (
    AcceptLeadInvitation,
    ApplyToLead,
    DeclineLeadInvitation,
    GetLeadCandidacy,
    HireLeadDeps,
    HireTeamLead,
    InviteToLead,
    WithdrawLeadApplication,
)
from nextnode.application.hiring.ports import HiringAccounts, LeadCandidacies, LeadProjects
from nextnode.application.hiring.queries import ListMyLeadCandidacies, ListProjectLeadChats
from nextnode.application.payments.checkout import StartDepositCheckout
from nextnode.application.payments.ports import (
    DepositTermsSource,
    PaymentGateway,
    PaymentRepository,
    ProjectStarter,
    UnitOfWork,
    WebhookEventLog,
)
from nextnode.application.payments.status import DepositStatusQuery
from nextnode.application.payments.webhook import HandlePaymentWebhook
from nextnode.application.ports import DatabaseProbe, RealtimePublisher, TokenVerifier
from nextnode.application.projects.commands import (
    EditProject,
    ProjectDeps,
    ProposeProjectIdea,
    PublishClientBrief,
)
from nextnode.application.projects.documents import (
    DocumentDeps,
    DownloadDocument,
    GetDocumentLink,
    ListRequirementDocuments,
    UploadRequirementDocument,
)
from nextnode.application.projects.ports import DocumentRepository, FileStorage, LinkSigner, ProjectRepository
from nextnode.application.projects.queries import GetProject, ListMyProjects, SearchProjects
from nextnode.application.start_gate.deps import StartGateDeps
from nextnode.application.start_gate.ports import OfferRepository, TimelineRepository
from nextnode.application.start_gate.use_cases import StartGateUseCases
from nextnode.application.teams.deps import TeamDeps
from nextnode.application.teams.ports import CandidacyRepository, TeamMembers
from nextnode.application.teams.queries import GetTeam
from nextnode.application.teams.use_cases import TeamUseCases
from nextnode.domain.projects import UploadLimits
from nextnode.infrastructure.access_rules import build_access_policy
from nextnode.infrastructure.auth.clerk import ClerkTokenVerifier, UnconfiguredTokenVerifier
from nextnode.infrastructure.payments.fake_checkout import FakeCheckoutGateway
from nextnode.infrastructure.payments.stripe_gateway import StripeGateway, UnconfiguredPaymentGateway
from nextnode.infrastructure.persistence.accounts import (
    DjangoAccountDirectory,
    DjangoAccountRepository,
    DjangoSkillRepository,
)
from nextnode.infrastructure.persistence.conversations import (
    DjangoAccountNames,
    DjangoConversationRepository,
    DjangoMessageRepository,
    DjangoReadMarkers,
    SystemClock,
)
from nextnode.infrastructure.persistence.database_probe import DjangoDatabaseProbe
from nextnode.infrastructure.persistence.hiring import DjangoHiringAccounts, DjangoLeadCandidacies
from nextnode.infrastructure.persistence.payments import (
    DjangoPaymentRepository,
    DjangoUnitOfWork,
    DjangoWebhookEventLog,
)
from nextnode.infrastructure.persistence.portfolios import DjangoDeveloperSearch, DjangoPortfolioRepository
from nextnode.infrastructure.persistence.projects import (
    DjangoDocumentRepository,
    DjangoLeadProjects,
    DjangoProjectRepository,
)
from nextnode.infrastructure.persistence.start_gate import (
    DjangoDepositTerms,
    DjangoOfferRepository,
    DjangoTimelineRepository,
)
from nextnode.infrastructure.persistence.teams import DjangoTeamCandidacies, DjangoTeamMembers
from nextnode.infrastructure.realtime.conversation_events import OnCommitConversationEvents
from nextnode.infrastructure.realtime.publisher import ChannelsEventPublisher
from nextnode.infrastructure.storage.links import DjangoLinkSigner
from nextnode.infrastructure.storage.local import LocalPrivateStorage


@dataclass(frozen=True)
class Container:
    token_verifier: TokenVerifier
    database: DatabaseProbe
    payment_gateway: PaymentGateway
    payments: PaymentRepository
    webhook_events: WebhookEventLog
    uow: UnitOfWork
    deposit_terms: DepositTermsSource
    accounts: AccountRepository
    skills: SkillRepository
    portfolios: PortfolioRepository
    developer_search: DeveloperSearch
    account_directory: AccountDirectory
    access_policy: AccessPolicy
    realtime: RealtimePublisher
    conversations: ConversationRepository
    messages: MessageRepository
    read_markers: ReadMarkers
    account_names: AccountNames
    conversation_events: ConversationEvents
    clock: Clock
    lead_projects: LeadProjects
    lead_candidacies: LeadCandidacies
    hiring_accounts: HiringAccounts
    projects: ProjectRepository
    documents: DocumentRepository
    file_storage: FileStorage
    link_signer: LinkSigner
    upload_limits: UploadLimits
    team_candidacies: CandidacyRepository
    team_members: TeamMembers
    offers: OfferRepository
    timelines: TimelineRepository
    project_starter: ProjectStarter | None = None  # tests only; otherwise #6's start use case

    @property
    def get_account(self) -> GetAccount:
        return GetAccount(self.accounts, self.access_policy)

    @property
    def check_health(self) -> CheckHealth:
        return CheckHealth(self.database, self.token_verifier)

    @property
    def resolve_actor(self) -> ResolveActor:
        return ResolveActor(self.accounts)

    @property
    def get_me(self) -> GetMe:
        return GetMe(self.accounts)

    @property
    def complete_onboarding(self) -> CompleteOnboarding:
        return CompleteOnboarding(self.accounts, self.skills, self.uow)

    @property
    def list_skills(self) -> ListSkills:
        return ListSkills(self.skills)

    # --- portfolios (#2) ----------------------------------------------------------

    @property
    def get_portfolio(self) -> GetPortfolio:
        return GetPortfolio(self.portfolios, self.access_policy)

    @property
    def update_portfolio(self) -> UpdatePortfolio:
        return UpdatePortfolio(self.portfolios, self.skills, self.access_policy, self.uow)

    @property
    def search_developers(self) -> SearchDevelopers:
        return SearchDevelopers(self.developer_search, self.access_policy)

    # --- hiring conversations (#4) ---------------------------------------------

    @property
    def open_conversation(self) -> OpenConversation:
        return OpenConversation(self.conversations, self.account_names, self.conversation_events, self.uow)

    @property
    def post_message(self) -> PostMessage:
        return PostMessage(
            self.conversations, self.messages, self.read_markers, self.conversation_events, self.uow
        )

    @property
    def mark_read(self) -> MarkRead:
        return MarkRead(self.conversations, self.messages, self.read_markers)

    @property
    def close_conversation(self) -> CloseConversation:
        return CloseConversation(self.conversations, self.conversation_events, self.uow, self.clock)

    @property
    def list_conversations(self) -> ListConversations:
        return ListConversations(self.conversations, self.account_names)

    @property
    def get_conversation(self) -> GetConversation:
        return GetConversation(self.conversations, self.account_names)

    @property
    def list_messages(self) -> ListMessages:
        return ListMessages(self.conversations, self.messages)

    @property
    def candidacy_conversations(self) -> CandidacyConversations:
        """#5's ``HiringConversations`` port."""
        return CandidacyConversations(self.open_conversation, self.close_conversation, self.conversations)

    # --- Hire Lead (#4) -----------------------------------------------------------

    @property
    def _hire_lead(self) -> HireLeadDeps:
        return HireLeadDeps(
            projects=self.lead_projects,
            candidacies=self.lead_candidacies,
            accounts=self.hiring_accounts,
            conversations=self.conversations,
            open_conversation=self.open_conversation,
            close_conversation=self.close_conversation,
            events=self.conversation_events,
            clock=self.clock,
            uow=self.uow,
        )

    @property
    def apply_to_lead(self) -> ApplyToLead:
        return ApplyToLead(self._hire_lead)

    @property
    def invite_to_lead(self) -> InviteToLead:
        return InviteToLead(self._hire_lead)

    @property
    def accept_lead_invitation(self) -> AcceptLeadInvitation:
        return AcceptLeadInvitation(self._hire_lead)

    @property
    def decline_lead_invitation(self) -> DeclineLeadInvitation:
        return DeclineLeadInvitation(self._hire_lead)

    @property
    def withdraw_lead_application(self) -> WithdrawLeadApplication:
        return WithdrawLeadApplication(self._hire_lead)

    @property
    def hire_team_lead(self) -> HireTeamLead:
        return HireTeamLead(self._hire_lead)

    @property
    def get_lead_candidacy(self) -> GetLeadCandidacy:
        return GetLeadCandidacy(self._hire_lead)

    @property
    def list_project_lead_chats(self) -> ListProjectLeadChats:
        return ListProjectLeadChats(self._hire_lead, self.account_names)

    @property
    def list_my_lead_candidacies(self) -> ListMyLeadCandidacies:
        return ListMyLeadCandidacies(self._hire_lead, self.account_names)

    # --- projects and requirement documents (#3) ------------------------------------

    @property
    def _project(self) -> ProjectDeps:
        return ProjectDeps(self.projects, self.skills, self.access_policy, self.clock, self.uow)

    @property
    def publish_client_brief(self) -> PublishClientBrief:
        return PublishClientBrief(self._project)

    @property
    def propose_project_idea(self) -> ProposeProjectIdea:
        return ProposeProjectIdea(self._project)

    @property
    def edit_project(self) -> EditProject:
        return EditProject(self._project)

    @property
    def get_project(self) -> GetProject:
        return GetProject(self._project)

    @property
    def search_projects(self) -> SearchProjects:
        return SearchProjects(self.projects, self.access_policy)

    @property
    def list_my_projects(self) -> ListMyProjects:
        return ListMyProjects(self.projects)

    @property
    def _documents(self) -> DocumentDeps:
        return DocumentDeps(
            projects=self.projects,
            documents=self.documents,
            storage=self.file_storage,
            signer=self.link_signer,
            policy=self.access_policy,
            clock=self.clock,
            uow=self.uow,
            limits=self.upload_limits,
        )

    @property
    def upload_requirement_document(self) -> UploadRequirementDocument:
        return UploadRequirementDocument(self._documents)

    @property
    def list_requirement_documents(self) -> ListRequirementDocuments:
        return ListRequirementDocuments(self._documents)

    @property
    def get_document_link(self) -> GetDocumentLink:
        return GetDocumentLink(self._documents)

    @property
    def download_document(self) -> DownloadDocument:
        return DownloadDocument(self._documents)

    # --- Hire Devs (#5) ---------------------------------------------------------------

    @property
    def teams(self) -> TeamUseCases:
        return TeamUseCases(
            TeamDeps(
                projects=self.projects,
                candidacies=self.team_candidacies,
                accounts=self.account_directory,
                conversations=self.candidacy_conversations,
                events=self.conversation_events,
                names=self.account_names,
                clock=self.clock,
                uow=self.uow,
            )
        )

    @property
    def get_team(self) -> GetTeam:
        return GetTeam(self.projects, self.team_members, self.access_policy)

    # --- project start gate (#6) -----------------------------------------------------

    @property
    def start_gate(self) -> StartGateUseCases:
        return StartGateUseCases(
            StartGateDeps(
                projects=self.projects,
                offers=self.offers,
                timelines=self.timelines,
                deposits=self.deposit_status,
                workspace=TeamWorkspaceChats(self.open_conversation, self.conversations),
                recruitment=self.teams.close_recruitment,
                clock=self.clock,
                uow=self.uow,
                deposit_percent=settings.ENV.deposit_percent,
            )
        )

    @property
    def handle_payment_webhook(self) -> HandlePaymentWebhook:
        return HandlePaymentWebhook(
            self.payment_gateway,
            self.payments,
            self.webhook_events,
            self.uow,
            self.project_starter or self.start_gate.start_client_project,
        )

    @property
    def start_deposit_checkout(self) -> StartDepositCheckout:
        return StartDepositCheckout(
            self.deposit_terms,
            self.payments,
            self.payment_gateway,
            self.uow,
            deposit_percent=settings.ENV.deposit_percent,
            frontend_origin=settings.ENV.frontend_origins[0],
        )

    @property
    def deposit_status(self) -> DepositStatusQuery:
        return DepositStatusQuery(self.payments)


def build_container() -> Container:
    clerk = settings.ENV.clerk
    verifier: TokenVerifier = (
        ClerkTokenVerifier(
            issuer=clerk.issuer,
            authorized_parties=clerk.authorized_parties,
            jwks_url=clerk.jwks_url,
        )
        if clerk
        else UnconfiguredTokenVerifier()
    )
    stripe = settings.ENV.stripe
    gateway: PaymentGateway
    if stripe is None:
        gateway = UnconfiguredPaymentGateway()
    elif stripe.fake_checkout:
        gateway = FakeCheckoutGateway(stripe.webhook_secret)
    else:
        gateway = StripeGateway(stripe.secret_key, stripe.webhook_secret)
    publisher = ChannelsEventPublisher()
    projects = DjangoProjectRepository()
    uploads = settings.ENV.uploads
    return Container(
        token_verifier=verifier,
        database=DjangoDatabaseProbe(),
        payment_gateway=gateway,
        payments=DjangoPaymentRepository(),
        webhook_events=DjangoWebhookEventLog(),
        uow=DjangoUnitOfWork(),
        deposit_terms=DjangoDepositTerms(),
        accounts=DjangoAccountRepository(),
        skills=DjangoSkillRepository(),
        portfolios=DjangoPortfolioRepository(),
        developer_search=DjangoDeveloperSearch(),
        account_directory=DjangoAccountDirectory(),
        access_policy=build_access_policy(),
        realtime=publisher,
        conversations=DjangoConversationRepository(),
        messages=DjangoMessageRepository(),
        read_markers=DjangoReadMarkers(),
        account_names=DjangoAccountNames(),
        conversation_events=OnCommitConversationEvents(publisher),
        clock=SystemClock(),
        lead_projects=DjangoLeadProjects(projects),
        lead_candidacies=DjangoLeadCandidacies(),
        hiring_accounts=DjangoHiringAccounts(),
        projects=projects,
        documents=DjangoDocumentRepository(),
        file_storage=LocalPrivateStorage(uploads.private_media_root),
        link_signer=DjangoLinkSigner(),
        upload_limits=UploadLimits(uploads.max_bytes, uploads.max_files_per_project),
        team_candidacies=DjangoTeamCandidacies(),
        team_members=DjangoTeamMembers(),
        offers=DjangoOfferRepository(),
        timelines=DjangoTimelineRepository(),
    )


_container: Container | None = None


def get_container() -> Container:
    global _container
    if _container is None:
        _container = build_container()
    return _container


@contextmanager
def override_container(**adapters: Any) -> Iterator[Container]:
    global _container
    previous = get_container()
    _container = replace(previous, **adapters)
    try:
        yield _container
    finally:
        _container = previous
