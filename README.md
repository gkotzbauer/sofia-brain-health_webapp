# Sofia Brain Health Companion

A Cognitive Care Companion for aging adults: an LLM-powered conversational
guide, grounded in `sofia-conversation-methodology.md`, that helps people
build the knowledge and habits they need to live their best life -- alongside
story-chapter journaling, goal setting with a confidence gate, progress
visualization, document sharing, and a real safety/escalation pipeline.

## Architecture

```
frontend/    Vite + React + TypeScript SPA
backend/     Node.js + Express + PostgreSQL API, including the LLM
             chat-orchestration endpoint (backend/routes/chat.js)
database/    Schema + migrations (database/migrations/)
```

- **Conversation engine**: `backend/routes/chat.js` builds a system prompt
  per turn (see `backend/utils/systemPrompt.js`) from the methodology doc,
  the user's live profile/goals/story chapters/documents, and a lightweight
  per-session conversation-state object -- then calls the configured LLM
  provider via forced tool-use so one response returns both Sofia's reply
  and structured state (CARE phase, education tier, adaptive pattern,
  pivots, a safety assessment, and any goal/chapter the user is proposing
  to save). **Provider-agnostic** (`backend/utils/llm/`): OpenAI or
  Anthropic, selected via `LLM_PROVIDER`, defaulting to **OpenAI** because
  that's the provider currently covered by a signed BAA -- switch to
  `anthropic` only once one is in place with Anthropic too.
- **Safety pipeline**: every message is checked by a server-side keyword
  pre-filter (`backend/utils/safetyKeywords.js`) *and* the model's own
  safety assessment; either one flags a concern, whichever is more severe
  wins. Confirmed events are recorded and, at high/critical severity, raise
  a real clinical alert (`backend/utils/clinicalAlerts.js`) -- the UI never
  claims a clinician was notified unless that actually happened.
- **Auth & authorization**: real email+password accounts (bcrypt), JWT
  sessions, and roles (`user` / `clinician` / `admin`) enforced via
  `backend/middleware/rbac.js`.
- **PHI handling**: PHI-bearing fields (About Me concerns/values, goals,
  story chapters, safety event context, feedback, conversation transcripts,
  uploaded-document text) are encrypted at the application layer
  (`backend/utils/phiCrypto.js`) before they reach Postgres, and mutating
  requests are audit-logged.

This is a security-conscious prototype, not a certified HIPAA-compliant
production system -- there's no BAA, legal review, or third-party audit
behind it.

## Quick start

### Backend

```bash
cd backend
npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, OPENAI_API_KEY
npm run migrate        # applies database/schema.sql + database/migrations/*.sql
npm run dev
```

`JWT_SECRET` and `ENCRYPTION_KEY` are required -- the server refuses to start
without them. Whichever key matches `LLM_PROVIDER` (`OPENAI_API_KEY` by
default, or `ANTHROPIC_API_KEY` if switched to `anthropic`) is required for
`/api/chat` to work; other endpoints still function without it.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL to your backend
npm run dev
```

See `frontend/DEPLOYMENT.md` and `backend/DEPLOYMENT.md` for deployment
details, and `render.yaml` for the reference Render configuration.

## Usage

1. **Register/sign in** with an email and password.
2. **Talk with Sofia** -- a real, LLM-backed conversation grounded in the
   methodology doc, not a scripted decision tree.
3. **About Me** -- share what matters most (best-life elements, concerns,
   confidence) so Sofia's conversation stays grounded in your real profile.
4. **Quests (goals)** -- set goals through a confidence-gated flow: below a
   confidence of 7, Sofia asks what would help before saving; at 7+, she
   asks for a first step.
5. **Story** -- write chapters with an emotional-arc picker.
6. **Documents** -- upload PDFs/text so Sofia can refer to them in
   conversation.
7. **Clinician view** (`clinician`/`admin` roles only) -- see and
   acknowledge pending safety alerts.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run typecheck` (frontend) and smoke-test the affected flow
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for
details.
