const express = require('express');
const router = express.Router();

// Create new session
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await req.pool.query(
      'INSERT INTO sessions (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    
    // Update user's total sessions
    await req.pool.query(
      'UPDATE users SET total_sessions = total_sessions + 1 WHERE id = $1',
      [userId]
    );
    
    await req.auditLog(userId, 'SESSION_CREATED', 'sessions', result.rows[0].id, req);
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session
router.put('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { duration_minutes, main_topics, conversation_log } = req.body;
    
    const result = await req.pool.query(
      `UPDATE sessions 
       SET duration_minutes = $1, main_topics = $2, conversation_log = $3
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [duration_minutes, main_topics, JSON.stringify(conversation_log), sessionId, req.user.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Session update error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

module.exports = router;
