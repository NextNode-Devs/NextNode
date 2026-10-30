import time
from collections.abc import Callable

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from rest_framework.test import APIClient

from nextnode.infrastructure.auth.clerk import ClerkTokenVerifier

ISSUER = "https://test-instance.clerk.accounts.dev"
FRONTEND = "http://localhost:3000"


@pytest.fixture(scope="session")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def make_token(signing_key) -> Callable[..., str]:
    """Signs a Clerk-shaped session token with a local test key."""

    def make(key=None, **overrides) -> str:
        now = int(time.time())
        claims = {
            "iss": ISSUER,
            "sub": "user_123",
            "sid": "sess_1",
            "azp": FRONTEND,
            "iat": now,
            "nbf": now,
            "exp": now + 60,
            **overrides,
        }
        claims = {name: value for name, value in claims.items() if value is not None}
        return jwt.encode(claims, key or signing_key, algorithm="RS256")

    return make


@pytest.fixture
def verifier(signing_key) -> ClerkTokenVerifier:
    public_key = signing_key.public_key()
    return ClerkTokenVerifier(ISSUER, (FRONTEND,), key_resolver=lambda token: public_key)


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture(autouse=True)
def in_memory_channel_layer(request, settings):
    """Unit tests never need Redis. Tests marked ``redis`` keep the real layer."""
    from channels.layers import channel_layers

    if "redis" not in request.keywords:
        settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    channel_layers.backends = {}
    yield
    channel_layers.backends = {}
