import time

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from nextnode.application.ports import InvalidTokenError
from nextnode.infrastructure.auth.clerk import UnconfiguredTokenVerifier
from nextnode.infrastructure.container import override_container


def test_valid_token_becomes_a_verified_session(verifier, make_token):
    expires = int(time.time()) + 60
    session = verifier.verify(make_token(exp=expires))
    assert (session.clerk_user_id, session.session_id) == ("user_123", "sess_1")
    assert int(session.expires_at.timestamp()) == expires


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"exp": int(time.time()) - 60}, "expired"),
        ({"iss": "https://someone-else.clerk.accounts.dev"}, "invalid"),
        ({"azp": "https://evil.example"}, "different site"),
        ({"sts": "pending"}, "not active"),
        ({"sub": None}, "invalid"),
        ({"nbf": int(time.time()) + 600}, "invalid"),
    ],
)
def test_untrustworthy_tokens_are_refused(verifier, make_token, overrides, message):
    with pytest.raises(InvalidTokenError, match=message):
        verifier.verify(make_token(**overrides))


def test_token_signed_by_another_key_is_refused(verifier, make_token):
    stranger = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(InvalidTokenError):
        verifier.verify(make_token(key=stranger))


def test_symmetrically_signed_token_is_refused(verifier):
    import jwt

    forged = jwt.encode(
        {"iss": "x", "sub": "user_123"}, "a-shared-secret-of-at-least-32-bytes!", algorithm="HS256"
    )
    with pytest.raises(InvalidTokenError):
        verifier.verify(forged)


def test_protected_endpoint_requires_a_token(api):
    response = api.get("/api/me/")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"
    assert response["WWW-Authenticate"].startswith("Bearer")


@pytest.mark.django_db
def test_protected_endpoint_accepts_a_verified_token(api, verifier, make_token):
    with override_container(token_verifier=verifier):
        response = api.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {make_token()}")
    assert response.status_code == 200
    assert response.json() == {"data": {"clerk_user_id": "user_123", "account": None}}


@pytest.mark.django_db
def test_me_succeeds_when_the_first_signing_key_fetch_is_slow(api, signing_key, make_token):
    """The first call fetches Clerk's JWKS (up to 5 s); the frontend waits 10 s for /api/me/."""
    from nextnode.infrastructure.auth.clerk import ClerkTokenVerifier
    from tests.conftest import FRONTEND, ISSUER

    public_key = signing_key.public_key()

    def slow_resolver(token):
        time.sleep(3.5)
        return public_key

    slow = ClerkTokenVerifier(ISSUER, (FRONTEND,), key_resolver=slow_resolver)
    started = time.monotonic()
    with override_container(token_verifier=slow):
        response = api.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {make_token()}")
    assert response.status_code == 200
    assert time.monotonic() - started > 3


def test_protected_endpoint_explains_a_rejected_token(api, verifier, make_token):
    with override_container(token_verifier=verifier):
        response = api.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {make_token(azp='https://evil.example')}")
    assert response.status_code == 401
    assert "different site" in response.json()["error"]["message"]


def test_unconfigured_server_refuses_every_token(api, make_token):
    # Pinned, so a developer's own CLERK_ISSUER in backend/.env can't change the result.
    with override_container(token_verifier=UnconfiguredTokenVerifier()):
        response = api.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {make_token()}")
    assert response.status_code == 401
    assert "not configured" in response.json()["error"]["message"]


def test_cookies_are_never_an_api_credential(api):
    api.cookies["__session"] = "anything"
    assert api.get("/api/me/").status_code == 401
