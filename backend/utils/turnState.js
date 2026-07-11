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

  return {
    entryPoint: turn.entry_point || existingState.entryPoint || null,
    carePhase: turn.care_phase || existingState.carePhase || 'clarify',
    educationTier: turn.education_tier || null,
    adaptivePattern: turn.adaptive_pattern || existingState.adaptivePattern || null,
    contextCapped: isContextCapped,
    contextWindowSize,
    contextCapLastAlertedAt,
    pendingConfirmation: turn.proposed_goal
      ? { type: 'goal', payload: turn.proposed_goal }
      : turn.proposed_chapter
        ? { type: 'chapter', payload: turn.proposed_chapter }
        : null,
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
