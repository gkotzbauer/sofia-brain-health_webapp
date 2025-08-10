const axios = require('axios');

// Helper function to create clinical alerts
async function createClinicalAlert(pool, logger, userId, safetyEventId, priority, context) {
  try {
    const alertResult = await pool.query(
      `INSERT INTO clinical_alerts 
       (user_id, safety_event_id, alert_type, priority, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        userId,
        safetyEventId,
        'safety_trigger',
        priority,
        `User requires immediate clinical attention. Context: ${context}`
      ]
    );
    
    // Send webhook to clinician system (if configured)
    if (process.env.CLINICIAN_WEBHOOK_URL) {
      await axios.post(process.env.CLINICIAN_WEBHOOK_URL, {
        alertId: alertResult.rows[0].id,
        userId,
        priority,
        context,
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`Clinical alert created for user ${userId} with priority ${priority}`);
  } catch (error) {
    logger.error('Clinical alert creation error:', error);
  }
}

module.exports = { createClinicalAlert };
