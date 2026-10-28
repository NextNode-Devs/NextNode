"""The only module that reads ``os.environ``.

Every setting is parsed and validated here when Django starts, so a bad
environment fails immediately with a message naming the variable. New
variables go in this module and in ``backend/.env.example``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENVIRONMENTS = ("development", "test", "production")


class ImproperlyConfiguredEnv(RuntimeError):
    pass


@dataclass(frozen=True)
class Database:
    name: str
    user: str
    password: str
    host: str
    port: int


@dataclass(frozen=True)
class Clerk:
    issuer: str
    jwks_url: str
    authorized_parties: tuple[str, ...]


@dataclass(frozen=True)
class Env:
    environment: str
    debug: bool
    secret_key: str
    allowed_hosts: tuple[str, ...]
    frontend_origins: tuple[str, ...]
    database: Database
    clerk: Clerk | None

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


def _required(source: dict[str, str], name: str) -> str:
    value = source.get(name, "").strip()
    if not value:
        raise ImproperlyConfiguredEnv(f"{name} is required. See backend/.env.example.")
    return value


def _bool(source: dict[str, str], name: str, default: bool) -> bool:
    raw = source.get(name, "").strip().lower()
    if not raw:
        return default
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    raise ImproperlyConfiguredEnv(f"{name} must be true or false, got {raw!r}.")


def _list(source: dict[str, str], name: str, default: str = "") -> tuple[str, ...]:
    return tuple(item.strip() for item in source.get(name, default).split(",") if item.strip())


def _origin(value: str, name: str) -> str:
    parts = urlsplit(value)
    if parts.scheme not in ("http", "https") or not parts.netloc or parts.path not in ("", "/"):
        raise ImproperlyConfiguredEnv(
            f"{name} must be an origin like https://app.example.com, got {value!r}."
        )
    return f"{parts.scheme}://{parts.netloc}"


def _database(url: str) -> Database:
    parts = urlsplit(url)
    if parts.scheme not in ("postgres", "postgresql") or not parts.hostname or not parts.path.strip("/"):
        raise ImproperlyConfiguredEnv(
            "DATABASE_URL must look like postgres://user:password@host:5432/dbname (PostgreSQL only)."
        )
    return Database(
        name=parts.path.lstrip("/"),
        user=unquote(parts.username or ""),
        password=unquote(parts.password or ""),
        host=parts.hostname,
        port=parts.port or 5432,
    )


def _clerk(source: dict[str, str], frontend_origins: tuple[str, ...], production: bool) -> Clerk | None:
    issuer = source.get("CLERK_ISSUER", "").strip().rstrip("/")
    if not issuer:
        if production:
            raise ImproperlyConfiguredEnv("CLERK_ISSUER is required in production.")
        return None
    if not issuer.startswith("https://"):
        raise ImproperlyConfiguredEnv(
            "CLERK_ISSUER must be the https:// Frontend API URL of the Clerk instance."
        )
    return Clerk(
        issuer=issuer,
        jwks_url=source.get("CLERK_JWKS_URL", "").strip() or f"{issuer}/.well-known/jwks.json",
        authorized_parties=_list(source, "CLERK_AUTHORIZED_PARTIES") or frontend_origins,
    )


def parse(source: dict[str, str]) -> Env:
    environment = source.get("DJANGO_ENV", "development").strip() or "development"
    if environment not in ENVIRONMENTS:
        raise ImproperlyConfiguredEnv(f"DJANGO_ENV must be one of {', '.join(ENVIRONMENTS)}.")
    production = environment == "production"

    debug = _bool(source, "DJANGO_DEBUG", default=False)
    if production and debug:
        raise ImproperlyConfiguredEnv("DJANGO_DEBUG must be false in production.")

    secret_key = _required(source, "DJANGO_SECRET_KEY")
    if production and (len(secret_key) < 50 or secret_key.startswith("change-me")):
        raise ImproperlyConfiguredEnv("DJANGO_SECRET_KEY must be a random value of at least 50 characters.")

    frontend_origins = tuple(
        _origin(origin, "FRONTEND_ORIGIN")
        for origin in _list(source, "FRONTEND_ORIGIN", "http://localhost:3000")
    )

    allowed_hosts = _list(source, "DJANGO_ALLOWED_HOSTS", "" if production else "localhost,127.0.0.1")
    if production and not allowed_hosts:
        raise ImproperlyConfiguredEnv("DJANGO_ALLOWED_HOSTS is required in production.")

    return Env(
        environment=environment,
        debug=debug,
        secret_key=secret_key,
        allowed_hosts=allowed_hosts,
        frontend_origins=frontend_origins,
        database=_database(_required(source, "DATABASE_URL")),
        clerk=_clerk(source, frontend_origins, production),
    )


def load() -> Env:
    # A local .env is a development convenience; real environments set variables directly.
    load_dotenv(BASE_DIR / ".env", override=False)
    return parse(dict(os.environ))
