# Real-time hiring conversations (WebSockets) — architecture proposal

Status: **approved** (WebSockets from Phase 1 and the Redis channel layer,
team lead, 27 Oct 2026). Nothing here is implemented yet.

Split across issues: **#1** builds Channels on ASGI, the Redis channel layer
(local and CI), the connection handshake below (Origin, first-frame token,
re-auth, close codes) and the shared authorization policy that REST views
and consumers both call. **#4** builds conversations, messages, hiring events
and the conversation UI on top. **#5** and the workspace chat in **#6** reuse
#4's module.

## Requirements this serves

| Source | Requirement |
| --- | --- |
| Activity diagrams (Hire Team Lead / Hire Devs) | Every application or invitation opens a chat between the two people; the hiring decision is made through that chat; non-selected candidates' inboxes are closed |
| Proposal FR5 | Real-time text messaging, presence indicators, unread tracking (workspace) |
| Proposal NFR1 | A message appears on the other person's screen in under 0.5 s without refreshing |
| Proposal Technology & Tools | "WebSockets for real-time messaging" |
| Team-lead decision | WebSockets are the primary transport from Phase 1; REST only for history and management |

## Components

| Layer | Piece |
| --- | --- |
| Server | **Django Channels** on the existing ASGI entry point (`config/asgi.py`), served by an ASGI server (Daphne or Uvicorn) instead of `runserver`'s WSGI path |
| Channel layer | **Redis** (`channels-redis`) so every server process can broadcast to every connection. Added to `docker-compose.yml` (local) and as a service container in the CI `backend` and `e2e` jobs; `REDIS_URL` read in `config/env.py`. `InMemoryChannelLayer` only in unit tests |
| Domain / application | `Conversation`, `Message` entities; use cases `OpenConversation`, `PostMessage`, `MarkRead`, `CloseConversation`; the hiring use cases call them |
| Presentation | `presentation/realtime/` — one consumer (`ConversationConsumer`) and its auth handshake; `presentation/api/` — REST for history and management |
| Frontend | `shared/api/realtime` (connection, auth, reconnect) + `widgets/conversation` (UI); the browser connects directly to Django at `NEXT_PUBLIC_WS_URL` (public, non-secret) |

The consumer is presentation code like a view: it parses a frame, calls one use
case, sends the result. Business rules (who may post, closed conversations)
live in the use cases, which the REST endpoints share.

## Connection, authentication and authorization

Browsers cannot attach an `Authorization` header to a WebSocket, and Clerk
session tokens live about 60 seconds. Proposed handshake:

1. **Origin check at connect.** The `Origin` header must equal a configured
   `FRONTEND_ORIGIN`, or the connection is refused. This blocks cross-site
   WebSocket hijacking, the WebSocket form of CSRF.
2. **Token in the first frame, not the URL.** The client sends
   `{"type": "auth", "token": "<Clerk session token>"}` within 5 s. The server
   verifies it with the existing `ClerkTokenVerifier`. Failure or timeout →
   close code `4401`. Query-string tokens are rejected because URLs end up in
   logs.
3. **Re-authentication.** The client sends `{"type": "auth.refresh", "token":
   …}` before the token expires. If no valid token arrives within the token's
   expiry + 5 s leeway, the server closes with `4401`, and the client
   reconnects with a fresh token.
4. **Membership per conversation.** `{"type": "subscribe", "conversation_id"}`
   joins a conversation only if the actor is a participant (else `4403` for
   that subscription, no data). Membership is re-checked on every
   `message.send`, so a conversation closed mid-session refuses new messages.
5. **Limits.** Message body 1–4,000 characters; at most 20 messages per 10 s
   per connection; frames over 16 KB are dropped and the connection closed
   with `1009`.

## Message flow and persistence

1. Client sends `{"type": "message.send", "conversation_id", "client_id", "body"}`.
2. `PostMessage` validates and **persists first** (Postgres, in a transaction).
3. Only after the commit the server broadcasts `{"type": "message.new",
   "message": {id, author, body, created_at}, "client_id"}` to the
   conversation's group; the sender matches `client_id` to its optimistic
   message and marks it sent.
4. A failed write sends `{"type": "error", "code", "message", "client_id"}`
   to the sender only; the UI marks that message "not sent — retry".

Decision events from the hiring use cases (hired, invitation accepted,
conversation closed with a reason) are broadcast the same way, so both
participants see the outcome immediately.

## REST alongside the socket

| Endpoint | Purpose |
| --- | --- |
| `GET /api/conversations/` | The actor's conversations with unread counts (dashboard) |
| `GET /api/conversations/{id}/` | Participants, subject (application/invitation), status, close reason |
| `GET /api/conversations/{id}/messages/?before=<id>&limit=50` | Paged history on open |
| `GET /api/conversations/{id}/messages/?after=<id>` | Catch-up after a reconnect |
| `POST /api/conversations/{id}/read/` | Mark read up to a message id |

Messages are **sent** only over the socket. There is no REST send fallback
masquerading as real-time.

## Connection and error handling (frontend)

- States shown in the UI: connecting, connected, reconnecting (with attempt
  count), offline. The composer is disabled with a reason while not connected.
- Reconnect with exponential backoff (1 s → 30 s, jitter); on reconnect, fetch
  `?after=<last id>` before resubscribing so nothing is missed or duplicated.
- Close codes: `4401` → get a fresh Clerk token and reconnect; `4403` → show
  "You are not part of this conversation"; `1009`/`4429` → show the limit.
- Closed conversations render read-only with the reason.

## Tests

- Use cases: participant-only posting, closed-conversation refusal, body
  limits, ordering, persistence before broadcast.
- Consumer (Channels `WebsocketCommunicator`, `pytest-asyncio`): bad Origin
  refused; no or expired token → `4401`; non-participant subscribe → `4403`;
  message persisted and delivered to the other participant; error frame on
  failed write; rate limit.
- REST: history paging, catch-up, read markers, non-participant `404`.
- E2E (Playwright, two browser contexts): developer applies → client and
  developer exchange messages without reloading; hire closes the other
  candidate's conversation live; reconnect after the backend restarts loses
  no messages.

## Deployment notes

`runserver` serves WebSockets once Channels' ASGI app is configured
(`daphne` in `INSTALLED_APPS`); production runs an ASGI server. The
reverse proxy must pass `Upgrade`/`Connection` headers. TLS (`wss://`) in any
non-local environment.
