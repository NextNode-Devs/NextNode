import pytest

from nextnode.domain.accounts import (
    MAX_SKILLS,
    SKILL_MAX_LENGTH,
    Account,
    ClientProfile,
    DeveloperProfile,
    Role,
    normalize_skills,
)
from nextnode.domain.errors import ValidationError


def test_skills_are_trimmed_collapsed_and_keyed_case_insensitively():
    skills = normalize_skills(["  React ", "node   js", "C#"])
    assert [(s.key, s.label) for s in skills] == [("react", "React"), ("node js", "node js"), ("c#", "C#")]


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ([], "at least one"),
        (["   "], "empty"),
        (["React", "react"], "twice"),
        (["x" * (SKILL_MAX_LENGTH + 1)], "too long"),
        (["<script>"], "characters"),
        (["snake_case"], "characters"),
        ([f"skill {i}" for i in range(MAX_SKILLS + 1)], "Too many"),
    ],
)
def test_bad_skills_are_refused_on_the_field(raw, message):
    with pytest.raises(ValidationError, match=message) as error:
        normalize_skills(raw, "developer.skills")
    assert "developer.skills" in error.value.fields


def test_developer_profile_accepts_an_optional_github_username():
    profile = DeveloperProfile.create("Backend dev", "", "@octo-cat", ["Python"])
    assert profile.github_username == "octo-cat"
    assert DeveloperProfile.create("Backend dev", "", "  ", ["Python"]).github_username is None


@pytest.mark.parametrize("username", ["-octo", "octo-", "oc--to", "o" * 40, "octo cat"])
def test_invalid_github_usernames_are_refused(username):
    with pytest.raises(ValidationError) as error:
        DeveloperProfile.create("Backend dev", "", username, ["Python"])
    assert "developer.github_username" in error.value.fields


def test_profile_text_is_required_and_bounded():
    with pytest.raises(ValidationError) as error:
        ClientProfile.create("  ", "Retail")
    assert "client.company_name" in error.value.fields
    with pytest.raises(ValidationError) as error:
        DeveloperProfile.create("h" * 121, "", None, ["Python"])
    assert "developer.headline" in error.value.fields


def test_an_account_needs_the_profile_matching_its_role():
    with pytest.raises(ValidationError):
        Account.onboard("user_1", Role.DEVELOPER, "Ada", ClientProfile("Acme", "Retail"))
    account = Account.onboard("user_1", Role.CLIENT, " Ada ", ClientProfile("Acme", "Retail"))
    assert (account.role, account.display_name) == (Role.CLIENT, "Ada")


def test_an_account_has_no_way_to_change_its_role():
    assert not any(name.startswith(("set_role", "change_role")) for name in dir(Account))
