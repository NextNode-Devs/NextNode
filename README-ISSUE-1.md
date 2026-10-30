# Issue #1: authentication, onboarding, dashboard and real-time foundation

This document explains what issue #1 added to NextNode, how each part works,
and how issues #2–#6 build on it. The main `README.md` still covers general
setup; this file is the reference for the #1 changes.

- **Issue:** #1, "Clerk authentication, role onboarding, dashboard shell and WebSocket auth foundation"
- **Backlog:** NN-03, NN-04, NN-14 (dashboard shell), NN-24
- **Branch:** `feature/1-auth-onboarding` → pull request into `develop`

---

## 1. What a user can now do

1. **Register or sign in** at `/sign-up` or `/sign-in`, with email or Google. Clerk handles this, and NextNode stores no passwords.
2. **Get redirected when signed out.** Opening `/dashboard`, `/onboarding` or `/projects/...` while signed out goes to `/sign-in`, then back to the page afterwards.
3. **Choose a role once** at `/onboarding`: **Developer** or **Client**. Each role has its own profile form. The role can never be changed afterwards.
4. **Land on `/dashboard`.** The sections depend on the role, and each empty section says what will appear there.
5. **Stay connected live.** The dashboard opens an authenticated WebSocket, and the header badge shows its state: *Connecting*, *Live*, *Reconnecting* or *Offline*.

Team Lead is **not** a role you can choose; it is a responsibility on a single project.

---

## 2. Decisions made while building #1

| Decision | Where it's recorded |
|---|---|
| **Developers type their own skills.** There is no predefined list. Skills are normalised so one spelling is kept per skill: whitespace is trimmed, matching ignores case, and the first spelling saved is reused. All saved skills are served by `GET /api/skills/`. | `docs/decisions/phase-1-product-decisions.md` (29 Oct 2026) |
| **Onboarding fields.** Both roles: display name. Client: company name and industry, both free text. Developer: headline, bio (optional), GitHub username (optional, never "verified") and 1–20 skills. | same |
| **Sign-in can be switched off.** With no Clerk keys, the app still runs and CI stays green. Protected pages redirect to `/sign-in`, which explains that sign-in isn't set up. | `frontend/src/shared/config/env.public.ts` |
| **New variable `NEXT_PUBLIC_API_BASE_URL`**, so client components can call Django directly. | both `.env.example` files, README |
| **`RefreshButton` moved** from `widgets/deposit-result` to `shared/ui`, because a second screen now uses it. | `frontend/src/shared/ui/refresh-button.tsx` |

---

## 3. Setup and environment variables

```powershell
docker compose up -d db redis                    # PostgreSQL :5432 and Redis :6379
cd backend;  uv sync; uv run python manage.py migrate; uv run uvicorn config.asgi:application --reload --port 8000
cd frontend; npm ci;  npm run dev                 # http://localhost:3000
```

The Clerk development instance is created and configured as described in `docs/external-accounts.md`. Keys go **only** in the git-ignored files and are shared through the team password manager.

| File | Variable | Notes |
|---|---|---|
| `backend/.env` | `CLERK_ISSUER` | `https://<instance>.clerk.accounts.dev`. Empty means every token is refused. |
| `backend/.env` | `REDIS_URL` | Defaults to `redis://localhost:6379/0`. Required in production. |
| `frontend/.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…`, public by design. |
| `frontend/.env.local` | `CLERK_SECRET_KEY` | `sk_test_…`, **server-only**. The app refuses to start if the publishable key is set without it. |
| `frontend/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` |
| `frontend/.env.local` | `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000/ws` |

---

## 4. Backend implementation

The backend keeps the existing Clean Architecture layering (`domain` ← `application` ← `infrastructure` ← `presentation`). `import-linter` now also forbids `channels`, `channels_redis`, `uvicorn` and `redis` in `domain` and `application`.

### 4.1 Domain: `nextnode/domain/accounts/` (standard library only)
| File | What it holds |
|---|---|
| `role.py` | `Role.DEVELOPER` / `Role.CLIENT` |
| `skills.py` | `normalize_skill(s)` and the `SkillName(key, label)` type. Limits: `SKILL_MAX_LENGTH = 40`, `MAX_SKILLS = 20`. Allowed characters are letters, digits, spaces and `+ # . - /`. |
| `profiles.py` | `ClientProfile.create(...)` and `DeveloperProfile.create(...)`, with validation and field-specific errors (for example `developer.skills`). Length limits: `DISPLAY_NAME_MAX`, `HEADLINE_MAX`, `BIO_MAX`, `COMPANY_NAME_MAX`, `INDUSTRY_MAX`. |
| `account.py` | `Account.onboard(...)` checks that the profile matches the role. There is **no** method that changes the role. `AlreadyOnboardedError` is a `ConflictError` with code `ALREADY_ONBOARDED`, so it answers 409. |

### 4.2 Application: use cases and ports
| File | What it holds |
|---|---|
| `application/ports.py` | `Actor(clerk_user_id, session_id, account_id=None, role=None)`: every use case receives this. `VerifiedSession(clerk_user_id, session_id, expires_at)`. `RealtimePublisher`. |
| `application/accounts/ports.py` | `AccountRepository`, `SkillRepository`, `AccountDirectory.is_developer(clerk_user_id)`, `UnitOfWork` |
| `application/accounts/onboarding.py` | `CompleteOnboarding.execute(actor, command)`. Refuses a second onboarding, refuses a role/profile mismatch, and stores skills and the account in one transaction. |
| `application/accounts/queries.py` | `ResolveActor` (session → actor with account and role), `GetMe`, `GetAccount` (goes through the access policy), `ListSkills` (prefix matches first, at most 50) |
| `application/accounts/dto.py` | `MeView`, `AccountView`, `ClientProfileView`, `DeveloperProfileView`, `SkillView` |
| `application/access.py` | **`AccessPolicy`**, the shared deny-by-default policy. `register(resource_type, action, rule)`, `allows(...)`, and `check(...)`, which raises `ForbiddenError`. |

### 4.3 Infrastructure
| File | What it holds |
|---|---|
| `infrastructure/auth/clerk.py` | Same token checks as before, but `verify()` now returns a `VerifiedSession` that includes `expires_at`, used for socket re-authentication. |
| `infrastructure/persistence/models.py` | `AccountModel` (`account` table, `clerk_user_id` unique), `ClientProfileModel`, `DeveloperProfileModel`, `SkillModel` (`key` unique), and the developer↔skill table `developer_profile_skill` |
| `infrastructure/persistence/migrations/0002_accounts.py` | The migration for those models |
| `infrastructure/persistence/accounts.py` | `DjangoAccountRepository`, `DjangoSkillRepository`, `DjangoAccountDirectory`. A database unique conflict becomes `AlreadyOnboardedError`, so two racing requests can't create two accounts. |
| `infrastructure/access_rules.py` | `build_access_policy()`: **the one place every access rule is registered.** #1 registers `("account", "read")` = your own account. |
| `infrastructure/realtime/publisher.py` | `ChannelsEventPublisher.publish_to_account(account_id, event)` |
| `infrastructure/persistence/management/commands/send_realtime_test_event.py` | `manage.py send_realtime_test_event <account_id>` sends a test event across processes. |
| `infrastructure/container.py` | New adapters: `accounts`, `skills`, `account_directory`, `access_policy`, `realtime`. New use cases: `resolve_actor`, `get_me`, `get_account`, `complete_onboarding`, `list_skills`. |

### 4.4 Presentation: REST
`authentication.py` verifies the bearer token, then runs `ResolveActor`, so **`request.user.actor` always carries `account_id` and `role`**. Both are `None` before onboarding.

| Endpoint | Behaviour |
|---|---|
| `GET /api/me/` | `{data: {clerk_user_id, account: null \| {id, role, display_name, created_at, profile}}}`. 401 without a valid token. |
| `POST /api/onboarding/` | Body: `{role, display_name, client?: {company_name, industry}, developer?: {headline, bio, github_username, skills[]}}`. Answers 201, 400 with errors per field, or 409 `ALREADY_ONBOARDED`. Unknown keys are refused. |
| `GET /api/skills/?q=` | `{data: [{key, label}]}`: every saved skill, prefix matches first. Requires sign-in. |
| `GET /api/accounts/{id}/` | Your own account only (403 otherwise). It exists to show the shared policy working from REST. |

`exception_handler.py` now maps a domain error by its **nearest mapped parent class**, so a subclass such as `AlreadyOnboardedError` keeps its parent's status (409). Before this, subclasses fell through to 400.

### 4.5 Presentation: WebSocket (`nextnode/presentation/realtime/`)
`config/asgi.py` routes `ws/` through Channels' `OriginValidator`, which only accepts `FRONTEND_ORIGIN`. Uvicorn serves HTTP and WebSockets (`runserver` is HTTP only). `CHANNEL_LAYERS` uses Redis at `REDIS_URL`.

The full protocol is in `docs/proposals/realtime-messaging.md` → "As built in #1". In short:

| Step | Rule |
|---|---|
| Handshake | A foreign `Origin` is refused before the connection opens (HTTP 403). A token in the URL closes with `4401`. |
| Authenticate | The first frame is `{"type":"auth","token":…}`, within 5 s. The answer is `{"type":"auth.ok","expires_at":…}`. A bad, expired or foreign token closes `4401`. A user who hasn't onboarded closes `4403`. |
| Re-authenticate | `{"type":"auth.refresh","token":…}` for the **same** user, before `expires_at` + 5 s. Otherwise the socket closes `4401`. |
| Limits | More than 16 KB in one frame closes `1009`. More than 20 frames in 10 s closes `4429`. `ping` answers `pong`. |
| Groups | Every socket joins `account.<account_id>`. |
| Extension | `registry.register_handler(type, handler, access=Access(resource_type, action, id_from_frame))`. The consumer asks the **shared `AccessPolicy`** before calling the handler; if the policy refuses, the socket closes `4403`. A handler can't be registered without an `Access` check. |

### 4.6 Config, dependencies, CI
- `pyproject.toml`: adds `channels`, `channels-redis` and `uvicorn[standard]` (not Daphne: its `twisted` dependency fails the audit; Daphne stays a dev dependency only because `channels.testing` imports it), plus `pytest-asyncio` for tests (`asyncio_mode = "auto"`, and a `redis` marker).
- `config/env.py`: adds `REDIS_URL`. `backend/.env.example`: adds `REDIS_URL`.
- `docker-compose.yml`: adds a `redis` service (`redis:7.4.2-alpine`, with a healthcheck).
- `.github/workflows/ci.yml`: adds a `redis` service to the `backend` and `e2e` jobs, and `REDIS_URL` for the whole workflow.

---

## 5. Frontend implementation

The frontend keeps the FSD layers (`app → views → widgets → features → entities → shared`), with imports only through each slice's `index.ts`.

### 5.1 App, routing and Clerk
| File | What it does |
|---|---|
| `src/proxy.ts` | Next.js 16 Proxy. Redirects signed-out visitors away from `/dashboard`, `/onboarding` and `/projects`, keeping `redirect_url`. **It only redirects**; role decisions stay in the backend. |
| `src/app/_providers/app-providers.tsx` | `ClerkProvider` with the sign-in/sign-up paths and redirect targets. Mounted only when Clerk keys exist. |
| `src/app/{sign-in,sign-up}/[[...]]/page.tsx`, `onboarding/page.tsx`, `dashboard/page.tsx` | Each renders one view |

### 5.2 Shared
| File | What it does |
|---|---|
| `shared/config/env.public.ts` | Browser-safe values: `publicEnv.{clerkPublishableKey, apiBaseUrl, wsUrl}` and `isAuthConfigured()` |
| `shared/config/env.server.ts` | Checks that `CLERK_SECRET_KEY` is present whenever the publishable key is |
| `shared/api/types.ts` | `ApiResult<T>`, `ApiError` and `readEnvelope()`, shared by both clients |
| `shared/api/session.ts` | Now returns the real Clerk token: `(await auth()).getToken()` |
| `shared/api/server-client.ts` | `apiGet`, `apiPost`, and new `apiPut` / `apiPatch`. Pass `{ auth: true }` to send the token. Never throws. |
| `shared/api/browser-client.ts` | `useApiClient()` gives `get/post/put/patch` for client components, with the Clerk token attached |
| `shared/api/realtime/` | `RealtimeConnection` (framework-free), `RealtimeProvider`, `useRealtime()` → `{connection, state}`. Backoff from 1 s to 30 s with jitter. Token refreshed 15 s before expiry. A `4401` close fetches a fresh token and gives up after 3 tries; `4403` stops. |
| `shared/ui/load-states.tsx` | `LoadError` (with a retry button) and `LoadingCards` |
| `shared/ui/shadcn/` | New `input`, `label`, `textarea`, `radio-group`, `separator` |

### 5.3 Entities, features, widgets, views
| Slice | What it provides |
|---|---|
| `entities/viewer` | `getViewer()` (server-only, cached per request, calls `/api/me/`), `routeFor()` (sign-in / onboarding / dashboard / error), the types `Role`, `Account`, `Viewer`, and `ROLE_LABEL` |
| `entities/skill` | `useSkillSuggestions(query)`, `skillKey()`, `cleanSkill()`, and the same limits as the backend |
| `features/complete-onboarding` | `OnboardingForm`: role choice, then the fields for that role, a skills tag input with suggestions, errors on each field plus a summary, and a Server Action that posts to `/api/onboarding/` |
| `widgets/dashboard-shell` | `DashboardShell({account, sections})` and `SECTIONS`. **`sections` is the slot later issues fill.** |
| `widgets/app-header` | Logo, Dashboard link (`aria-current`), a `status` slot and Clerk's `UserButton` (sign-out) |
| `widgets/connection-status` | The live-connection badge |
| `views/auth`, `views/onboarding`, `views/dashboard`, `views/home` | The pages. Onboarding and dashboard both use `routeFor()`, so an onboarded user never sees onboarding again. |

---

## 6. Tests and verification

| Suite | Result |
|---|---|
| Backend `pytest` (real PostgreSQL and Redis) | **201 passed**: domain, use cases with in-memory fakes, API, access policy, socket consumer (`WebsocketCommunicator`), and delivery across processes through Redis |
| Backend lint | `ruff format --check`, `ruff check`, `lint-imports`, `check_max_lines`, `makemigrations --check`: all clean |
| Frontend | `lint`, `typecheck`, Vitest **65**, `build` (with and without Clerk keys): all pass |
| Playwright E2E | **12/12** at 375, 768 and 1280 px. Covers the home page, the signed-out redirect, developer onboarding → dashboard, and client onboarding with validation → dashboard. Runs against the Clerk dev instance, with throwaway `+clerk_test` users that are deleted afterwards. |
| Secret check | The `CLERK_SECRET_KEY` value appears in no file under `.next/` |
| Still manual | Google sign-in |

New test helpers you can reuse:
- `backend/tests/account_fakes.py`: `InMemoryAccounts`, `InMemorySkills`, `InMemoryDirectory`, `NoTransaction`
- `backend/tests/conftest.py`: `make_token(sub=…)`, and an automatic in-memory channel layer (mark a test `redis` to use real Redis)
- `frontend/e2e/auth.spec.ts`: `signInAsNewUser()` pattern
- `frontend/vitest.setup.ts`: a `ResizeObserver` stub for Radix components

Bugs found and fixed while testing:
1. Domain-error subclasses answered 400 instead of their parent's status.
2. The build failed with Clerk keys because Clerk components need `<Suspense>` while `cacheComponents` is on.
3. After a failed submit, React's form reset dropped the chosen role from the form data.

---

## 7. Building issues #2–#6 on this

### Common recipe for every issue
- **Who is calling.** In a view, use `request.user.actor`. Every use case takes `actor: Actor`.
  - `actor.account_id is None` means the user hasn't onboarded; refuse.
  - Check the role in the **use case**, never in `proxy.ts`:
    ```python
    if actor.role is not Role.CLIENT:
        raise ForbiddenError("Only clients can post projects.")
    ```
  - `clerk_user_id` stays the stable owner id; #7's `DepositTerms.client_user_id` already uses it.
- **Access rules.** Add one line in `backend/nextnode/infrastructure/access_rules.py`, for example `policy.register("project_document", "read", rule)`. Then call `get_container().access_policy.check(actor, "read", ResourceRef("project_document", id))` in your use case. Anything unregistered stays denied.
- **Live events.** Call `get_container().realtime.publish_to_account(account_id, {"type": "...", ...})` from your use case, through the `RealtimePublisher` port. On the frontend, `useRealtime().connection?.on("your.type", cb)`.
- **Dashboard.** Pass your content into the slot in `frontend/src/views/dashboard/ui/dashboard-view.tsx`:
  ```tsx
  <DashboardShell account={account} sections={{ "my-projects": <MyProjects /> }} />
  ```
  Section ids are `my-projects`, `applications`, `invitations` (developers only) and `conversations`.
- **API calls.** Server components and Server Actions: `apiGet/apiPost/apiPut/apiPatch(path, body, { auth: true })` from `@/shared/api/server-client`. Client components: `useApiClient()` from `@/shared/api/browser-client`. Who is signed in: `getViewer()` and the `Role` type from `@/entities/viewer`.
- **Tests.** Fake accounts come from `tests/account_fakes.py`; tokens come from `make_token(sub="user_x")`.

### #2: Developer portfolios and directory (AliyaaAli)
- **Already set up:** the developer profile with headline, bio, GitHub username and skills (`DeveloperProfileModel`), and **`GET /api/skills/`**. That endpoint, which #2's contract promised, now comes from #1, and the list is user-entered.
- **Build:**
  - Add the portfolio fields (repository, live-demo and resume URLs, `is_available`) to `DeveloperProfileModel` with a new migration.
  - Reuse the limits and `normalize_skills` from `nextnode.domain.accounts`.
  - Directory filter: `SkillModel.developers` (the M2M) plus `AccountModel.role == "developer"`, which keeps clients out of the directory.
  - Owner-only edit: compare against `actor.account_id`.
- **Frontend:**
  - `useSkillSuggestions` from `@/entities/skill` for the filter.
  - The tag input lives in `features/complete-onboarding/ui/skills-input.tsx`. When #2 needs it, move it to `entities/skill/ui` or `shared/ui` (the rule is to share on second use).
  - Use `apiPut` for `PUT /api/developers/me/portfolio/`.

### #3: Projects and requirement documents (Isabella-Enriquez)
- **Already set up:** roles on `Actor`, the skills vocabulary for the project tech stack (validate with `normalize_skills`, offer suggestions through `/api/skills/`), and the access policy.
- **Build:**
  - Client-only publishing, checked with `actor.role`.
  - Register `("project_document", "read")` in `access_rules.py`. Readers are the owning client, the Team Lead and approved members (#5 extends this).
  - Fill the dashboard section `my-projects`.
  - Store the owner as `clerk_user_id` (or account id) so #7's deposit check keeps working.

### #4: Hiring conversations and Hire Lead (Hardik33)
- **Already set up:** the authenticated socket, Redis, account groups, the publisher, the frontend connection with its states, and the extension point.
- **Build:**
  ```python
  register_handler(
      "subscribe",
      subscribe,
      access=Access("conversation", "subscribe", lambda f: f["conversation_id"]),
  )
  register_handler(
      "message.send",
      send,
      access=Access("conversation", "send", lambda f: f["conversation_id"]),
  )
  ```
  - Register those `conversation` rules in `access_rules.py`.
  - Use `ctx.group_add("conversation.<id>")` and `ctx.send_json(...)`.
  - Frontend: `useRealtime()`. `connection.send(...)` returns `false` while disconnected, so disable the composer then, and use `state` for the reason.
  - Fill the `conversations` and `applications` dashboard sections.
- **To agree with #1:** a refused `subscribe` currently closes with `4403`. Tell us if you'd rather get an error frame and keep the socket open.

### #5: Hire Devs and team roster (Kaushalya-123)
- **Already set up:** `Actor` is compatible with the `feature/issue-5-hire-devs` branch, which uses `actor.clerk_user_id`. Your `DeveloperAccounts.is_developer` port has a ready adapter: **`get_container().account_directory`** (`DjangoAccountDirectory`).
- **Build:**
  - Wire `account_directory` into your use cases.
  - Register a `("team", …)` rule, and extend the `project_document` reader rule (#3) to approved members.
  - Fill the `invitations` (developers) and `applications` (Team Leads) dashboard sections.
  - Send live decision events through `realtime.publish_to_account` or #4's conversation module.

### #6: Project start gate and workspace chat (KaiNabea)
- **Already set up:** the access policy for agreement and workspace access, roles on `Actor`, and the socket that #4's conversation module will run on.
- **Build:**
  - Register `("agreement", "accept")` and `("workspace", "read")` rules.
  - Reuse #4's conversation handlers for workspace chat, with a new resource type in its `Access`.
  - Replace `ProjectsNotReady` in `container.py` (still yours, from #7).

---

## 8. Open follow-ups
- **CI secrets:** the Clerk dev keys need to be stored as GitHub environment secrets (admin) so the signed-in E2E tests also run in CI. Until then they skip there.
- **#4 contract:** confirm the socket contract and `register_handler` with Hardik33.
- **#2/#3 owners:** tell them skills are now user-entered and served by `GET /api/skills/`.
- **Google sign-in:** check it manually before closing #1.
