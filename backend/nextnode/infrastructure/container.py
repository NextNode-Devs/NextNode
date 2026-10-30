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
from nextnode.application.conversations.dev import ListTestPartners, StartTestConversation, TestPartners
from nextnode.application.conversations.ports import (
    AccountNames,
    Clock,
    ConversationEvents,
    ConversationRepository,
    MessageRepository,
    ReadMarkers,
)
from nextnode.application.conversations.queries import GetConversation, ListConversations, ListMessages
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
from nextnode.infrastructure.access_rules import build_access_policy
from nextnode.infrastructure.auth.clerk import ClerkTokenVerifier, UnconfiguredTokenVerifier
from nextnode.infrastructure.hiring.pending_projects import ProjectsNotReadyForHiring
from nextnode.infrastructure.payments.pending_dependencies import ProjectsNotReady
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
    DjangoTestPartners,
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
from nextnode.infrastructure.realtime.conversation_events import OnCommitConversationEvents
from nextnode.infrastructure.realtime.publisher import ChannelsEventPublisher


@dataclass(frozen=True)
class Container:
    token_verifier: TokenVerifier
    database: DatabaseProbe
    payment_gateway: PaymentGateway
    payments: PaymentRepository
    webhook_events: WebhookEventLog
    uow: UnitOfWork
    deposit_terms: DepositTermsSource
    project_starter: ProjectStarter
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
    test_partners: TestPartners
    lead_projects: LeadProjects
    lead_candidacies: LeadCandidacies
    hiring_accounts: HiringAccounts

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
        return CandidacyConversations(
            self.open_conversation, self.close_conversation, self.conversations, self.account_names
        )

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
    def list_test_partners(self) -> ListTestPartners:
        """Development only."""
        return ListTestPartners(self.test_partners)

    @property
    def start_test_conversation(self) -> StartTestConversation:
        """Development only."""
        return StartTestConversation(self.test_partners, self.open_conversation)

    @property
    def handle_payment_webhook(self) -> HandlePaymentWebhook:
        return HandlePaymentWebhook(
            self.payment_gateway, self.payments, self.webhook_events, self.uow, self.project_starter
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
    gateway: PaymentGateway = (
        StripeGateway(stripe.secret_key, stripe.webhook_secret) if stripe else UnconfiguredPaymentGateway()
    )
    publisher = ChannelsEventPublisher()
    return Container(
        token_verifier=verifier,
        database=DjangoDatabaseProbe(),
        payment_gateway=gateway,
        payments=DjangoPaymentRepository(),
        webhook_events=DjangoWebhookEventLog(),
        uow=DjangoUnitOfWork(),
        # #6 replaces these with its project adapters.
        deposit_terms=ProjectsNotReady(),
        project_starter=ProjectsNotReady(),
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
        test_partners=DjangoTestPartners(),
        # #3 replaces this stand-in with its project adapter.
        lead_projects=ProjectsNotReadyForHiring(),
        lead_candidacies=DjangoLeadCandidacies(),
        hiring_accounts=DjangoHiringAccounts(),
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
