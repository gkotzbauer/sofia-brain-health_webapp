// Durable, cross-session record of how someone tends to prefer being
// engaged with -- the model's per-turn adaptive_pattern read (see
// utils/llm/schema.js, utils/systemPrompt.js "Adaptive conversation
// patterns") was previously only ever ephemeral session state
// (routes/sessions.js starts every new session's opening turn from
// `state: {}`, with no memory of prior sessions), so Sofia re-inferred a
// person's style from zero every single time even after a long
// relationship. This keeps a simple "most recent confident read" on the
// durable profile instead -- appropriate for a soft tone-adaptation
// signal, not a high-stakes classification, so it's updated on every turn
// the model sets a pattern rather than requiring repeated confirmation.
const PATTERN_NOTES = {
  anxious: 'tends to feel anxious about their cognitive health -- lead with extra warmth and validation, introduce anything new gently, and favor small, confidence-building steps.',
  information_seeker: 'tends to want real depth and evidence -- feel free to go deeper sooner and offer concrete resources rather than staying surface-level.',
  action_oriented: 'tends to want to move quickly to action -- keep discovery brief and focus on practical next steps rather than lingering in reflection.',
  reluctant: 'tends to need extra rapport-building before engaging -- look for one small win, keep unsolicited education light, and focus on immediate, tangible benefit.'
};

function formatCommunicationPattern(pattern) {
  if (!pattern || !PATTERN_NOTES[pattern]) return 'not yet known -- read the room fresh this session.';
  return `From past sessions, this person ${PATTERN_NOTES[pattern]}`;
}

async function recordCommunicationPattern(pool, logger, userId, pattern) {
  if (!pattern || !PATTERN_NOTES[pattern]) return;
  try {
    await pool.query('UPDATE about_me_profiles SET communication_pattern = $1 WHERE user_id = $2', [pattern, userId]);
  } catch (error) {
    logger?.error('Failed to persist communication pattern (non-fatal):', error);
  }
}

module.exports = { formatCommunicationPattern, recordCommunicationPattern };
