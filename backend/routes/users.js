const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { calculateCompleteness } = require('../utils/helpers');
const { encryptJSON, decryptJSON, encryptField, decryptField } = require('../utils/phiCrypto');

function decryptAboutMe(row) {
  if (!row) return row;
  return {
    ...row,
    best_life_elements: decryptJSON(row.best_life_elements) || [],
    concerns: decryptJSON(row.concerns) || []
  };
}

// Get user profile with all data
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const userResult = await req.pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const { password_hash, ...user } = userResult.rows[0] || {};

    // Get About Me profile
    const aboutMeResult = await req.pool.query(
      'SELECT * FROM about_me_profiles WHERE user_id = $1',
      [userId]
    );

    // Get story chapters
    const chaptersResult = await req.pool.query(
      'SELECT * FROM story_chapters WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Get goals
    const goalsResult = await req.pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Get concerns
    const concernsResult = await req.pool.query(
      'SELECT * FROM concerns WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Get values
    const valuesResult = await req.pool.query(
      'SELECT * FROM values WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Get education topics
    const educationResult = await req.pool.query(
      'SELECT * FROM education_topics WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    await req.auditLog(userId, 'PROFILE_VIEWED', 'users', userId, req);

    res.json({
      user,
      aboutMe: decryptAboutMe(aboutMeResult.rows[0]),
      storyChapters: chaptersResult.rows.map((chapter) => ({
        ...chapter,
        moment: decryptField(chapter.moment),
        choices: decryptField(chapter.choices),
        learning: decryptField(chapter.learning)
      })),
      goals: goalsResult.rows.map((goal) => ({
        ...goal,
        goal: decryptField(goal.goal),
        user_note: decryptField(goal.user_note)
      })),
      concerns: concernsResult.rows.map((concern) => ({
        ...concern,
        concern: decryptField(concern.concern),
        context: decryptField(concern.context),
        user_note: decryptField(concern.user_note)
      })),
      values: valuesResult.rows.map((value) => ({
        ...value,
        value_text: decryptField(value.value_text),
        user_note: decryptField(value.user_note)
      })),
      educationTopics: educationResult.rows.map((topic) => ({
        ...topic,
        topic: decryptField(topic.topic),
        user_note: decryptField(topic.user_note)
      }))
    });
  } catch (error) {
    req.logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Shared with routes/documents.js's document-extraction apply endpoint --
// `source`/`sourceDetails` let a document-derived update tag its
// profile_variable_history rows distinctly from a manual edit (see
// profile_variable_history.source, already used elsewhere to distinguish
// 'manual' from 'document').
async function updateAboutMe(pool, userId, { bestLifeElements, concerns, confidenceLevel, userDefinedNextSteps }, options = {}) {
  const source = options.source || 'manual';
  const sourceDetails = options.sourceDetails || { action: 'about_me_update', timestamp: new Date().toISOString() };

  const currentResult = await pool.query('SELECT * FROM about_me_profiles WHERE user_id = $1', [userId]);
  const current = currentResult.rows[0];
  const currentBestLifeElements = current ? decryptJSON(current.best_life_elements) || [] : [];
  const currentConcerns = current ? decryptJSON(current.concerns) || [] : [];

  if (current) {
    if (JSON.stringify(currentBestLifeElements) !== JSON.stringify(bestLifeElements)) {
      await pool.query(
        `INSERT INTO profile_variable_history
         (user_id, variable_name, variable_value, previous_value, source, source_details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, 'bestLifeElements', encryptJSON(bestLifeElements), encryptJSON(currentBestLifeElements), source, encryptJSON(sourceDetails)]
      );
    }

    if (JSON.stringify(currentConcerns) !== JSON.stringify(concerns)) {
      await pool.query(
        `INSERT INTO profile_variable_history
         (user_id, variable_name, variable_value, previous_value, source, source_details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, 'concerns', encryptJSON(concerns), encryptJSON(currentConcerns), source, encryptJSON(sourceDetails)]
      );
    }

    if (current.confidence_level !== confidenceLevel) {
      await pool.query(
        `INSERT INTO profile_variable_history
         (user_id, variable_name, variable_value, previous_value, source, source_details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, 'confidenceLevel', encryptField(confidenceLevel), encryptField(current.confidence_level), source, encryptJSON(sourceDetails)]
      );
    }
  }

  const result = await pool.query(
    `UPDATE about_me_profiles
     SET best_life_elements = $1, concerns = $2, confidence_level = $3,
         user_defined_next_steps = $4, profile_completeness = $5
     WHERE user_id = $6 RETURNING *`,
    [
      encryptJSON(bestLifeElements),
      encryptJSON(concerns),
      confidenceLevel,
      JSON.stringify(userDefinedNextSteps),
      calculateCompleteness(bestLifeElements, concerns, confidenceLevel),
      userId
    ]
  );

  return decryptAboutMe(result.rows[0]);
}

// Update About Me profile
router.put('/about-me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { bestLifeElements, concerns, confidenceLevel, userDefinedNextSteps } = req.body;

    const updated = await updateAboutMe(req.pool, userId, { bestLifeElements, concerns, confidenceLevel, userDefinedNextSteps });

    await req.auditLog(userId, 'ABOUT_ME_UPDATED', 'about_me_profiles', updated.id, req);

    res.json(updated);
  } catch (error) {
    req.logger.error('About Me update error:', error);
    res.status(500).json({ error: 'Failed to update About Me profile' });
  }
});

// Delete the caller's own account and all associated data. Password-
// confirmed (not just JWT possession) so a stolen/leaked token alone can't
// destroy an account. Every PHI-bearing table has an ON DELETE CASCADE (or,
// for audit_log, ON DELETE SET NULL -- the audit trail intentionally
// survives account deletion) foreign key to users.id, so deleting the user
// row is a genuine, complete erasure -- see database/schema.sql. The
// deletion event itself is audit-logged BEFORE the delete so the record of
// "this account was deleted" is captured while user_id is still valid.
router.delete('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'password is required to confirm account deletion' });
    }

    const result = await req.pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(password, result.rows[0].password_hash || '');
    } catch (compareError) {
      passwordMatches = false;
    }
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    await req.auditLog(userId, 'ACCOUNT_DELETED', 'users', userId, req);
    await req.pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ success: true, message: 'Your account and all associated data have been deleted.' });
  } catch (error) {
    req.logger.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
module.exports.updateAboutMe = updateAboutMe;
