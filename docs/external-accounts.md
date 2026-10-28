# External accounts (create when integration starts)

Neither account exists yet. Create them only when work on #1 (Clerk) or #7
(Stripe) begins. Never commit real keys; put them in `backend/.env` and
`frontend/.env.local` (both git-ignored) and share them through a password
manager, not chat or issues.

## Clerk — development instance (needed by #1)

1. Sign in at https://dashboard.clerk.com with a team-owned account and create
   an application named `NextNode (development)`.
2. Enable sign-in methods: **Email** and **Google**. Development instances use
   Clerk's shared Google credentials, so no Google Cloud setup is needed yet.
3. From **API keys**, copy:
   - Publishable key → `frontend/.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (public by design).
   - Secret key → `frontend/.env.local` as `CLERK_SECRET_KEY` (server-only, never `NEXT_PUBLIC_`).
   - Frontend API URL (e.g. `https://<slug>.clerk.accounts.dev`) → `backend/.env` as `CLERK_ISSUER`.
4. Add `http://localhost:3000` to allowed origins if the dashboard asks.
5. Restart the backend; `GET /api/health/` should report `"auth": "configured"`.

The variable names above are added to both `.env.example` files by #1.

## Stripe — test account (needed by #7)

**Owner: the Team Lead (`shar-hylton`).** Stripe setup, credentials,
integration decisions, payment testing and verification are the Team Lead's
responsibility (#7). Other teammates do not need Stripe keys; if one is ever
needed for CI, it goes in a GitHub environment secret, set by the Team Lead.

1. Create or sign in to a team-owned Stripe account and stay in **Test mode**
   (toggle at the top of the dashboard). No business verification is needed
   for test mode.
2. From **Developers → API keys**, copy the **test** secret key (`sk_test_…`)
   → `backend/.env` as `STRIPE_SECRET_KEY`. Never use a live key (`sk_live_…`);
   the backend should refuse one outside production.
3. Install the Stripe CLI and run
   `stripe listen --forward-to localhost:8000/api/payments/stripe/webhook/`;
   copy the printed signing secret (`whsec_…`) → `backend/.env` as
   `STRIPE_WEBHOOK_SECRET`.
4. Pay with Stripe's test cards (`4242 4242 4242 4242` succeeds,
   `4000 0000 0000 0002` is declined). No real money moves.

The variable names above are added to `backend/.env.example` by #7 as
placeholders, with the non-secret setting `DEPOSIT_PERCENT=20` (confirmed).
Phase 1 charges in CAD only.
