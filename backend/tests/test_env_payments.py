import pytest

from config.env import ImproperlyConfiguredEnv, parse

BASE = {
    "DJANGO_SECRET_KEY": "x" * 60,
    "DATABASE_URL": "postgres://user:pass@localhost:5432/nextnode",
}
TEST_KEYS = {"STRIPE_SECRET_KEY": "sk_test_abc", "STRIPE_WEBHOOK_SECRET": "whsec_abc"}
PRODUCTION = {
    **BASE,
    "DJANGO_ENV": "production",
    "DJANGO_ALLOWED_HOSTS": "api.example.com",
    "FRONTEND_ORIGIN": "https://app.example.com",
    "CLERK_ISSUER": "https://clerk.example.com",
}


def test_payments_are_off_without_keys_and_deposit_defaults_to_20():
    env = parse(BASE)
    assert env.stripe is None
    assert env.deposit_percent == 20


def test_test_keys_are_accepted_and_never_printed():
    env = parse({**BASE, **TEST_KEYS})
    assert env.stripe.secret_key == "sk_test_abc"
    assert "sk_test_abc" not in repr(env) and "whsec_abc" not in repr(env)


@pytest.mark.parametrize("missing", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"])
def test_both_stripe_keys_or_neither(missing):
    with pytest.raises(ImproperlyConfiguredEnv, match="both"):
        parse({**BASE, **TEST_KEYS, missing: ""})


@pytest.mark.parametrize("environment", ["development", "test"])
def test_live_key_is_refused_outside_production(environment):
    with pytest.raises(ImproperlyConfiguredEnv, match="live key"):
        parse({**BASE, **TEST_KEYS, "DJANGO_ENV": environment, "STRIPE_SECRET_KEY": "sk_live_abc"})


def test_live_key_is_allowed_only_in_production():
    assert parse({**PRODUCTION, **TEST_KEYS, "STRIPE_SECRET_KEY": "sk_live_abc"}).stripe


@pytest.mark.parametrize(
    ("name", "value"),
    [("STRIPE_SECRET_KEY", "pk_test_abc"), ("STRIPE_WEBHOOK_SECRET", "abc")],
)
def test_wrong_kind_of_stripe_value_is_refused(name, value):
    with pytest.raises(ImproperlyConfiguredEnv, match=name):
        parse({**BASE, **TEST_KEYS, name: value})


def test_deposit_percent_is_configurable():
    assert parse({**BASE, "DEPOSIT_PERCENT": "25"}).deposit_percent == 25


@pytest.mark.parametrize("value", ["0", "101", "20.5", "twenty"])
def test_deposit_percent_must_be_1_to_100(value):
    with pytest.raises(ImproperlyConfiguredEnv, match="DEPOSIT_PERCENT"):
        parse({**BASE, "DEPOSIT_PERCENT": value})
