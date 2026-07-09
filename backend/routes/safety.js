const express = require('express');
const router = express.Router();
const { recordSafetyEvent } = require('../utils/safetyEvents');

// Create safety event (client-reported, e.g. an explicit "I need help now" action)
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, triggerType, severity, keywords, context } = req.body;

    const { safetyEvent, clinicianNotified } = await recordSafetyEvent(
      req.pool, req.logger, req.auditLog, req,
      { userId, sessionId, triggerType, severity, keywords, context }
    );

    res.json({ ...safetyEvent, clinicianNotified });
  } catch (error) {
    req.logger.error('Safety event creation error:', error);
    res.status(500).json({ error: 'Failed to create safety event' });
  }
});

module.exports = router;
