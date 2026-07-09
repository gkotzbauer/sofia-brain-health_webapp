const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbac');
const { decryptField, decryptJSON, encryptJSON } = require('../utils/phiCrypto');

// Get clinical alerts (clinician/admin only)
router.get('/clinical-alerts/pending', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const result = await req.pool.query(
      `SELECT ca.*, u.name as user_name, se.context
       FROM clinical_alerts ca
       JOIN users u ON ca.user_id = u.id
       LEFT JOIN safety_events se ON ca.safety_event_id = se.id
       WHERE ca.acknowledged = false
       ORDER BY ca.priority DESC, ca.created_at ASC`
    );
    res.json(result.rows.map((row) => ({ ...row, context: decryptField(row.context) })));
  } catch (error) {
    req.logger.error('Clinical alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Acknowledge a clinical alert (clinician/admin only)
router.put('/clinical-alerts/:alertId/acknowledge', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const { alertId } = req.params;

    const result = await req.pool.query(
      `UPDATE clinical_alerts
       SET acknowledged = true, acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [req.user.name, alertId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await req.auditLog(req.user.id, 'CLINICAL_ALERT_ACKNOWLEDGED', 'clinical_alerts', alertId, req);

    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Clinical alert acknowledge error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Get a specific user's conversation (clinician/admin only) -- lets a
// clinician follow an alert straight to the transcript it came from,
// regardless of who owns the session (unlike GET /api/sessions/:id, which
// is scoped to the requester's own sessions).
router.get('/sessions/:sessionId', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await req.pool.query(
      `SELECT s.*, u.name as user_name, u.id as user_id
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];

    await req.auditLog(req.user.id, 'CLINICIAN_SESSION_VIEWED', 'sessions', sessionId, req);

    res.json({
      ...session,
      conversation_log: decryptJSON(session.conversation_log) || [],
      state: session.state || {}
    });
  } catch (error) {
    req.logger.error('Clinician session fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Post a message into a user's conversation as the care team (clinician/admin
// only). The message is appended to the transcript with role 'clinician' so
// it renders distinctly in the UI and is never sent to Claude as if it were
// the user's or Sofia's own words (see routes/chat.js's role filter).
router.post('/sessions/:sessionId/messages', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const sessionResult = await req.pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionResult.rows[0];
    const existingLog = decryptJSON(session.conversation_log) || [];

    const newLog = [
      ...existingLog,
      {
        role: 'clinician',
        content: message.trim(),
        authorName: req.user.name,
        timestamp: new Date().toISOString()
      }
    ];

    const result = await req.pool.query(
      'UPDATE sessions SET conversation_log = $1 WHERE id = $2 RETURNING *',
      [encryptJSON(newLog), sessionId]
    );

    await req.auditLog(req.user.id, 'CLINICIAN_MESSAGE_SENT', 'sessions', sessionId, req);

    res.json({
      ...result.rows[0],
      conversation_log: decryptJSON(result.rows[0].conversation_log) || [],
      state: result.rows[0].state || {}
    });
  } catch (error) {
    req.logger.error('Clinician message send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get comprehensive audit trail for a user (clinician/admin only)
router.get('/audit-trail/:userId', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    let query = `
      SELECT
        al.*,
        u.name as user_name
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = $1
    `;
    const params = [userId];

    if (startDate) {
      query += ` AND al.created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND al.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await req.pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    req.logger.error('Audit trail fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

module.exports = router;
