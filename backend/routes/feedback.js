const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbac');
const { encryptField, decryptField } = require('../utils/phiCrypto');

function decryptFeedback(row) {
  if (!row) return row;
  return {
    ...row,
    feedback_text: decryptField(row.feedback_text),
    challenges_text: decryptField(row.challenges_text),
    improvements_text: decryptField(row.improvements_text)
  };
}

// Submit feedback. challengesText/improvementsText are optional, structured
// alternatives to (or companions of) the general feedbackText -- "Did you
// run into any challenges?" / "What would help you use Sofia more
// regularly?" -- offered alongside the open note rather than replacing it,
// since a direct question surfaces more than a blank box on its own.
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, feedbackText, conversationContext, challengesText, improvementsText } = req.body;

    const result = await req.pool.query(
      `INSERT INTO feedback (user_id, session_id, feedback_text, conversation_context, challenges_text, improvements_text)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        userId,
        sessionId,
        encryptField(feedbackText || ''),
        conversationContext,
        challengesText ? encryptField(challengesText) : null,
        improvementsText ? encryptField(improvementsText) : null
      ]
    );

    await req.auditLog(userId, 'FEEDBACK_SUBMITTED', 'feedback', result.rows[0].id, req);

    res.json(decryptFeedback(result.rows[0]));
  } catch (error) {
    req.logger.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get all unreviewed feedback (clinician/admin only)
router.get('/unreviewed', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const result = await req.pool.query(
      'SELECT * FROM feedback WHERE is_reviewed = false ORDER BY created_at DESC'
    );
    res.json(result.rows.map(decryptFeedback));
  } catch (error) {
    req.logger.error('Feedback fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

module.exports = router;
