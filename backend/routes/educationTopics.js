const express = require('express');
const router = express.Router();
const { encryptField, decryptField } = require('../utils/phiCrypto');

function decryptTopic(row) {
  if (!row) return row;
  return { ...row, topic: decryptField(row.topic), user_note: decryptField(row.user_note) };
}

// List the caller's education topics
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await req.pool.query('SELECT * FROM education_topics WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(result.rows.map(decryptTopic));
  } catch (error) {
    req.logger.error('Education topics list error:', error);
    res.status(500).json({ error: 'Failed to list education topics' });
  }
});

// Shared with routes/documents.js's document-extraction apply endpoint.
async function createEducationTopic(pool, userId, { topic, engagement }) {
  const result = await pool.query(
    `INSERT INTO education_topics (user_id, topic, engagement) VALUES ($1, $2, $3) RETURNING *`,
    [userId, encryptField(topic), engagement || 'moderate']
  );
  return decryptTopic(result.rows[0]);
}

// Create an education topic
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic, engagement } = req.body;

    if (typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const created = await createEducationTopic(req.pool, userId, { topic, engagement });

    await req.auditLog(userId, 'EDUCATION_TOPIC_CREATED', 'education_topics', created.id, req);

    res.json(created);
  } catch (error) {
    req.logger.error('Education topic creation error:', error);
    res.status(500).json({ error: 'Failed to create education topic' });
  }
});

// Update an education topic (engagement/user note)
router.put('/:topicId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { topicId } = req.params;
    const { topic, engagement, userNote } = req.body;

    const result = await req.pool.query(
      `UPDATE education_topics
       SET topic = COALESCE($1, topic),
           engagement = COALESCE($2, engagement),
           user_note = COALESCE($3, user_note),
           last_edited = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [topic ? encryptField(topic) : null, engagement, userNote ? encryptField(userNote) : null, topicId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Education topic not found' });
    }

    await req.auditLog(userId, 'EDUCATION_TOPIC_UPDATED', 'education_topics', topicId, req);

    res.json(decryptTopic(result.rows[0]));
  } catch (error) {
    req.logger.error('Education topic update error:', error);
    res.status(500).json({ error: 'Failed to update education topic' });
  }
});

module.exports = router;
module.exports.createEducationTopic = createEducationTopic;
