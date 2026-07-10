const express = require('express');
const router = express.Router();
const { encryptField, decryptField } = require('../utils/phiCrypto');

function decryptConcern(row) {
  if (!row) return row;
  return {
    ...row,
    concern: decryptField(row.concern),
    context: decryptField(row.context),
    user_note: decryptField(row.user_note)
  };
}

// List the caller's concerns
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await req.pool.query('SELECT * FROM concerns WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(result.rows.map(decryptConcern));
  } catch (error) {
    req.logger.error('Concerns list error:', error);
    res.status(500).json({ error: 'Failed to list concerns' });
  }
});

// Create a concern
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { concern, severity, context } = req.body;

    if (typeof concern !== 'string' || !concern.trim()) {
      return res.status(400).json({ error: 'concern is required' });
    }

    const result = await req.pool.query(
      `INSERT INTO concerns (user_id, concern, severity, context) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, encryptField(concern), severity || 'moderate', encryptField(context)]
    );

    await req.auditLog(userId, 'CONCERN_CREATED', 'concerns', result.rows[0].id, req);

    res.json(decryptConcern(result.rows[0]));
  } catch (error) {
    req.logger.error('Concern creation error:', error);
    res.status(500).json({ error: 'Failed to create concern' });
  }
});

// Update a concern (severity/context/user note)
router.put('/:concernId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { concernId } = req.params;
    const { concern, severity, context, userNote } = req.body;

    const result = await req.pool.query(
      `UPDATE concerns
       SET concern = COALESCE($1, concern),
           severity = COALESCE($2, severity),
           context = COALESCE($3, context),
           user_note = COALESCE($4, user_note),
           last_edited = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [
        concern ? encryptField(concern) : null,
        severity,
        context ? encryptField(context) : null,
        userNote ? encryptField(userNote) : null,
        concernId,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Concern not found' });
    }

    await req.auditLog(userId, 'CONCERN_UPDATED', 'concerns', concernId, req);

    res.json(decryptConcern(result.rows[0]));
  } catch (error) {
    req.logger.error('Concern update error:', error);
    res.status(500).json({ error: 'Failed to update concern' });
  }
});

module.exports = router;
