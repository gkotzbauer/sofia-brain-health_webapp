const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Real credentials replace the old name-only "authentication". Tighter than
// the global API limiter since this is the highest-value target for abuse.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

function issueToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

router.post('/auth/register', loginLimiter, async (req, res) => {
  try {
    const { name, email, password, age } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await req.pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await req.pool.query(
      `INSERT INTO users (name, email, password_hash, age, role)
       VALUES ($1, $2, $3, $4, 'user') RETURNING *`,
      [name, normalizedEmail, passwordHash, age]
    );
    const user = result.rows[0];

    await req.pool.query('INSERT INTO about_me_profiles (user_id) VALUES ($1)', [user.id]);
    await req.auditLog(user.id, 'USER_CREATED', 'users', user.id, req);

    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    req.logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const result = await req.pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [normalizedEmail]
    );
    const user = result.rows[0];

    // Always run bcrypt.compare, even for a nonexistent user, against a
    // dummy hash -- avoids leaking account existence via response timing.
    const passwordHash = user?.password_hash || '$2a$12$abcdefghijklmnopqrstuuOG0000000000000000000000000000';
    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(password, passwordHash);
    } catch (compareError) {
      passwordMatches = false;
    }

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await req.pool.query('UPDATE users SET last_visit = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    await req.auditLog(user.id, 'USER_LOGIN', 'users', user.id, req);

    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    req.logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
