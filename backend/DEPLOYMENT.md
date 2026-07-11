# Backend Deployment Guide

## Required environment variables

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database_name

# Security -- the server refuses to start if either is unset
JWT_SECRET=your-very-secure-jwt-secret-key-here
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Conversation engine -- see backend/utils/llm/. Defaults to "openai"
# because that's the provider currently covered by a signed BAA; switch to
# "anthropic" only once one exists with Anthropic too.
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key-here      # required when LLM_PROVIDER=openai
ANTHROPIC_API_KEY=your-anthropic-api-key-here # required when LLM_PROVIDER=anthropic

# Server / CORS
PORT=10000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
```

See `.env.example` for the full list, including optional tuning
(`OPENAI_MODEL`, `CLAUDE_MODEL`, `CHAT_CONTEXT_MESSAGE_LIMIT`,
`CHAT_CONTEXT_CAP_REALERT_INTERVAL`, `CLINICIAN_WEBHOOK_URL`,
`AUDIT_LOG_RETENTION_DAYS`, `INACTIVE_ACCOUNT_PURGE_DAYS`).

## Database migrations

```bash
npm run migrate
```

Applies `database/schema.sql` (once, as baseline) plus any
`database/migrations/*.sql` not yet recorded in the `schema_migrations`
table -- safe to run repeatedly. On Render this runs automatically as part
of `startCommand` on every boot (see `render.yaml`) -- `preDeployCommand`
would be cleaner but requires a paid plan, and this service runs on `free`.
Elsewhere, run it manually after each deploy that includes new migrations.

## Data retention job

```bash
npm run purge-retention
```

Not run automatically -- schedule it yourself (e.g. a daily Render Cron
Job, or any external scheduler that can invoke this command against the
deployed environment). See `backend/scripts/purge-retention.js` and
`TECH_SPEC.md` §7 for what it does and does not delete.

## Testing locally

1. `npm install`
2. Set up `.env` (copy `.env.example`)
3. Ensure PostgreSQL is running and reachable at `DATABASE_URL`
4. `npm run migrate`
5. `npm run dev`

## Render deployment

See `render.yaml` at the repo root for the reference Blueprint
configuration (provisions Postgres + both services together, wires
`DATABASE_URL` automatically, and auto-generates `JWT_SECRET`/
`ENCRYPTION_KEY`). `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` are marked
`sync: false` and must be entered manually in the Render dashboard --
never commit real API keys to the repo.
