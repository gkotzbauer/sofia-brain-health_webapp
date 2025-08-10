const express = require('express');
const router = express.Router();

// Get clinical alerts (admin endpoint - add proper auth in production)
router.get('/clinical-alerts/pending', async (req, res) => {
  try {
    const result = await req.pool.query(
      `SELECT ca.*, u.name as user_name, se.context 
       FROM clinical_alerts ca
       JOIN users u ON ca.user_id = u.id
       LEFT JOIN safety_events se ON ca.safety_event_id = se.id
       WHERE ca.acknowledged = false 
       ORDER BY ca.priority DESC, ca.created_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    req.logger.error('Clinical alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get comprehensive audit trail for a user
router.get('/audit-trail/:userId', async (req, res) => {
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
