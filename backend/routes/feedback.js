const express = require('express');
const router = express.Router();

// Submit feedback
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId, feedbackText, conversationContext } = req.body;
    
    const result = await req.pool.query(
      `INSERT INTO feedback (user_id, session_id, feedback_text, conversation_context)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, sessionId, feedbackText, conversationContext]
    );
    
    await req.auditLog(userId, 'FEEDBACK_SUBMITTED', 'feedback', result.rows[0].id, req);
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get all feedback for review (admin)
router.get('/unreviewed', async (req, res) => {
  try {
    const result = await req.pool.query(
      'SELECT * FROM feedback WHERE is_reviewed = false ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    req.logger.error('Feedback fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

module.exports = router;
