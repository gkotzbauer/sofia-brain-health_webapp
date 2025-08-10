const express = require('express');
const router = express.Router();

// Create goal
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { goal, confidence, linkedBestLifeElements } = req.body;
    
    const result = await req.pool.query(
      `INSERT INTO goals (user_id, goal, confidence, linked_best_life_elements)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, goal, confidence, linkedBestLifeElements]
    );
    
    await req.auditLog(userId, 'GOAL_CREATED', 'goals', result.rows[0].id, req);
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Goal creation error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

module.exports = router;
