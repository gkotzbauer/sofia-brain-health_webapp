const express = require('express');
const router = express.Router();
const { createClinicalAlert } = require('../utils/clinicalAlerts');

// Create safety event
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId, triggerType, severity, keywords, context } = req.body;
    
    // Check if clinician notification is needed
    const notifyClinicician = severity === 'critical' || severity === 'high';
    
    const result = await req.pool.query(
      `INSERT INTO safety_events 
       (user_id, session_id, trigger_type, severity, keywords, context, clinician_notified)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, sessionId, triggerType, severity, keywords, context, notifyClinicician]
    );
    
    // Create clinical alert if needed
    if (notifyClinicician) {
      await createClinicalAlert(req.pool, req.logger, userId, result.rows[0].id, severity, context);
    }
    
    await req.auditLog(userId, 'SAFETY_EVENT_CREATED', 'safety_events', result.rows[0].id, req);
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Safety event creation error:', error);
    res.status(500).json({ error: 'Failed to create safety event' });
  }
});

module.exports = router;
