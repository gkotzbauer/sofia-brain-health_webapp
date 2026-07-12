const { Pool } = require('pg');
require('dotenv').config();

const { decryptField, decryptJSON } = require('../utils/phiCrypto');

// Continuous-improvement / diagnostic tool: given a session ID, decrypts and
// pretty-prints that session's full turn-by-turn reasoning trace from
// conversation_turn_logs (see database/migrations/008_conversation_turn_logs.sql
// for why this table exists -- sessions.conversation_log only has reply
// text, and sessions.state only has the *latest* turn's state). Usage:
//
//   node scripts/dump-conversation.js <sessionId>
//
// Intended for ad hoc use by whoever is investigating a reported issue
// (e.g. "why did Sofia keep repeating this goal proposal") -- not wired
// into any route or scheduled job.

function formatProposal(type, payloadCiphertext) {
  if (!type) return 'none';
  const payload = decryptJSON(payloadCiphertext);
  const summary = payload?.text || payload?.title || JSON.stringify(payload);
  return `${type} -- "${summary}"`;
}

function formatSafety(riskLevel, triggerType, rationaleCiphertext) {
  if (!riskLevel || riskLevel === 'low') return riskLevel ? `${riskLevel} (no trigger)` : 'n/a';
  const rationale = decryptField(rationaleCiphertext);
  return `${riskLevel} / ${triggerType || 'unknown trigger'}${rationale ? ` -- "${rationale}"` : ''}`;
}

async function dumpConversation(sessionId) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } : false
  });

  try {
    const result = await pool.query(
      `SELECT * FROM conversation_turn_logs WHERE session_id = $1 ORDER BY turn_index ASC, created_at ASC`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      console.log(`No conversation_turn_logs rows found for session ${sessionId}.`);
      return;
    }

    console.log(`Conversation trace for session ${sessionId} (${result.rows.length} turn(s)):`);
    console.log('='.repeat(80));

    for (const row of result.rows) {
      console.log(`\n--- Turn ${row.turn_index}${row.is_opening ? ' (opening turn)' : ''} -- ${row.created_at.toISOString()} ---`);

      if (row.user_message) {
        console.log(`User:    ${decryptField(row.user_message)}`);
      }
      console.log(`Sofia:   ${decryptField(row.reply)}`);

      console.log(
        `State:   entry_point=${row.entry_point || 'n/a'}  care_phase=${row.care_phase || 'n/a'}  ` +
          `education_tier=${row.education_tier || 'n/a'}  adaptive_pattern=${row.adaptive_pattern || 'n/a'}`
      );

      if (row.pivot) {
        console.log(`Pivot:   ${JSON.stringify(decryptJSON(row.pivot))}`);
      }

      console.log(`Safety:  ${formatSafety(row.safety_risk_level, row.safety_trigger_type, row.safety_rationale)}`);

      console.log(`Proposal: ${formatProposal(row.proposed_type, row.proposed_payload)}`);
      if (row.proposal_attempt_count > 1 || row.loop_suppressed) {
        console.log(
          `         attempt #${row.proposal_attempt_count}${row.loop_suppressed ? '  *** LOOP SUPPRESSED THIS TURN ***' : ''}`
        );
      }

      if (row.quick_replies) {
        console.log(`Quick replies: ${JSON.stringify(decryptJSON(row.quick_replies))}`);
      }
      if (row.inline_picker_type) {
        console.log(`Inline picker: ${row.inline_picker_type}`);
      }

      console.log(`Model:   ${row.provider || 'n/a'} / ${row.model || 'n/a'}  (${row.latency_ms ?? '?'}ms)`);
    }

    console.log(`\n${'='.repeat(80)}`);
    const suppressedCount = result.rows.filter((row) => row.loop_suppressed).length;
    if (suppressedCount > 0) {
      console.log(`Note: ${suppressedCount} turn(s) in this session hit loop suppression.`);
    }
  } catch (error) {
    console.error('Failed to dump conversation:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: node scripts/dump-conversation.js <sessionId>');
  process.exitCode = 1;
} else {
  dumpConversation(sessionId);
}
