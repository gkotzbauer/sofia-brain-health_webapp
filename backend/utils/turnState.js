// Two proposals are "the same" if they're the same type with the exact
// same payload -- used to detect the model repeating an identical
// goal/chapter/value/concern/education-topic proposal turn after turn
// instead of moving on once it's been shown (see buildMergedState below).
function proposalsEqual(a, b) {
  if (!a || !b) return false;
  return a.type === b.type && JSON.stringify(a.payload) === JSON.stringify(b.payload);
}

// A proposal gets shown at most this many times in a row before the app
// suppresses it server-side -- a hard backstop independent of whether the
// model actually follows the "don't repeat yourself" instruction in
// utils/systemPrompt.js. Confirmed bug this fixes: the same SMART-goal
// proposal was shown 3+ times in a row after the person had already
// responded, because nothing tracked "this exact thing was already
// proposed and is still awaiting a decision."
const MAX_IDENTICAL_PROPOSAL_ATTEMPTS = 2;

// Shared conversation-state merge logic used by both a normal chat turn
// (routes/chat.js) and the session-opening turn (routes/sessions.js) --
// keeps sessions.state's shape from drifting between the two call sites.
// Turn-specific inputs (the safety event to append, if any; whether context
// was capped) are passed in already computed -- this only owns the parts of
// the merge that are identical for every kind of turn.
function buildMergedState({
  turn,
  existingState,
  now,
  isContextCapped,
  contextWindowSize,
  contextCapLastAlertedAt,
  safetyEntry,
  profileCompleteness
}) {
  const turnCount = (existingState.turnCount || 0) + 1;

  // First non-null wins -- one proposal at a time, kept simple. The model
  // is instructed (see utils/systemPrompt.js) not to stack several
  // proposals in a single turn anyway.
  const newProposal = turn.proposed_goal
    ? { type: 'goal', payload: turn.proposed_goal }
    : turn.proposed_chapter
      ? { type: 'chapter', payload: turn.proposed_chapter }
      : turn.proposed_value
        ? { type: 'value', payload: turn.proposed_value }
        : turn.proposed_concern_detail
          ? { type: 'concern', payload: turn.proposed_concern_detail }
          : turn.proposed_education_topic
            ? { type: 'education_topic', payload: turn.proposed_education_topic }
            : null;

  // Tracked separately from pendingConfirmation (which goes back to null
  // once suppressed, so the card disappears) so a suppressed proposal
  // *stays* suppressed if the model keeps trying it, rather than resetting
  // and cycling shown/suppressed/shown every other turn.
  const lastAttemptedProposal = existingState.lastAttemptedProposal || null;
  const isRepeatOfLastAttempt = Boolean(newProposal) && proposalsEqual(newProposal, lastAttemptedProposal);
  const proposalAttemptCount = isRepeatOfLastAttempt ? (existingState.proposalAttemptCount || 1) + 1 : newProposal ? 1 : 0;
  const loopSuppressed = isRepeatOfLastAttempt && proposalAttemptCount > MAX_IDENTICAL_PROPOSAL_ATTEMPTS;

  return {
    entryPoint: turn.entry_point || existingState.entryPoint || null,
    carePhase: turn.care_phase || existingState.carePhase || 'clarify',
    educationTier: turn.education_tier || null,
    adaptivePattern: turn.adaptive_pattern || existingState.adaptivePattern || null,
    contextCapped: isContextCapped,
    contextWindowSize,
    contextCapLastAlertedAt,
    pendingConfirmation: loopSuppressed ? null : newProposal,
    lastAttemptedProposal: newProposal || lastAttemptedProposal,
    proposalAttemptCount,
    loopSuppressed,
    pivotHistory: [
      ...(existingState.pivotHistory || []),
      ...(turn.pivot ? [{ type: turn.pivot.type, turnIndex: turnCount }] : [])
    ].slice(-20),
    safetyFlags: [
      ...(existingState.safetyFlags || []),
      ...(safetyEntry ? [{ turnIndex: turnCount, ...safetyEntry }] : [])
    ].slice(-20),
    // Soft nudge tracking for the "profile is sparse, invite them to share
    // more" prompt in utils/systemPrompt.js -- set once, the first time we
    // ever generate a turn against a sparse profile, so the instruction can
    // tell the model not to repeat the ask every turn. Not meant to be
    // precise about whether the model actually asked that turn -- see the
    // implementation plan's note to keep this a soft nudge, not a rigid
    // state machine.
    profilePromptedAt:
      existingState.profilePromptedAt ?? (profileCompleteness != null && profileCompleteness < 40 ? turnCount : null),
    turnCount,
    lastTurnAt: now
  };
}

module.exports = { buildMergedState };
