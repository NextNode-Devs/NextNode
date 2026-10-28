# Authentication, CORS and CSRF

## Architecture

- The browser talks to the Next.js app. Next.js (server components, and later
  client components) calls the Django API on a **different origin**.
- Clerk owns sign-in. Its session lives in Clerk cookies on the **frontend**
  origin. To call Django, the frontend obtains the short-lived Clerk session
  token and sends it as `Authorization: Bearer <token>`.
- Django authenticates API requests **only** from that header
  (`ClerkBearerAuthentication`). `SessionAuthentication` is not enabled, and no
  API view reads a cookie. A test (`test_cookies_are_never_an_api_credential`)
  proves a cookie alone is refused.

## Token verification

`nextnode/infrastructure/auth/clerk.py` verifies, for every request:
RS256 signature against the Clerk instance JWKS (cached), `exp` and `nbf` with
5 s leeway, `iss` equal to `CLERK_ISSUER`, `azp` (when present) in the allowed
frontend origins, and `sts` (when present) equal to `active`. Symmetric
(HS256) tokens are refused. Tokens are never logged. Without `CLERK_ISSUER`
(development only) every token is refused; production refuses to start
without it.

## Why this is not CSRF-exposed — and what would change that

CSRF works when a browser automatically attaches a credential (a cookie) to a
request a malicious site triggers. Browsers never attach an `Authorization`
header on their own, so a forged cross-site request reaches Django without a
credential and is answered 401. This is why bearer-only APIs are not CSRF
targets. It holds **only while no API endpoint accepts a cookie as a
credential**.

Rules that keep it true:

1. Never add `SessionAuthentication` or any cookie-reading authentication to
   API views. If a future feature truly needs cookie auth, it must enforce
   Django's CSRF check (`CsrfViewMiddleware`, `CSRF_TRUSTED_ORIGINS`), and this
   document must be updated first.
2. `CsrfViewMiddleware` stays enabled globally.
3. CORS (`django-cors-headers`) allows only `FRONTEND_ORIGIN`, for `/api/*`,
   **without** credentials. CORS restricts which sites can *read* responses; it
   is not CSRF protection and is not relied on as such.
4. The Stripe webhook (when built) is exempt from CSRF only because it verifies
   the `Stripe-Signature` header with the webhook secret; unsigned or invalid
   requests are rejected.

## The frontend side

- Clerk's own endpoints and cookies are protected by Clerk.
- Next.js Server Actions (if used for mutations) are POST-only and Next.js
  compares the `Origin` header with the host; keep that default and do not add
  `serverActions.allowedOrigins` beyond the real deployment origin.
- Next.js Route Handlers that perform writes using the Clerk cookie must check
  the `Origin` header (or avoid cookie-authenticated writes entirely by calling
  Django with the bearer token).
- Secrets (`CLERK_SECRET_KEY`, Stripe keys) are server-only. Only
  `NEXT_PUBLIC_*` values reach the browser, and none may be secret.

## Transport and headers (Django)

`SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS=DENY`,
`SECURE_REFERRER_POLICY=same-origin`; in production also SSL redirect (behind
a proxy setting `X-Forwarded-Proto`), HSTS (30 days, subdomains), secure CSRF
cookies. HSTS preload is deliberately off until a production domain is chosen.
