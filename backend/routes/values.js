const express = require('express');
const router = express.Router();
const { encryptField, decryptField } = require('../utils/phiCrypto');

function decryptValue(row) {
  if (!row) return row;
  return { ...row, value_text: decryptField(row.value_text), user_note: decryptField(row.user_note) };
}

// List the caller's values
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await req.pool.query('SELECT * FROM values WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(result.rows.map(decryptValue));
  } catch (error) {
    req.logger.error('Values list error:', error);
    res.status(500).json({ error: 'Failed to list values' });
  }
});

// Shared with routes/documents.js's document-extraction apply endpoint, so
// both the manual "add a value" form and an accepted document-extraction
// candidate write through the same insert logic.
async function createValue(pool, userId, { valueText, importance }) {
  const result = await pool.query(
    `INSERT INTO values (user_id, value_text, importance) VALUES ($1, $2, $3) RETURNING *`,
    [userId, encryptField(valueText), importance || 'high']
  );
  return decryptValue(result.rows[0]);
}

// Create a value
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { valueText, importance } = req.body;

    if (typeof valueText !== 'string' || !valueText.trim()) {
      return res.status(400).json({ error: 'valueText is required' });
    }

    const value = await createValue(req.pool, userId, { valueText, importance });

    await req.auditLog(userId, 'VALUE_CREATED', 'values', value.id, req);

    res.json(value);
  } catch (error) {
    req.logger.error('Value creation error:', error);
    res.status(500).json({ error: 'Failed to create value' });
  }
});

// Update a value (importance/user note)
router.put('/:valueId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { valueId } = req.params;
    const { valueText, importance, userNote } = req.body;

    const result = await req.pool.query(
      `UPDATE values
       SET value_text = COALESCE($1, value_text),
           importance = COALESCE($2, importance),
           user_note = COALESCE($3, user_note),
           last_edited = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [valueText ? encryptField(valueText) : null, importance, userNote ? encryptField(userNote) : null, valueId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Value not found' });
    }

    await req.auditLog(userId, 'VALUE_UPDATED', 'values', valueId, req);

    res.json(decryptValue(result.rows[0]));
  } catch (error) {
    req.logger.error('Value update error:', error);
    res.status(500).json({ error: 'Failed to update value' });
  }
});

module.exports = router;
module.exports.createValue = createValue;
