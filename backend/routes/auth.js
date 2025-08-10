const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// User registration/login endpoint
router.post('/users/auth', async (req, res) => {
  try {
    const { name, age } = req.body;
    
    // Check if user exists
    let result = await req.pool.query('SELECT * FROM users WHERE name = $1', [name]);
    let user;
    
    if (result.rows.length === 0) {
      // Create new user
      result = await req.pool.query(
        'INSERT INTO users (name, age) VALUES ($1, $2) RETURNING *',
        [name, age]
      );
      user = result.rows[0];
      
      // Create empty About Me profile
      await req.pool.query(
        'INSERT INTO about_me_profiles (user_id) VALUES ($1)',
        [user.id]
      );
      
      await req.auditLog(user.id, 'USER_CREATED', 'users', user.id, req);
    } else {
      user = result.rows[0];
      // Update last visit
      await req.pool.query(
        'UPDATE users SET last_visit = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      await req.auditLog(user.id, 'USER_LOGIN', 'users', user.id, req);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, user });
  } catch (error) {
    req.logger.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
