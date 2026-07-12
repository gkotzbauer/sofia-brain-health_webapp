// Writes one row to conversation_turn_logs per model-generated turn -- the
// full structured output (see database/migrations/008_conversation_turn_logs.sql
// for why this exists: sessions.conversation_log only keeps the reply text,
// and sessions.state only keeps the *latest* turn's merged state, so there
// was previously no way to see why Sofia said what she said at any given
// point in a session). Called from both routes/chat.js (regular turns) and
// routes/sessions.js (the proactive opening turn) right after `turn` and
// `mergedState` are already computed -- no new LLM calls, just one more
// persisted record of what already happened.
//
// Deliberately best-effort: a failure here must never break the actual
// chat turn the person is waiting on.
const { encryptField, encryptJSON } = require('./phiCrypto');
const llm = require('./llm');

async function logConversationTurn(pool, logger, { sessionId, userId, isOpening, userMessage, turn, mergedState, latencyMs }) {
  try {
    await pool.query(
      `INSERT INTO conversation_turn_logs (
         session_id, user_id, turn_index, is_opening, user_message, reply,
         entry_point, care_phase, education_tier, adaptive_pattern, pivot,
         safety_risk_level, safety_trigger_type, safety_rationale,
         proposed_type, proposed_payload, quick_replies, inline_picker_type,
         proposal_attempt_count, loop_suppressed, provider, model, latency_ms
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        sessionId,
        userId,
        mergedState.turnCount,
        Boolean(isOpening),
        userMessage ? encryptField(userMessage) : null,
        encryptField(turn.reply),
        turn.entry_point || null,
        turn.care_phase || null,
        turn.education_tier || null,
        turn.adaptive_pattern || null,
        turn.pivot ? encryptJSON(turn.pivot) : null,
        turn.safety_assessment?.risk_level || null,
        turn.safety_assessment?.trigger_type || null,
        turn.safety_assessment?.rationale ? encryptField(turn.safety_assessment.rationale) : null,
        // lastAttemptedProposal (utils/turnState.js), not pendingConfirmation
        // -- this captures what the model actually tried this turn even
        // when it was suppressed for repeating itself, which is exactly
        // the thing worth being able to see later.
        mergedState.lastAttemptedProposal?.type || null,
        mergedState.lastAttemptedProposal ? encryptJSON(mergedState.lastAttemptedProposal.payload) : null,
        turn.quick_replies?.length ? encryptJSON(turn.quick_replies) : null,
        turn.inline_picker?.type || null,
        mergedState.proposalAttemptCount || 0,
        Boolean(mergedState.loopSuppressed),
        llm.getProviderName(),
        llm.getModelName(),
        latencyMs ?? null
      ]
    );
  } catch (error) {
    logger?.error('Failed to write conversation_turn_logs entry (non-fatal):', error);
  }
}

module.exports = { logConversationTurn };
