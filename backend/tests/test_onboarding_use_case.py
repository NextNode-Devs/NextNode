"""CompleteOnboarding, GetMe, ResolveActor and ListSkills with in-memory fakes."""

from datetime import UTC, datetime

import pytest

from nextnode.application.accounts.onboarding import (
    ClientDetails,
    CompleteOnboarding,
    DeveloperDetails,
    OnboardingCommand,
)
from nextnode.application.accounts.queries import GetMe, ListSkills, ResolveActor
from nextnode.application.ports import Actor, VerifiedSession
from nextnode.domain.accounts import AlreadyOnboardedError, Role
from nextnode.domain.errors import ValidationError
from tests.account_fakes import InMemoryAccounts, InMemoryDirectory, InMemorySkills, NoTransaction

ACTOR = Actor(clerk_user_id="user_1", session_id="sess_1")
CLIENT = OnboardingCommand("client", "Grace", client=ClientDetails("Acme Ltd", "Retail"))
DEVELOPER = OnboardingCommand(
    "developer",
    "Ada",
    developer=DeveloperDetails("Full-stack developer", "I build things.", "ada", ["react", "Python"]),
)


@pytest.fixture
def accounts() -> InMemoryAccounts:
    return InMemoryAccounts()


@pytest.fixture
def skills() -> InMemorySkills:
    return InMemorySkills("React")


@pytest.fixture
def onboard(accounts, skills) -> CompleteOnboarding:
    return CompleteOnboarding(accounts, skills, NoTransaction())


def test_a_client_is_onboarded_once(onboard, accounts):
    view = onboard.execute(ACTOR, CLIENT)
    assert (view.role, view.display_name, view.profile.company_name) == ("client", "Grace", "Acme Ltd")
    assert list(accounts.rows) == ["user_1"]


def test_a_developer_reuses_the_existing_spelling_of_a_skill(onboard, skills):
    view = onboard.execute(ACTOR, DEVELOPER)
    assert [s.label for s in view.profile.skills] == ["React", "Python"]
    assert skills.rows == {"react": "React", "python": "Python"}


def test_the_role_can_never_be_chosen_again(onboard, accounts):
    onboard.execute(ACTOR, CLIENT)
    with pytest.raises(AlreadyOnboardedError, match="already set up as a client"):
        onboard.execute(ACTOR, DEVELOPER)
    assert accounts.rows["user_1"].role is Role.CLIENT


def test_a_lost_race_is_reported_as_already_onboarded(onboard, accounts):
    accounts.fail_with_race = True
    with pytest.raises(AlreadyOnboardedError):
        onboard.execute(ACTOR, CLIENT)


@pytest.mark.parametrize(
    ("command", "field"),
    [
        (OnboardingCommand("admin", "Ada"), "role"),
        (OnboardingCommand("client", "Ada"), "client"),
        (OnboardingCommand("client", "Ada", client=CLIENT.client, developer=DEVELOPER.developer), "client"),
        (OnboardingCommand("developer", "Ada", client=CLIENT.client), "developer"),
        (OnboardingCommand("client", "  ", client=CLIENT.client), "display_name"),
    ],
)
def test_invalid_onboarding_is_refused_and_stores_nothing(onboard, accounts, command, field):
    with pytest.raises(ValidationError) as error:
        onboard.execute(ACTOR, command)
    assert field in error.value.fields
    assert accounts.rows == {}


def test_me_reports_no_account_before_onboarding_and_the_account_after(onboard, accounts):
    me = GetMe(accounts)
    assert me.execute(ACTOR).account is None
    onboard.execute(ACTOR, CLIENT)
    assert me.execute(ACTOR).account.role == "client"


def test_the_actor_carries_account_and_role_once_onboarded(onboard, accounts):
    session = VerifiedSession("user_1", "sess_1", datetime(2026, 10, 29, tzinfo=UTC))
    assert ResolveActor(accounts).execute(session).role is None
    onboard.execute(ACTOR, DEVELOPER)
    actor = ResolveActor(accounts).execute(session)
    assert (actor.account_id, actor.role) == (1, Role.DEVELOPER)
    assert InMemoryDirectory(accounts).is_developer("user_1")


def test_skills_search_puts_prefix_matches_first(skills):
    skills.rows.update({"preact": "Preact", "react native": "React Native"})
    labels = [s.label for s in ListSkills(skills).execute("  REACT ")]
    assert labels == ["React", "React Native", "Preact"]
