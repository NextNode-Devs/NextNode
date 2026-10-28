import pytest

from config.env import ImproperlyConfiguredEnv, parse

BASE = {
    "DJANGO_SECRET_KEY": "x" * 60,
    "DATABASE_URL": "postgres://user:p%40ss@db.example:6543/nextnode",
}


def test_parses_database_url_including_encoded_password():
    env = parse(BASE)
    assert (env.database.user, env.database.password, env.database.host, env.database.port) == (
        "user",
        "p@ss",
        "db.example",
        6543,
    )
    assert env.debug is False


@pytest.mark.parametrize("missing", ["DJANGO_SECRET_KEY", "DATABASE_URL"])
def test_required_variables_fail_fast_with_their_name(missing):
    source = {key: value for key, value in BASE.items() if key != missing}
    with pytest.raises(ImproperlyConfiguredEnv, match=missing):
        parse(source)


def test_only_postgres_is_accepted():
    with pytest.raises(ImproperlyConfiguredEnv, match="PostgreSQL"):
        parse({**BASE, "DATABASE_URL": "sqlite:///db.sqlite3"})


def test_production_rejects_debug_weak_secret_and_missing_clerk():
    prod = {
        **BASE,
        "DJANGO_ENV": "production",
        "DJANGO_ALLOWED_HOSTS": "api.example.com",
        "FRONTEND_ORIGIN": "https://app.example.com",
        "CLERK_ISSUER": "https://clerk.example.com",
    }
    assert parse(prod).is_production
    with pytest.raises(ImproperlyConfiguredEnv, match="DJANGO_DEBUG"):
        parse({**prod, "DJANGO_DEBUG": "true"})
    with pytest.raises(ImproperlyConfiguredEnv, match="DJANGO_SECRET_KEY"):
        parse({**prod, "DJANGO_SECRET_KEY": "short"})
    with pytest.raises(ImproperlyConfiguredEnv, match="CLERK_ISSUER"):
        parse({**prod, "CLERK_ISSUER": ""})


def test_clerk_defaults_jwks_url_and_authorized_parties():
    env = parse(
        {**BASE, "CLERK_ISSUER": "https://x.clerk.accounts.dev/", "FRONTEND_ORIGIN": "http://localhost:3000"}
    )
    assert env.clerk.jwks_url == "https://x.clerk.accounts.dev/.well-known/jwks.json"
    assert env.clerk.authorized_parties == ("http://localhost:3000",)


def test_frontend_origin_must_be_an_origin():
    with pytest.raises(ImproperlyConfiguredEnv, match="FRONTEND_ORIGIN"):
        parse({**BASE, "FRONTEND_ORIGIN": "localhost:3000/app"})
