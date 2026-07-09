const axios = require('axios');

// Creates a clinical alert (shown in the clinician queue, GET
// /api/admin/clinical-alerts/pending) and fires the configured webhook, if
// any. `sessionId` lets a clinician jump straight from the alert to the
// conversation it came from (see routes/admin.js GET /sessions/:sessionId).
// `alertType` distinguishes genuine safety triggers from operational
// notices like a context-window cap, so the clinician UI can treat them
// with different urgency.
async function createClinicalAlert(pool, logger, { userId, sessionId = null, safetyEventId = null, alertType = 'safety_trigger', priority, message }) {
  try {
    const alertResult = await pool.query(
      `INSERT INTO clinical_alerts
       (user_id, session_id, safety_event_id, alert_type, priority, message)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, sessionId, safetyEventId, alertType, priority, message]
    );

    // Send webhook to clinician system (if configured)
    if (process.env.CLINICIAN_WEBHOOK_URL) {
      await axios.post(process.env.CLINICIAN_WEBHOOK_URL, {
        alertId: alertResult.rows[0].id,
        userId,
        sessionId,
        alertType,
        priority,
        message,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Clinical alert created for user ${userId} (${alertType}, priority ${priority})`);
    return alertResult.rows[0];
  } catch (error) {
    logger.error('Clinical alert creation error:', error);
    return null;
  }
}

module.exports = { createClinicalAlert };
