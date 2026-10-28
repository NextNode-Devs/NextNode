---
name: backend-architecture
description: Read before writing, moving, or reviewing any file under backend/. Covers Clean Architecture on Django + DRF + PostgreSQL as built in this repo, the dependency rule (import-linter), the container, the recipe for adding an endpoint (with the health check as the reference), errors and response shape, Clerk bearer auth, CORS/CSRF, Stripe webhooks, files, migrations, testing and the checks to run.
---

# Backend architecture — `backend/`

Clean Architecture over Django 6 + Django REST Framework, PostgreSQL through
the Django ORM, managed with **uv**. Source code dependencies point
**inward**, toward the domain.

```
presentation ──> infrastructure ──> application ──> domain
```

Enforced by two import-linter contracts in `backend/pyproject.toml`:
layers may only import downward, and `domain`/`application` may not import
Django, DRF, PyJWT, psycopg or any vendor SDK. `uv run lint-imports` fails on
a violation; never add an `ignore_imports` entry to make it pass.

## 1. Layout (as built)

```
backend/
├── config/
│   ├── env.py            # the ONLY reader of os.environ; validates at startup
│   ├── settings.py       # reads config.env, never os.environ
│   └── urls.py           # mounts /api/, JSON 404/500
├── nextnode/
│   ├── domain/
│   │   └── errors.py     # DomainError + ValidationError, NotFound, Conflict, Forbidden, InvalidStateTransition
│   ├── application/
│   │   ├── ports.py      # Actor, TokenVerifier, DatabaseProbe, InvalidTokenError
│   │   └── health.py     # CheckHealth: the reference use case
│   ├── infrastructure/
│   │   ├── auth/clerk.py         # ClerkTokenVerifier / UnconfiguredTokenVerifier
│   │   ├── persistence/          # Django app (label "nextnode"): models.py, migrations/, adapters
│   │   └── container.py          # composition root: get_container(), override_container()
│   └── presentation/api/
│       ├── authentication.py     # ClerkBearerAuthentication (DRF)
│       ├── exception_handler.py  # the only place errors become HTTP
│       ├── errors.py             # JSON 404/500 for non-DRF paths
│       ├── views.py              # HealthView, MeView
│       └── urls.py
├── tests/
└── scripts/check_max_lines.py
```

As modules grow, split by feature inside each layer
(`domain/projects/`, `application/hiring/`, `presentation/api/projects/`).
Create a module only when a backlog item needs it.

## 2. Layers

| Layer | Contains | May import |
| --- | --- | --- |
| `domain` | Plain Python entities/value objects with their invariants, `DomainError` subclasses, repository `Protocol`s | stdlib only |
| `application` | Use cases (one class, one `execute`), ports (`Protocol`s), DTOs (frozen dataclasses) | `domain` |
| `infrastructure` | ORM models + migrations, repository adapters, Clerk/Stripe/storage adapters, `container.py` | `application`, `domain`, Django, SDKs |
| `presentation` | DRF views, serializers, URL conf, authentication, exception handler | everything below |

**Domain**: rules true without a computer — a team is 5–7 people including
its Team Lead; a client project's roster cannot lock without a confirmed
deposit (the team becomes `Active` only then); a project has at most one
deposit and one final payment. No Django.
ORM models are **not** domain entities; repository adapters map between them.

**Application**: one use case per action from the spec (`ApplyToLead`,
`HireTeamLead`, `InviteDeveloper`, `AcceptInvitation`, …). It receives the
`Actor`, re-checks authorization, orchestrates entities through ports, and
returns a DTO — never an entity or ORM model. Runnable with no HTTP server and
no database.

**Infrastructure**: everything that talks to the outside. Stripe details live
only in `infrastructure/payments/` once it exists.

**Presentation**: request in, one use case call, response out.

```python
class HealthView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request: Request) -> Response:
        report = get_container().check_health.execute()
        return Response({"data": asdict(report)})
```

Serializers do transport validation only (types, lengths, required). Never use
`ModelSerializer` or `ModelViewSet` for writes; they bypass the use case.

## 3. Adding an endpoint

Work inside out; copy the shape of `CheckHealth` → `DjangoDatabaseProbe` →
`Container.check_health` → `HealthView`.

1. **Domain**: entity/value object/method with its invariants.
2. **Port**: repository or service `Protocol` the use case needs.
3. **Use case**: class with an `execute(actor, …)` returning a DTO.
4. **Adapter + model**: implement the port; add ORM models and run
   `uv run python manage.py makemigrations`.
5. **Wire**: add it to `Container` in `infrastructure/container.py`.
6. **Serializer**: transport validation.
7. **View + URL**: in `presentation/api/`.
8. **Tests**: use case with fakes; endpoint through `APIClient` with
   `override_container(...)`; wrong-role and wrong-project refusals.

Never start at step 7.

## 4. Errors and response shape

Raise `DomainError` subclasses where the rule lives. `exception_handler.py`
maps them (and DRF's own exceptions) to statuses; unknown exceptions are
logged and answered with a generic 500.

```jsonc
{ "data": { } }                                                    // success
{ "error": { "code": "CONFLICT", "message": "…", "fields": { } } } // failure
```

Write messages for the person who must fix the problem ("This team already has
7 of 7 people"); the frontend shows them verbatim. JSON keys are `snake_case`.

## 5. Authentication, authorization, CORS and CSRF

Clerk handles registration, Google sign-in and authentication; NextNode stores
the Clerk user id and profile data, never passwords. The frontend sends the
Clerk session token as `Authorization: Bearer <token>`.
`ClerkBearerAuthentication` → `ClerkTokenVerifier` checks RS256 signature
(JWKS), `exp`/`nbf`, `iss`, `azp` against allowed frontend origins, and refuses
non-active sessions (`sts`). With `CLERK_ISSUER` unset (development only) every
token is refused and `/api/health/` reports `auth: unconfigured`.

Default permission is `IsAuthenticated`; public endpoints opt out explicitly.
Authorization is decided in the use case against the `Actor` (a client only
reaches its own projects; team assets only reach approved members). Scope every
query by the actor; an ID in a URL never implies access.

CSRF threat model (full reasoning: `docs/decisions/auth-cors-csrf.md`): no API
endpoint accepts a cookie as a credential (`SessionAuthentication` is not
enabled; a test proves a cookie is ignored), so a cross-site request cannot
carry the user's authority. Keep it that way. `CsrfViewMiddleware` stays on.
If anything ever authenticates by cookie, it must enforce Django CSRF. CORS
allows only `FRONTEND_ORIGIN`, without credentials — CORS is not CSRF
protection. The Stripe webhook will be `csrf_exempt` only because it verifies
the `Stripe-Signature` header.

## 5b. Real-time (WebSockets, approved for Phase 1; not built yet)

Django Channels consumers live in `presentation/realtime/` and are treated
like views: parse a frame, call one use case, send the result. Messages are
persisted by the use case **before** they are broadcast. The connection is
refused unless `Origin` is an allowed frontend origin; the Clerk token arrives
in the first frame (never the URL) and is verified by the same
`TokenVerifier`; participation is re-checked on every subscribe and send.
Messages are sent only over the socket; REST serves history, catch-up and
read markers. Full design and required tests:
`docs/proposals/realtime-messaging.md`. Channel layer: Redis
(`channels-redis`, `REDIS_URL`) in development and CI; `InMemoryChannelLayer`
only in unit tests.

## 6. Payments (when built)

`PaymentGateway` port; `StripeGateway` its only adapter; **test mode**. Payment
state changes only on a verified webhook, handled idempotently (keyed on the
Stripe event id) inside `transaction.atomic()`. Phase 1 tracks payment status;
it provides no escrow, custody, transfers or payouts, and code and copy must
not claim it does. Developer-created projects have no payments.

## 7. Files (when built)

`FileStorage` port; first adapter is local private storage (a git-ignored
directory nothing serves directly). PDF/DOCX only, checked by extension and
file signature, size- and count-capped by settings, stored under a generated
key, served through links that expire in 15 minutes and re-check access on
use. Readers: the owning client, the Team Lead and approved members — never
applicants or candidates.

## 8. Configuration

`config/env.py` is the only reader of `os.environ` (the `DJANGO_SETTINGS_MODULE`
default in `manage.py`/`wsgi.py`/`asgi.py` is the framework's own exception).
It loads `backend/.env` for local development, validates every variable, and
fails at startup naming the variable. Production refuses `DEBUG`, weak secret
keys, missing allowed hosts and missing `CLERK_ISSUER`. Add every new variable
to `env.py` **and** `.env.example` (placeholders only).

## 9. Database and migrations

PostgreSQL everywhere, including tests (`docker compose up -d db` from the repo
root). Never SQLite. Migrations live in `nextnode/infrastructure/persistence/
migrations/`, are committed, and never edited after merge.
`uv run python manage.py makemigrations --check --dry-run` must report no
changes. Soft-delete projects, teams, agreements, conversations and payments.

## 10. Testing

`uv run pytest`. Use cases with in-memory fakes, no database. Endpoints via
`APIClient` with `override_container(...)`. Auth tests sign Clerk-shaped
tokens with a local RSA key (`tests/conftest.py`: `make_token`, `verifier`).
Mark database tests `@pytest.mark.django_db`. Every protected endpoint gets a
wrong-role and a wrong-project refusal test.

## 11. Checks before finishing

```bash
cd backend
uv run ruff format --check .
uv run ruff check .
uv run lint-imports
uv run python scripts/check_max_lines.py
uv run python manage.py makemigrations --check --dry-run
uv run pytest
```

- [ ] Business logic in a use case or entity, not a view or serializer.
- [ ] Use cases re-check authorization against the actor.
- [ ] Dependencies wired in `container.py`; DTOs cross the boundary.
- [ ] Errors are `DomainError` subclasses, mapped only in the handler.
- [ ] New env vars in `config/env.py` and `.env.example`.
- [ ] Migration committed for every model change.
- [ ] Every file under 500 lines.
