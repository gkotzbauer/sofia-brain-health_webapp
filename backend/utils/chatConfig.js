// Shared tuning constants for the conversation engine, read once here so
// routes/chat.js (regular turns) and routes/sessions.js (the proactive
// session-opening turn) can't drift on what these env vars mean.

// How many of the most recent conversation_log entries get sent to the
// model. The full transcript is always persisted regardless -- this only
// bounds per-turn cost/latency, which would otherwise grow linearly with a
// long conversation. Tunable via env without a code change/redeploy.
const MAX_CONTEXT_MESSAGES = parseInt(process.env.CHAT_CONTEXT_MESSAGE_LIMIT, 10) || 30;

// Once a session's context is capped, re-notify a clinician every time the
// transcript grows by this many more messages (not every turn) -- keeps a
// very long-running conversation from going unnoticed indefinitely while
// avoiding alert spam.
const CONTEXT_CAP_REALERT_INTERVAL = parseInt(process.env.CHAT_CONTEXT_CAP_REALERT_INTERVAL, 10) || 50;

module.exports = { MAX_CONTEXT_MESSAGES, CONTEXT_CAP_REALERT_INTERVAL };
