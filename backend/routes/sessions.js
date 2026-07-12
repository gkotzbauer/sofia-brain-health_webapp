const express = require('express');
const router = express.Router();
const { encryptJSON, decryptJSON } = require('../utils/phiCrypto');
const { buildSystemPrompt } = require('../utils/systemPrompt');
const { loadUserContext } = require('../utils/loadUserContext');
const { buildMergedState } = require('../utils/turnState');
const { MAX_CONTEXT_MESSAGES } = require('../utils/chatConfig');
const { logConversationTurn } = require('../utils/conversationTurnLog');
const llm = require('../utils/llm');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// How many of the previous session's final messages to hand the model for
// "what we discussed last time" continuity -- enough for a real recap
// without ballooning the opening turn's token cost.
const PREVIOUS_TAIL_LIMIT = 6;

function greetingBucketFor(daysSinceLastSession) {
  if (daysSinceLastSession <= 0) return 'returningToday';
  if (daysSinceLastSession < 7) return 'returningRecent';
  return 'returningDistant';
}

// Generates Sofia's proactive opening turn for a brand-new session, using
// the exact same single-LLM-call machinery routes/chat.js uses for a normal
// turn (buildSystemPrompt + generateTurn + buildMergedState) -- just with no
// preceding user message. Mutates `session` in place with the generated
// conversation_log/state on success. Never throws -- a failure here must
// not prevent session creation; the frontend falls back to a static
// greeting when conversation_log comes back empty (see ChatWindow.tsx).
async function attachOpeningTurn(req, session, userId) {
  if (!llm.isConfigured()) return;

  try {
    const previousResult = await req.pool.query(
      `SELECT session_date, conversation_log, state FROM sessions WHERE user_id = $1 AND id != $2 ORDER BY session_date DESC LIMIT 1`,
      [userId, session.id]
    );
    const previousSession = previousResult.rows[0];
    const isFirstTime = !previousSession;
    const daysSinceLastSession = isFirstTime
      ? null
      : Math.floor((Date.now() - new Date(previousSession.session_date).getTime()) / MS_PER_DAY);
    const greetingBucket = isFirstTime ? null : greetingBucketFor(daysSinceLastSession);
    // The tail of the previous session's actual transcript -- lets the
    // opening turn genuinely summarize "what we discussed last time" and
    // "where we left off" instead of only referencing an isolated goal/
    // concern. Goals/chapters/etc. are already fully available via the
    // regular "This person, right now" section below (see loadUserContext),
    // so this is specifically for conversational continuity.
    const previousLog = previousSession ? decryptJSON(previousSession.conversation_log) || [] : [];
    const previousTail = previousLog.length ? previousLog.slice(-PREVIOUS_TAIL_LIMIT) : null;
    const previousCarePhase = previousSession?.state?.carePhase || null;

    const { aboutMe, goals, chapters, documents, values, concerns, educationTopics, profileCompleteness } =
      await loadUserContext(req.pool, userId);

    const systemBlocks = buildSystemPrompt({
      user: req.user,
      aboutMe,
      goals,
      chapters,
      documents,
      values,
      concerns,
      educationTopics,
      state: {},
      profileCompleteness,
      opening: {
        isFirstTime,
        greetingBucket,
        daysSinceLastSession,
        previousTail,
        previousCarePhase
      }
    });

    // Anthropic requires at least one message with role "user"; this
    // placeholder is explicitly called out as ignorable in the "Session
    // opening" system-prompt block above, for both providers.
    const generateStartedAt = Date.now();
    const turn = await llm.getProvider().generateTurn({
      systemBlocks,
      messages: [{ role: 'user', content: '[session start -- no message yet]' }]
    });

    const now = new Date().toISOString();
    const openingLog = [
      {
        role: 'assistant',
        content: turn.reply,
        timestamp: now,
        isOpening: true,
        storyMoment: Boolean(turn.proposed_chapter),
        quickReplies: turn.quick_replies || null,
        inlinePicker: turn.inline_picker || null
      }
    ];
    // No keyword-based safety check runs for the opening turn (there's no
    // real user message to scan), and no clinical alert fires off it --
    // the model's own safety_assessment is still required by the schema and
    // will read as low/none for an ordinary greeting.
    const mergedState = buildMergedState({
      turn,
      existingState: {},
      now,
      isContextCapped: false,
      contextWindowSize: MAX_CONTEXT_MESSAGES,
      contextCapLastAlertedAt: null,
      safetyEntry: null,
      profileCompleteness
    });

    await req.pool.query(
      'UPDATE sessions SET conversation_log = $1, state = $2 WHERE id = $3',
      [encryptJSON(openingLog), JSON.stringify(mergedState), session.id]
    );

    await logConversationTurn(req.pool, req.logger, {
      sessionId: session.id,
      userId,
      isOpening: true,
      userMessage: null,
      turn,
      mergedState,
      latencyMs: Date.now() - generateStartedAt
    });

    session.conversation_log = encryptJSON(openingLog);
    session.state = mergedState;
  } catch (openingError) {
    req.logger.error('Session opening-turn generation failed (session still created):', openingError);
  }
}

function decryptSession(row) {
  if (!row) return row;
  return {
    ...row,
    conversation_log: decryptJSON(row.conversation_log) || [],
    state: row.state || {}
  };
}

// List sessions for the current user (most recent first), for resuming/history
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await req.pool.query(
      `SELECT id, session_date, duration_minutes, main_topics, mood, created_at
       FROM sessions WHERE user_id = $1 ORDER BY session_date DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    req.logger.error('Session list error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Get a single session (transcript + conversation state), for reloading a chat
router.get('/:sessionId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const result = await req.pool.query(
      'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(decryptSession(result.rows[0]));
  } catch (error) {
    req.logger.error('Session fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create new session
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await req.pool.query(
      'INSERT INTO sessions (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    const session = result.rows[0];

    // Update user's total sessions
    await req.pool.query(
      'UPDATE users SET total_sessions = total_sessions + 1 WHERE id = $1',
      [userId]
    );

    await req.auditLog(userId, 'SESSION_CREATED', 'sessions', session.id, req);

    // Sofia speaks first -- see attachOpeningTurn above. Never fails session
    // creation; on any error the session is simply returned with an empty log.
    await attachOpeningTurn(req, session, userId);

    res.json(decryptSession(session));
  } catch (error) {
    req.logger.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session (client-driven metadata sync; the /api/chat endpoint is the
// primary writer of conversation_log/state during an active conversation)
router.put('/:sessionId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { duration_minutes, main_topics, conversation_log } = req.body;

    const result = await req.pool.query(
      `UPDATE sessions
       SET duration_minutes = $1, main_topics = $2, conversation_log = $3
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [duration_minutes, main_topics, encryptJSON(conversation_log), sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await req.auditLog(userId, 'SESSION_UPDATED', 'sessions', sessionId, req);

    res.json(decryptSession(result.rows[0]));
  } catch (error) {
    req.logger.error('Session update error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

module.exports = router;
