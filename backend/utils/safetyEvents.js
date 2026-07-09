const { createClinicalAlert } = require('./clinicalAlerts');
const { encryptField, decryptField } = require('./phiCrypto');

// Shared by routes/safety.js (client-reported events, e.g. an explicit
// "I need help now" action) and routes/chat.js (server-detected events from
// the safety pre-filter / LLM safety_assessment) so the insert + clinical
// alert logic only lives in one place.
async function recordSafetyEvent(pool, logger, auditLog, req, { userId, sessionId, triggerType, severity, keywords, context }) {
  const notifyClinicician = severity === 'critical' || severity === 'high';
  const encryptedKeywords = Array.isArray(keywords) ? keywords.map((keyword) => encryptField(keyword)) : keywords;

  const result = await pool.query(
    `INSERT INTO safety_events
     (user_id, session_id, trigger_type, severity, keywords, context, clinician_notified)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, sessionId, triggerType, severity, encryptedKeywords, encryptField(context), notifyClinicician]
  );

  // Clinical alert (and any webhook) only fires here -- callers must never
  // claim a clinician was notified unless this actually ran and succeeded.
  if (notifyClinicician) {
    await createClinicalAlert(pool, logger, {
      userId,
      sessionId,
      safetyEventId: result.rows[0].id,
      alertType: 'safety_trigger',
      priority: severity,
      message: `User requires immediate clinical attention. Context: ${context}`
    });
  }

  await auditLog(userId, 'SAFETY_EVENT_CREATED', 'safety_events', result.rows[0].id, req);

  const safetyEvent = {
    ...result.rows[0],
    keywords: Array.isArray(result.rows[0].keywords)
      ? result.rows[0].keywords.map((keyword) => decryptField(keyword))
      : result.rows[0].keywords,
    context: decryptField(result.rows[0].context)
  };

  return { safetyEvent, clinicianNotified: notifyClinicician };
}

module.exports = { recordSafetyEvent };
