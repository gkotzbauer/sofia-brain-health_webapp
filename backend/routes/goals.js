const express = require('express');
const router = express.Router();
const { encryptField, decryptField } = require('../utils/phiCrypto');

function decryptGoal(row) {
  if (!row) return row;
  return { ...row, goal: decryptField(row.goal), user_note: decryptField(row.user_note) };
}

function decryptProgress(row) {
  if (!row) return row;
  return { ...row, progress_note: decryptField(row.progress_note) };
}

// List goals for the current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await req.pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(result.rows.map(decryptGoal));
  } catch (error) {
    req.logger.error('Goal list error:', error);
    res.status(500).json({ error: 'Failed to list goals' });
  }
});

// Create goal
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal, confidence, linkedBestLifeElements } = req.body;

    const result = await req.pool.query(
      `INSERT INTO goals (user_id, goal, confidence, linked_best_life_elements)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, encryptField(goal), confidence, linkedBestLifeElements]
    );

    await req.auditLog(userId, 'GOAL_CREATED', 'goals', result.rows[0].id, req);

    res.json(decryptGoal(result.rows[0]));
  } catch (error) {
    req.logger.error('Goal creation error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Update a goal (confidence/status/note) -- supports the confidence-gate's
// "probe further, then revise" branch as well as marking goals
// completed/paused/abandoned
router.put('/:goalId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { goalId } = req.params;
    const { goal, confidence, status, userNote } = req.body;

    const result = await req.pool.query(
      `UPDATE goals
       SET goal = COALESCE($1, goal),
           confidence = COALESCE($2, confidence),
           status = COALESCE($3, status),
           user_note = COALESCE($4, user_note),
           last_edited = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [goal ? encryptField(goal) : null, confidence, status, userNote ? encryptField(userNote) : null, goalId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    await req.auditLog(userId, 'GOAL_UPDATED', 'goals', goalId, req);

    res.json(decryptGoal(result.rows[0]));
  } catch (error) {
    req.logger.error('Goal update error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// List progress entries for a goal (ownership-checked)
router.get('/:goalId/progress', async (req, res) => {
  try {
    const userId = req.user.id;
    const { goalId } = req.params;

    const owned = await req.pool.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [goalId, userId]);
    if (owned.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const result = await req.pool.query(
      'SELECT * FROM goal_progress WHERE goal_id = $1 ORDER BY progress_date DESC',
      [goalId]
    );

    res.json(result.rows.map(decryptProgress));
  } catch (error) {
    req.logger.error('Goal progress list error:', error);
    res.status(500).json({ error: 'Failed to list goal progress' });
  }
});

// Record a progress note against a goal
router.post('/:goalId/progress', async (req, res) => {
  try {
    const userId = req.user.id;
    const { goalId } = req.params;
    const { progressNote, confidenceUpdate } = req.body;

    const owned = await req.pool.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [goalId, userId]);
    if (owned.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const result = await req.pool.query(
      `INSERT INTO goal_progress (goal_id, progress_note, confidence_update)
       VALUES ($1, $2, $3) RETURNING *`,
      [goalId, encryptField(progressNote), confidenceUpdate]
    );

    if (confidenceUpdate) {
      await req.pool.query(
        'UPDATE goals SET confidence = $1, last_edited = CURRENT_TIMESTAMP WHERE id = $2',
        [confidenceUpdate, goalId]
      );
    }

    await req.auditLog(userId, 'GOAL_PROGRESS_RECORDED', 'goal_progress', result.rows[0].id, req);

    res.json(decryptProgress(result.rows[0]));
  } catch (error) {
    req.logger.error('Goal progress error:', error);
    res.status(500).json({ error: 'Failed to record goal progress' });
  }
});

module.exports = router;
