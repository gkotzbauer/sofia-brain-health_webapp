-- A persistent, queryable record of the model's full structured output for
-- every turn (both routes/chat.js's regular turns and routes/sessions.js's
-- proactive opening turn) -- not just the reply text kept in
-- sessions.conversation_log, and not just the *latest* turn's state kept in
-- sessions.state (which gets overwritten every turn, losing prior turns'
-- care_phase/entry_point/proposals entirely). This is what makes it
-- possible to actually see why Sofia said what she said at any point in a
-- session, instead of only being able to guess from code re-reading.
--
-- Free-text fields that could carry PHI (the person's own message, Sofia's
-- reply, proposal payloads, safety rationale) are stored as AES ciphertext
-- via backend/utils/phiCrypto.js, the same pattern already used for
-- sessions.conversation_log. Note: sessions.state itself is stored as
-- plain JSON today (a pre-existing gap predating this table) -- this table
-- deliberately does not repeat that.
CREATE TABLE conversation_turn_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    turn_index INTEGER NOT NULL,
    is_opening BOOLEAN DEFAULT false,

    -- AES ciphertext (backend/utils/phiCrypto.js). user_message is null for
    -- the opening turn, which has no preceding user message.
    user_message TEXT,
    reply TEXT NOT NULL,

    entry_point VARCHAR(50),
    care_phase VARCHAR(50),
    education_tier VARCHAR(50),
    adaptive_pattern VARCHAR(50),
    -- AES ciphertext of {type, note} -- note is free text.
    pivot TEXT,

    safety_risk_level VARCHAR(20),
    safety_trigger_type VARCHAR(50),
    -- AES ciphertext -- free-text rationale.
    safety_rationale TEXT,

    proposed_type VARCHAR(50),
    -- AES ciphertext of the proposal payload (goal/chapter/value/concern/
    -- education-topic text and its metadata).
    proposed_payload TEXT,
    -- AES ciphertext of the quick_replies string array, if any.
    quick_replies TEXT,
    inline_picker_type VARCHAR(50),

    -- See backend/utils/turnState.js buildMergedState -- how many times in
    -- a row (including this one) the same proposal has now been attempted,
    -- and whether this turn's attempt was suppressed server-side because it
    -- exceeded the repeat limit. Directly queryable for "how often does
    -- Sofia get stuck repeating herself" across all sessions.
    proposal_attempt_count INTEGER DEFAULT 0,
    loop_suppressed BOOLEAN DEFAULT false,

    provider VARCHAR(50),
    model VARCHAR(100),
    latency_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversation_turn_logs_session ON conversation_turn_logs(session_id);
CREATE INDEX idx_conversation_turn_logs_user ON conversation_turn_logs(user_id);
CREATE INDEX idx_conversation_turn_logs_created_at ON conversation_turn_logs(created_at);
CREATE INDEX idx_conversation_turn_logs_loop_suppressed ON conversation_turn_logs(loop_suppressed) WHERE loop_suppressed = true;
