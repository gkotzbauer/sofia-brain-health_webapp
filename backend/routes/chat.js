const express = require('express');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const router = express.Router();

const { encryptJSON, decryptJSON, decryptField } = require('../utils/phiCrypto');
const { detectSafetyTriggers, mostSevereTrigger, SEVERITY_RANK } = require('../utils/safetyKeywords');
const { recordSafetyEvent } = require('../utils/safetyEvents');
const { createClinicalAlert } = require('../utils/clinicalAlerts');
const { buildSystemPrompt } = require('../utils/systemPrompt');

// How many of the most recent conversation_log entries get sent to Claude.
// The full transcript is always persisted regardless -- this only bounds
// per-turn cost/latency, which would otherwise grow linearly with a long
// conversation. Tunable via env without a code change/redeploy.
const MAX_CONTEXT_MESSAGES = parseInt(process.env.CHAT_CONTEXT_MESSAGE_LIMIT, 10) || 30;

// Once a session's context is capped, re-notify a clinician every time the
// transcript grows by this many more messages (not every turn) -- keeps a
// very long-running conversation from going unnoticed indefinitely while
// avoiding alert spam.
const CONTEXT_CAP_REALERT_INTERVAL = parseInt(process.env.CHAT_CONTEXT_CAP_REALERT_INTERVAL, 10) || 50;

// Warm, on-brand copy shown when the Claude call itself fails/times out --
// the user's message is still saved so nothing is lost, but no model output
// exists for that turn, so no CARE-phase/safety-assessment update happens.
const FALLBACK_REPLY = "I'm having trouble connecting right now. Your message wasn't lost -- please try sending it again in a moment.";

// Built once and reused across requests (not per-turn) -- constructed
// lazily so a missing ANTHROPIC_API_KEY doesn't crash the whole server at
// require-time; the route handler already 503s before ever calling this if
// the key is unset. An explicit timeout/retry count replaces undocumented
// SDK defaults for a synchronous, browser-facing request.
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 20 * 1000,
      maxRetries: 2
    });
  }
  return anthropicClient;
}

// Chat calls hit a paid, latency-sensitive external API -- tighter than the
// global API limiter, but still generous enough for a real conversation.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many messages, please slow down for a moment.',
  standardHeaders: true,
  legacyHeaders: false
});

// One tool call returns both the natural-language reply and the structured
// conversation-state deltas (see utils/systemPrompt.js for the framework
// this implements). Enums mirror the DB's safety_trigger_type/risk_level.
const SOFIA_TURN_TOOL = {
  name: 'sofia_turn_response',
  description: "Sofia's next conversational turn, plus structured tracking of CARE phase, education tier, adaptive pattern, any pivot, a safety assessment, and any goal/chapter the user is proposing to save.",
  input_schema: {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: "The only field shown to the user -- Sofia's natural-language reply, in her warm hero's-journey voice."
      },
      entry_point: {
        type: 'string',
        enum: ['validation', 'strength_based', 'goal_oriented', 'educational']
      },
      care_phase: {
        type: 'string',
        enum: ['clarify', 'assess', 'relate', 'engage', 'complete']
      },
      education_tier: {
        type: ['string', 'null'],
        enum: ['micro', 'standard', 'deep_dive', null]
      },
      adaptive_pattern: {
        type: ['string', 'null'],
        enum: ['anxious', 'information_seeker', 'action_oriented', 'reluctant', null]
      },
      pivot: {
        type: ['object', 'null'],
        properties: {
          type: { type: 'string', enum: ['distress', 'direct_question', 'new_concern', 'fatigue'] },
          note: { type: 'string' }
        }
      },
      safety_assessment: {
        type: 'object',
        description: 'Set on every turn, even when nothing is wrong (trigger_type "none", risk_level "low").',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'moderate', 'high', 'critical'] },
          trigger_type: { type: 'string', enum: ['none', 'emergency', 'distress', 'frustration', 'repetition', 'inclusion'] },
          rationale: { type: 'string' }
        },
        required: ['risk_level', 'trigger_type', 'rationale']
      },
      proposed_goal: {
        type: ['object', 'null'],
        description: 'Only set when proposing to save a new/updated goal -- never assume it is saved.',
        properties: {
          text: { type: 'string' },
          confidence: { type: 'integer', minimum: 1, maximum: 10 }
        }
      },
      proposed_chapter: {
        type: ['object', 'null'],
        description: 'Only set when proposing to save a story chapter -- never assume it is saved.',
        properties: {
          title: { type: 'string' },
          moment: { type: 'string' },
          moodArc: { type: 'array', items: { type: 'string' } },
          choices: { type: 'string' },
          learning: { type: 'string' }
        }
      }
    },
    required: ['reply', 'care_phase', 'safety_assessment']
  }
};

router.post('/', chatLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, message } = req.body;

    if (!sessionId || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'sessionId and a non-empty message are required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      req.logger.error('Chat request received but ANTHROPIC_API_KEY is not configured');
      return res.status(503).json({ error: 'The chat companion is not configured on this server yet.' });
    }

    const sessionResult = await req.pool.query(
      'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionResult.rows[0];
    const existingState = session.state || {};
    const existingLog = decryptJSON(session.conversation_log) || [];

    const [aboutMeResult, goalsResult, chaptersResult, documentsResult] = await Promise.all([
      req.pool.query('SELECT * FROM about_me_profiles WHERE user_id = $1', [userId]),
      req.pool.query('SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      req.pool.query('SELECT * FROM story_chapters WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5', [userId]),
      req.pool.query(
        'SELECT filename, metadata FROM document_uploads WHERE user_id = $1 ORDER BY upload_timestamp DESC LIMIT 3',
        [userId]
      )
    ]);

    const aboutMeRow = aboutMeResult.rows[0];
    const aboutMe = aboutMeRow
      ? {
          ...aboutMeRow,
          best_life_elements: decryptJSON(aboutMeRow.best_life_elements) || [],
          concerns: decryptJSON(aboutMeRow.concerns) || []
        }
      : null;
    const goals = goalsResult.rows.map((goal) => ({ ...goal, goal: decryptField(goal.goal) }));
    const chapters = chaptersResult.rows;
    const documents = documentsResult.rows.map((row) => {
      const metadata = decryptJSON(row.metadata) || {};
      return { filename: row.filename, extractedText: metadata.extractedText || '' };
    });

    const systemPrompt = buildSystemPrompt({ user: req.user, aboutMe, goals, chapters, documents, state: existingState });

    // Only the most recent MAX_CONTEXT_MESSAGES entries go to Claude; the
    // full log (including any earlier care-team messages, which are never
    // sent to the model at all -- see the role filter below) stays in the
    // database and in the user's/clinician's view regardless.
    const isContextCapped = existingLog.length > MAX_CONTEXT_MESSAGES;
    const contextForClaude = isContextCapped ? existingLog.slice(-MAX_CONTEXT_MESSAGES) : existingLog;

    const anthropicMessages = contextForClaude
      .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
      .map((turn) => ({ role: turn.role, content: turn.content }));
    anthropicMessages.push({ role: 'user', content: message });

    let completion;
    try {
      completion = await getAnthropicClient().messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: [SOFIA_TURN_TOOL],
        tool_choice: { type: 'tool', name: 'sofia_turn_response' }
      });
    } catch (apiError) {
      req.logger.error('Anthropic API call failed:', apiError);

      // The keyword pre-filter doesn't depend on Claude, so it still runs --
      // a network/API failure should never silently skip safety detection.
      const fallbackKeywordTriggers = detectSafetyTriggers(message);
      const fallbackKeywordTrigger = mostSevereTrigger(fallbackKeywordTriggers);
      let fallbackClinicianNotified = false;
      let fallbackSafetyEventId = null;

      if (fallbackKeywordTrigger) {
        const { safetyEvent, clinicianNotified: notified } = await recordSafetyEvent(
          req.pool, req.logger, req.auditLog, req,
          {
            userId,
            sessionId,
            triggerType: fallbackKeywordTrigger.type,
            severity: fallbackKeywordTrigger.severity,
            keywords: fallbackKeywordTriggers.map((trigger) => trigger.keyword),
            context: fallbackKeywordTrigger.context
          }
        );
        fallbackClinicianNotified = notified;
        fallbackSafetyEventId = safetyEvent.id;
      }

      // Persisted like a normal turn (so it survives a refresh and the
      // user's message isn't silently dropped from their history), but the
      // conversation state is left untouched -- no CARE-phase/education/
      // adaptive-pattern update happened, because no model output exists.
      const fallbackNow = new Date().toISOString();
      const fallbackLog = [
        ...existingLog,
        { role: 'user', content: message, timestamp: fallbackNow },
        { role: 'assistant', content: FALLBACK_REPLY, timestamp: fallbackNow, isFallback: true }
      ];
      await req.pool.query('UPDATE sessions SET conversation_log = $1 WHERE id = $2', [encryptJSON(fallbackLog), sessionId]);
      await req.auditLog(userId, 'CHAT_MESSAGE_FALLBACK', 'sessions', sessionId, req);

      return res.json({
        reply: FALLBACK_REPLY,
        state: existingState,
        safety: {
          riskLevel: fallbackKeywordTrigger?.severity || 'low',
          clinicianNotified: fallbackClinicianNotified,
          safetyEventId: fallbackSafetyEventId
        }
      });
    }

    const toolUse = completion.content.find((block) => block.type === 'tool_use');
    if (!toolUse) {
      req.logger.error('Claude response had no tool_use block');
      return res.status(502).json({ error: 'The chat companion returned an unexpected response.' });
    }
    const turn = toolUse.input;

    // Safety corroboration: keyword pre-filter OR the model's own
    // assessment -- whichever is more severe wins, biasing toward
    // sensitivity rather than avoiding false positives.
    const keywordTriggers = detectSafetyTriggers(message);
    const keywordTrigger = mostSevereTrigger(keywordTriggers);
    const modelTriggerType = turn.safety_assessment?.trigger_type && turn.safety_assessment.trigger_type !== 'none'
      ? turn.safety_assessment.trigger_type
      : null;
    const modelSeverity = turn.safety_assessment?.risk_level || 'low';

    const keywordRank = keywordTrigger ? SEVERITY_RANK[keywordTrigger.severity] : 0;
    const modelRank = modelTriggerType ? SEVERITY_RANK[modelSeverity] : 0;
    const shouldRecordSafetyEvent = keywordRank > 0 || modelRank >= SEVERITY_RANK.high;

    let clinicianNotified = false;
    let riskLevel = modelSeverity;
    let safetyEventId = null;

    if (shouldRecordSafetyEvent) {
      const useKeyword = keywordRank >= modelRank;
      const triggerType = useKeyword ? keywordTrigger.type : modelTriggerType;
      const finalSeverity = useKeyword ? keywordTrigger.severity : modelSeverity;
      const keywords = keywordTriggers.map((trigger) => trigger.keyword);
      const context = keywordTrigger?.context || turn.safety_assessment?.rationale || message.slice(0, 200);

      const { safetyEvent, clinicianNotified: notified } = await recordSafetyEvent(
        req.pool, req.logger, req.auditLog, req,
        { userId, sessionId, triggerType, severity: finalSeverity, keywords, context }
      );
      clinicianNotified = notified;
      riskLevel = finalSeverity;
      safetyEventId = safetyEvent.id;
    }

    // The first time a session's context gets capped, let a clinician know
    // -- not because it's a safety concern, but because an unusually long
    // conversation (or one where Sofia stops referencing earlier context)
    // may be worth a human check-in. Re-fires every CONTEXT_CAP_REALERT_INTERVAL
    // additional messages so a conversation that keeps growing doesn't go
    // unnoticed indefinitely, without alerting on every single turn.
    const lastAlertedAt = existingState.contextCapLastAlertedAt ?? null;
    const shouldAlertContextCap =
      isContextCapped && (lastAlertedAt === null || existingLog.length - lastAlertedAt >= CONTEXT_CAP_REALERT_INTERVAL);

    if (shouldAlertContextCap) {
      await createClinicalAlert(req.pool, req.logger, {
        userId,
        sessionId,
        alertType: 'context_cap',
        priority: 'low',
        message:
          lastAlertedAt === null
            ? `${req.user.name}'s conversation has grown long enough (${existingLog.length + 2} messages) that Sofia is now only seeing the most recent ${MAX_CONTEXT_MESSAGES}. The full transcript is still available below -- a check-in may help.`
            : `${req.user.name}'s conversation is still going (${existingLog.length + 2} messages now) since the last long-conversation check-in. Worth another look.`
      });
    }

    // Persist the turn and the merged conversation state
    const turnCount = (existingState.turnCount || 0) + 1;
    const now = new Date().toISOString();
    const newLog = [
      ...existingLog,
      { role: 'user', content: message, timestamp: now },
      { role: 'assistant', content: turn.reply, timestamp: now }
    ];

    const mergedState = {
      entryPoint: turn.entry_point || existingState.entryPoint || null,
      carePhase: turn.care_phase || existingState.carePhase || 'clarify',
      educationTier: turn.education_tier || null,
      adaptivePattern: turn.adaptive_pattern || existingState.adaptivePattern || null,
      contextCapped: isContextCapped,
      contextWindowSize: MAX_CONTEXT_MESSAGES,
      contextCapLastAlertedAt: shouldAlertContextCap ? existingLog.length : lastAlertedAt,
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
        ...(shouldRecordSafetyEvent
          ? [{ turnIndex: turnCount, source: keywordRank >= modelRank ? 'keyword' : 'llm', triggerType: modelTriggerType || keywordTrigger?.type, severity: riskLevel }]
          : [])
      ].slice(-20),
      turnCount,
      lastTurnAt: now
    };

    await req.pool.query(
      'UPDATE sessions SET conversation_log = $1, state = $2 WHERE id = $3',
      [encryptJSON(newLog), JSON.stringify(mergedState), sessionId]
    );

    await req.auditLog(userId, 'CHAT_MESSAGE', 'sessions', sessionId, req);

    res.json({
      reply: turn.reply,
      state: mergedState,
      safety: { riskLevel, clinicianNotified, safetyEventId }
    });
  } catch (error) {
    req.logger.error('Chat orchestration error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

module.exports = router;
