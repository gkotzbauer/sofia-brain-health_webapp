const express = require('express');
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
      goals: goalsResult.rows.map((goal) => ({ ...goal, goal: decryptField(goal.goal) })),
      concerns: concernsResult.rows,
      values: valuesResult.rows,
      educationTopics: educationResult.rows
    });
  } catch (error) {
    req.logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update About Me profile
router.put('/about-me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { bestLifeElements, concerns, confidenceLevel, userDefinedNextSteps } = req.body;

    // Get current values for comparison
    const currentResult = await req.pool.query(
      'SELECT * FROM about_me_profiles WHERE user_id = $1',
      [userId]
    );
    const current = currentResult.rows[0];
    const currentBestLifeElements = current ? decryptJSON(current.best_life_elements) || [] : [];
    const currentConcerns = current ? decryptJSON(current.concerns) || [] : [];

    // Track changes in profile history
    if (current) {
      // Track best life elements changes
      if (JSON.stringify(currentBestLifeElements) !== JSON.stringify(bestLifeElements)) {
        await req.pool.query(
          `INSERT INTO profile_variable_history
           (user_id, variable_name, variable_value, previous_value, source, source_details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            'bestLifeElements',
            encryptJSON(bestLifeElements),
            encryptJSON(currentBestLifeElements),
            'manual',
            encryptJSON({ action: 'about_me_update', timestamp: new Date().toISOString() })
          ]
        );
      }

      // Track concerns changes
      if (JSON.stringify(currentConcerns) !== JSON.stringify(concerns)) {
        await req.pool.query(
          `INSERT INTO profile_variable_history
           (user_id, variable_name, variable_value, previous_value, source, source_details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            'concerns',
            encryptJSON(concerns),
            encryptJSON(currentConcerns),
            'manual',
            encryptJSON({ action: 'about_me_update', timestamp: new Date().toISOString() })
          ]
        );
      }

      // Track confidence level changes
      if (current.confidence_level !== confidenceLevel) {
        await req.pool.query(
          `INSERT INTO profile_variable_history
           (user_id, variable_name, variable_value, previous_value, source, source_details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            'confidenceLevel',
            encryptField(confidenceLevel),
            encryptField(current.confidence_level),
            'manual',
            encryptJSON({ action: 'about_me_update', timestamp: new Date().toISOString() })
          ]
        );
      }
    }

    const result = await req.pool.query(
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

    await req.auditLog(userId, 'ABOUT_ME_UPDATED', 'about_me_profiles', result.rows[0].id, req);

    res.json(decryptAboutMe(result.rows[0]));
  } catch (error) {
    req.logger.error('About Me update error:', error);
    res.status(500).json({ error: 'Failed to update About Me profile' });
  }
});

module.exports = router;
