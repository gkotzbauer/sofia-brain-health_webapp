const express = require('express');
const router = express.Router();

// Create story chapter
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, moment, moodArc, choices, learning, linkedBestLifeElements } = req.body;
    
    const result = await req.pool.query(
      `INSERT INTO story_chapters 
       (user_id, title, moment, mood_arc, choices, learning, linked_best_life_elements)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, title, moment, moodArc, choices, learning, linkedBestLifeElements]
    );
    
    await req.auditLog(userId, 'CHAPTER_CREATED', 'story_chapters', result.rows[0].id, req);
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Chapter creation error:', error);
    res.status(500).json({ error: 'Failed to create chapter' });
  }
});

module.exports = router;
