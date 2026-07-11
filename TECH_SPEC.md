# Sofia — Technical Specification

**Status**: Working prototype. HIPAA-aware security posture, not a certified
HIPAA-compliant production system (no BAA, no legal review, no third-party
audit).

This document describes the system as it actually exists in the codebase —
verified against the source at the time of writing, not aspirational.

---

## 1. Overview

Sofia is a Cognitive Care Companion for aging adults: an LLM-powered
conversational guide, grounded in `sofia-conversation-methodology.md`, that
helps people build the knowledge and habits they need to live their best
life — alongside story-chapter journaling, confidence-gated goal setting,
progress visualization, document sharing, and a real safety/escalation
pipeline with clinician tooling. The conversation engine is provider-agnostic
(OpenAI or Anthropic — see §6), defaulting to OpenAI because that's the
provider currently covered by a signed BAA.

---

## 2. Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  Frontend                │        │  Backend                      │
│  Vite + React + TS SPA   │  HTTPS │  Node.js + Express            │
│  (frontend/)              │◄──────►│  (backend/)                    │
└─────────────────────────┘  JWT    └───────────┬────────────────────┘
                              Bearer             │
                                                  │  SQL (TLS)
                                                  ▼
                                        ┌──────────────────┐
                                        │  PostgreSQL        │
                                        │  (database/)        │
                                        └──────────────────┘
                                                  │
                              backend/routes/chat.js
                              (via backend/utils/llm/)
                                                  ▼
                                        ┌──────────────────┐
                                        │  OpenAI or Anthropic│
                                        │  (LLM_PROVIDER env,  │
                                        │  default: OpenAI)   │
                                        └──────────────────┘
                                                  │
                                        (optional) clinician
                                        webhook on critical alerts
```

- **Frontend**: single-page app, client-side routed, talks only to the
  backend's REST API (`VITE_API_BASE_URL`, baked in at build time).
- **Backend**: stateless Express API; all conversation/session state lives
  in Postgres, not in server memory — any instance can serve any request.
- **Conversation state lives server-side only.** The React client is a thin
  renderer over server responses; it never owns canonical state beyond
  ephemeral UI concerns (typing indicator, active tab, text-size
  preference).

---

## 3. Tech Stack

### Backend (`backend/`)
| Concern | Choice |
|---|---|
| Runtime | Node.js ≥16, Express 4 |
| Database | PostgreSQL (via `pg`) |
| LLM | OpenAI (`openai` ^6.46.0, default) or Anthropic Claude (`@anthropic-ai/sdk` ^0.110.0) — provider-agnostic, see `backend/utils/llm/` |
| Auth | JWT (`jsonwebtoken`), bcrypt password hashing (`bcryptjs`) |
| Encryption | AES via `crypto-js`, wrapped in `backend/middleware/encryption.js` |
| File upload | `multer` + `pdf-parse` |
| Security middleware | `helmet`, `cors`, `express-rate-limit` |
| Logging | `winston` |
| HTTP client (webhooks) | `axios` |

### Frontend (`frontend/`)
| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript, Vite build |
| Routing | `react-router-dom` v6 |
| Server state | `@tanstack/react-query` v5 |
| Styling | Plain CSS with custom-property design tokens (`src/styles/tokens.css`) — no CSS framework |

No ORM (raw parameterized SQL via `pg`), no state-management library beyond
React Query + one `AuthContext`, no CSS framework, no test framework wired
up yet (`jest` is a listed backend devDependency but no test files exist).

---

## 4. Data Model

PostgreSQL, defined in `database/schema.sql` (baseline) plus
`database/migrations/002`–`007` (applied in order by
`backend/scripts/migrate.js`, which tracks applied versions in a
`schema_migrations` table).

### Enums
- `user_role`: `user`, `clinician`, `admin`
- `confidence_level`: `Very confident`, `Somewhat confident`, `Not very confident`
- `risk_level`: `low`, `moderate`, `high`, `critical`
- `safety_trigger_type`: `emergency`, `distress`, `frustration`, `repetition`, `inclusion`
- `goal_status`: `active`, `completed`, `paused`, `abandoned`

### Tables
| Table | Purpose | PHI encrypted at app layer? |
|---|---|---|
| `users` | account, `email`, `password_hash`, `role` | No (not PHI) |
| `about_me_profiles` | best-life elements, concerns, confidence | Yes — `best_life_elements`, `concerns` |
| `sessions` | one row per conversation; `conversation_log`, `state` JSONB | Yes — `conversation_log` |
| `story_chapters` | journaling entries with mood arc | Yes — `moment`, `choices`, `learning` |
| `goals` | SMART goals with confidence 1–10 | Yes — `goal`, `user_note` |
| `goal_progress` | progress notes against a goal | Yes — `progress_note` |
| `values` | free-text values (`POST/GET/PUT /api/values`) | Yes — `value_text`, `user_note` |
| `concerns` | free-text concerns (`POST/GET/PUT /api/concerns`) | Yes — `concern`, `context`, `user_note` |
| `education_topics` | topics of interest (`POST/GET/PUT /api/education-topics`) | Yes — `topic`, `user_note` |
| `feedback` | user feedback text | Yes — `feedback_text` |
| `safety_events` | detected safety triggers | Yes — `keywords` (per-element), `context` |
| `safety_interventions` | clinician intervention notes | No current write path |
| `audit_log` | HIPAA-style audit trail | N/A (action metadata, not PHI content) |
| `clinical_alerts` | clinician-facing alert queue | No (message text is operational, not raw PHI) |
| `document_uploads` | uploaded file metadata + extracted text | Yes — `metadata` (embeds `extractedText`) |
| `profile_variable_history` | change log for About Me + document notifications | Yes — `variable_value`, `previous_value`, `source_details` |

Encryption is applied at the **application layer**
(`backend/utils/phiCrypto.js`, wrapping AES in
`backend/middleware/encryption.js`) — Postgres itself only ever stores
ciphertext for the columns above. This is field-level encryption of
specifically PHI-bearing columns, not whole-database encryption; names,
emails, chapter titles, mood-arc arrays, and similar non-PHI fields are
plaintext by design.

---

## 5. API Reference

Base path `/api`. All routes except `/api/health`, `/`, and
`/api/auth/register` + `/api/auth/login` require `Authorization: Bearer
<JWT>`. Routes marked **[clinician]** additionally require
`role ∈ {clinician, admin}` (`backend/middleware/rbac.js`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/` | API index |
| POST | `/api/auth/register` | Create account (bcrypt password) |
| POST | `/api/auth/login` | Sign in, issue JWT (7d expiry) |
| GET | `/api/users/profile` | Full profile: user, About Me, chapters, goals, concerns, values, education topics |
| PUT | `/api/users/about-me` | Update About Me; diffs and logs changes to `profile_variable_history` |
| DELETE | `/api/users/me` | Self-service account deletion (password-confirmed) — see §7 |
| GET | `/api/sessions` | List the caller's sessions |
| GET | `/api/sessions/:id` | Fetch one session's transcript + state |
| POST | `/api/sessions` | Create a session |
| PUT | `/api/sessions/:id` | Update session metadata/log |
| POST | `/api/chat` | **The conversation engine** — see §6 |
| GET | `/api/goals` | List the caller's goals |
| POST | `/api/goals` | Create a goal |
| PUT | `/api/goals/:id` | Update goal (confidence/status/note) |
| GET | `/api/goals/:id/progress` | List progress notes for a goal |
| POST | `/api/goals/:id/progress` | Log a progress note |
| GET/POST/PUT | `/api/values` , `/api/values/:id` | List/create/update a value |
| GET/POST/PUT | `/api/concerns` , `/api/concerns/:id` | List/create/update a concern |
| GET/POST/PUT | `/api/education-topics` , `/api/education-topics/:id` | List/create/update an education topic |
| POST | `/api/story-chapters` | Create a story chapter |
| POST | `/api/safety-events` | Client-reported safety event |
| POST | `/api/feedback` | Submit feedback |
| GET | `/api/feedback/unreviewed` **[clinician]** | All unreviewed feedback |
| POST | `/api/documents/upload` | Upload a PDF/text file (parsed, encrypted, stored) |
| GET | `/api/documents/content/:id` | Fetch one document's extracted text |
| GET | `/api/documents/document-uploads` | List the caller's document uploads |
| PUT | `/api/documents/document-uploads/:id` | Update processing status |
| POST/GET | `/api/documents/profile-history` | Generic profile-change log write/read |
| GET | `/api/documents/notifications` | Pending document notifications |
| PUT | `/api/documents/notifications/:id/delivered` | Mark a notification delivered |
| GET | `/api/admin/clinical-alerts/pending` **[clinician]** | Pending safety/context-cap alerts |
| PUT | `/api/admin/clinical-alerts/:id/acknowledge` **[clinician]** | Acknowledge an alert |
| GET | `/api/admin/sessions/:id` **[clinician]** | View any user's conversation |
| POST | `/api/admin/sessions/:id/messages` **[clinician]** | Post a care-team message into a user's conversation |
| GET | `/api/admin/audit-trail/:userId` **[clinician]** | Audit trail for a user |

---

## 6. Conversation Engine (`backend/routes/chat.js`)

One LLM API call per user turn — deliberately not a multi-step agentic
tool-use loop (see the architecture decision documented inline and in
project history: single-call wins on latency, failure-surface, audit
simplicity, and cost for this app's small/bounded per-user data shape).

**Provider abstraction** (`backend/utils/llm/`): `index.js` selects a
provider by `LLM_PROVIDER` env var (`openai` default, or `anthropic`);
`schema.js` holds one provider-agnostic JSON Schema for the structured turn
output; `openaiProvider.js` and `anthropicProvider.js` each implement
`generateTurn({ systemBlocks, messages })` against their respective APIs
using forced tool/function calling, normalizing to the same return shape so
`chat.js` itself has no provider-specific code. **Default is OpenAI**
because that's the provider currently covered by a signed BAA — switch to
`anthropic` only once one exists with Anthropic too. Both providers use a
lazy-singleton client with an explicit 20s timeout and `maxRetries: 2`.

**Per-turn pipeline:**
1. Fetch the session; decrypt its transcript and state.
2. Fetch About Me profile, active goals, 5 most recent story chapters, and
   3 most recent documents (each excerpt capped at 1,500 chars) via 4
   parallel Postgres queries.
3. Build the system prompt (`backend/utils/systemPrompt.js`) as two
   content blocks: a large static methodology block (CARE framework, entry
   points, education tiers, SMART+confidence-gated goals, adaptive
   patterns, pivots, safety instructions, narrative voice) marked with
   Anthropic prompt-cache `cache_control` (ignored by the OpenAI provider,
   which relies on OpenAI's own automatic prefix caching instead), plus a
   small dynamic per-user section that is never cached.
4. Trim conversation history sent to the model to the most recent
   `CHAT_CONTEXT_MESSAGE_LIMIT` messages (default 30; full history is
   always persisted and shown regardless). Once capped, a clinician alert
   fires once, then re-fires every `CHAT_CONTEXT_CAP_REALERT_INTERVAL`
   additional messages (default 50).
5. Call the selected provider via a **forced single tool/function call**
   (`sofia_turn_response`) that must return the reply plus structured state
   (`entry_point`, `care_phase`, `education_tier`, `adaptive_pattern`,
   `pivot`, `safety_assessment`, optional `proposed_goal`/`proposed_chapter`)
   in one shot.
6. **Dual safety check**: a server-side keyword pre-filter
   (`backend/utils/safetyKeywords.js`) runs independently of the model's
   own `safety_assessment`; whichever signals higher severity wins (biased
   toward sensitivity). A safety event above threshold triggers a real
   clinical alert (`backend/utils/clinicalAlerts.js`) — the frontend only
   ever displays "clinician notified" when that actually happened.
7. **Human-in-the-loop writes**: `proposed_goal`/`proposed_chapter` are
   never auto-persisted. They come back as `pendingConfirmation`; only an
   explicit user action via the ordinary `POST /api/goals` /
   `POST /api/story-chapters` endpoints writes them.
8. **Failure handling**: if the model call itself throws/times out (for
   either provider), the keyword safety pre-filter still runs (safety
   detection has no single point of failure tied to any one provider's
   availability), the turn is persisted with a warm on-brand fallback
   reply, and `CHAT_MESSAGE_FALLBACK` is audit-logged — never a raw 500 to
   a vulnerable user. Verified against both providers' real APIs with
   deliberately invalid credentials: both fail fast (no hang near the 20s
   timeout) and produce identical fallback behavior.
9. Persist the encrypted transcript + merged state; audit-log the turn.

---

## 7. Security & Compliance

- **Auth**: email + bcrypt password, JWT (7-day expiry), no refresh-token
  rotation. Server refuses to start if `JWT_SECRET` or `ENCRYPTION_KEY` is
  unset (fail closed).
- **RBAC**: `backend/middleware/rbac.js`, enforced per-route.
- **Encryption**: see §4. The Postgres connection is always TLS-encrypted
  in production, but certificate *validation* (`rejectUnauthorized`)
  defaults to off (`DB_SSL_REJECT_UNAUTHORIZED=true` to enable) because
  Render's managed Postgres presents a self-signed certificate on its
  internal network -- strict validation fails outright there
  (`DEPTH_ZERO_SELF_SIGNED_CERT`), confirmed against the real deployment.
  Enable it only when hosting somewhere with a real CA-signed DB cert.
- **Audit logging**: `backend/middleware/audit.js` — explicit
  `auditLog()` calls on every mutating route, capturing user, action,
  resource, IP, user agent.
- **Rate limiting**: global 100 req/15min on `/api/*`; stricter 5 req/15min
  on auth; 20 req/min on chat.
- **Data retention & deletion**:
  - `DELETE /api/users/me` (`backend/routes/users.js`) — self-service,
    password-confirmed account deletion. Every PHI-bearing table has an
    `ON DELETE CASCADE` foreign key to `users.id` (see §4/`database/schema.sql`),
    so deleting the user row is a genuine, complete erasure. `audit_log`
    has `ON DELETE SET NULL` instead — the audit trail intentionally
    survives account deletion, with the deletion event itself logged
    before the row is removed.
  - `backend/scripts/purge-retention.js` (`npm run purge-retention`) —
    intended to run on a schedule (e.g. a daily cron job). Purges
    `audit_log` rows older than `AUDIT_LOG_RETENTION_DAYS` (default 365).
    Optionally (only if `INACTIVE_ACCOUNT_PURGE_DAYS` is explicitly set —
    unset by default) also purges accounts that have been deactivated for
    longer than that window; this is opt-in because deciding what counts
    as "abandoned" is a policy call this script won't make silently.
- **Known, explicitly out-of-scope gaps** (prototype, not production):
  no BAA with any hosting/DB provider, no penetration test.

---

## 8. Frontend Architecture

`frontend/src/`:
- `api/client.ts` — typed fetch wrapper, JWT attached from `localStorage`.
- `context/AuthContext.tsx` + `hooks/useAuth.ts` — session state.
- `hooks/` — one React Query hook per resource (`useConversation`,
  `useProfile`, `useGoals`, `useChapters`, `useDocuments`, `useValues`,
  `useConcerns`, `useEducationTopics`, `useClinicianAlerts`,
  `useClinicianSession`, `useTextSize`).
- `components/` — grouped by domain: `chat/`, `profile/`, `goals/`,
  `story/`, `progress/`, `documents/`, `layout/`.
- `pages/` — one per route; routes are `/login`, `/register`, `/chat`,
  `/profile`, `/goals`, `/story`, `/documents`, `/clinician` and
  `/clinician/sessions/:sessionId` (both role-gated).
- Accessibility: WCAG AA contrast, 44px touch targets, S/M/L/XL text-size
  control, full keyboard operability — verified with `axe-core` (zero
  violations across all routes) and a real headless-browser walkthrough.

---

## 9. Deployment

Reference config: `render.yaml` (Render Blueprint — provisions Postgres +
both services together).

- **Database**: managed Postgres.
- **Backend**: `buildCommand: npm install`, `startCommand: npm run migrate
  && node server.js` -- migrations run at boot rather than via
  `preDeployCommand`, since that Render feature requires a paid plan and
  this service runs on `free`. `scripts/migrate.js` is idempotent (tracks
  applied versions in `schema_migrations`), so re-running it on every
  restart is safe. If the plan is ever upgraded, switching to a real
  `preDeployCommand` is a one-line change.
  Required env: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, and whichever
  provider key matches `LLM_PROVIDER` (`OPENAI_API_KEY` by default, or
  `ANTHROPIC_API_KEY` if switched to `anthropic`). Optional: `LLM_PROVIDER`
  (default `openai`), `OPENAI_MODEL`, `CLAUDE_MODEL`, `CORS_ORIGIN`,
  `CLINICIAN_WEBHOOK_URL`, `CHAT_CONTEXT_MESSAGE_LIMIT`,
  `CHAT_CONTEXT_CAP_REALERT_INTERVAL`, `AUDIT_LOG_RETENTION_DAYS`,
  `INACTIVE_ACCOUNT_PURGE_DAYS`, `DB_SSL_REJECT_UNAUTHORIZED` (leave unset
  on Render -- see the encryption note above).
- **Retention job**: `npm run purge-retention` is not scheduled
  automatically by `render.yaml` — run it via a Render Cron Job (or any
  external scheduler) pointed at the backend service, on whatever cadence
  fits (e.g. daily).
- **Frontend**: static site; `buildCommand: npm install && npm run build`,
  publishes `dist/`. `VITE_API_BASE_URL` is baked in at build time, not
  runtime — changing it requires a rebuild.

See `backend/DEPLOYMENT.md` and `frontend/DEPLOYMENT.md` for full detail.

---

## 10. Known Limitations

- No automated test suite (manual/scripted browser verification only).
- No LLM-side retrieval — all per-user context is pre-fetched and injected
  every turn; would need revisiting if per-user document volume grows
  large enough that full injection stops fitting one prompt.
- No real-time push; the chat view polls every 20s (focused-tab only) to
  surface clinician messages.
- `values`, `concerns`, and `education_topics` have real CRUD endpoints
  (§5) and a frontend UI (Profile page — `ValuesSection.tsx`,
  `ConcernsSection.tsx`, `EducationTopicsSection.tsx`), but the chat
  engine's system prompt (`backend/utils/systemPrompt.js`) doesn't
  incorporate them yet — only About Me, goals, chapters, and documents are
  in Sofia's live conversational context today.
- `safety_interventions` (clinician intervention notes) still has no write
  path.
- The retention purge script (§7, §9) has to be scheduled externally; it
  is not wired into `render.yaml` as a running cron job by default.
