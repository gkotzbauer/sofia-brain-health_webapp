const express = require('express');
const router = express.Router();
const { encryptJSON, decryptJSON } = require('../utils/phiCrypto');

function decryptSession(row) {
  if (!row) return row;
  return {
    ...row,
    conversation_log: decryptJSON(row.conversation_log) || [],
    state: row.state || {}
  };
}

// List sessions for the current user (most recent first), for resuming/history
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await req.pool.query(
      `SELECT id, session_date, duration_minutes, main_topics, mood, created_at
       FROM sessions WHERE user_id = $1 ORDER BY session_date DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    req.logger.error('Session list error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Get a single session (transcript + conversation state), for reloading a chat
router.get('/:sessionId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const result = await req.pool.query(
      'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(decryptSession(result.rows[0]));
  } catch (error) {
    req.logger.error('Session fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create new session
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;

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

    res.json(decryptSession(result.rows[0]));
  } catch (error) {
    req.logger.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session (client-driven metadata sync; the /api/chat endpoint is the
// primary writer of conversation_log/state during an active conversation)
router.put('/:sessionId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { duration_minutes, main_topics, conversation_log } = req.body;

    const result = await req.pool.query(
      `UPDATE sessions
       SET duration_minutes = $1, main_topics = $2, conversation_log = $3
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [duration_minutes, main_topics, encryptJSON(conversation_log), sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await req.auditLog(userId, 'SESSION_UPDATED', 'sessions', sessionId, req);

    res.json(decryptSession(result.rows[0]));
  } catch (error) {
    req.logger.error('Session update error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

module.exports = router;
