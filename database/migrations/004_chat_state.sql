-- Adds a lightweight, structured conversation-state object alongside the
-- existing encrypted conversation_log transcript, for the new /api/chat
-- orchestration endpoint (backend/routes/chat.js). See buildSystemPrompt in
-- backend/utils/systemPrompt.js for the fields this holds.

ALTER TABLE sessions
  ADD COLUMN state JSONB DEFAULT '{}'::jsonb;
