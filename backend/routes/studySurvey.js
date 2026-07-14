const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireRole } = require('../middleware/rbac');
const { encryptField, decryptField } = require('../utils/phiCrypto');
const { STUDY_SURVEY_QUESTIONS, STUDY_SURVEY_QUESTIONS_BY_KEY } = require('../utils/studySurveyQuestions');

const SURVEY_VERSION = '1';

function decryptResponseRow(row) {
  return { ...row, explanation: decryptField(row.explanation) };
}

// The canonical question list -- see utils/studySurveyQuestions.js. Served
// from the backend so question wording lives in exactly one place rather
// than being duplicated in the frontend.
router.get('/questions', (req, res) => {
  res.json({ surveyVersion: SURVEY_VERSION, questions: STUDY_SURVEY_QUESTIONS });
});

// Submit some or all of the 16 answers in one sitting. Each response is
// validated against the canonical question list -- unknown keys are
// dropped rather than failing the whole submission, and a rated question
// without a valid 1-5 integer rating is dropped too (open-ended questions
// never require one). explanation is always optional, matching the
// instrument's own "please explain your answer" framing rather than
// forcing an essay. All rows from one submission share a submission_id so
// they can be grouped later without requiring exactly 16 answers.
router.post('/responses', async (req, res) => {
  try {
    const userId = req.user.id;
    const { responses } = req.body;

    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'At least one response is required' });
    }

    const submissionId = crypto.randomUUID();
    const inserted = [];

    for (const response of responses) {
      const question = STUDY_SURVEY_QUESTIONS_BY_KEY[response?.questionKey];
      if (!question) continue;

      const explanation = typeof response.explanation === 'string' ? response.explanation.trim() : '';
      let rating = null;
      if (question.scale !== 'open') {
        const parsed = Number(response.rating);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) continue;
        rating = parsed;
      }
      if (rating === null && !explanation) continue;

      const result = await req.pool.query(
        `INSERT INTO study_survey_responses (user_id, submission_id, survey_version, question_key, rating, explanation)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, submissionId, SURVEY_VERSION, question.key, rating, explanation ? encryptField(explanation) : null]
      );
      inserted.push(decryptResponseRow(result.rows[0]));
    }

    if (inserted.length === 0) {
      return res.status(400).json({ error: 'No valid responses were submitted' });
    }

    await req.auditLog(userId, 'STUDY_SURVEY_SUBMITTED', 'study_survey_responses', submissionId, req);

    res.json({ submissionId, responses: inserted });
  } catch (error) {
    req.logger.error('Study survey submission error:', error);
    res.status(500).json({ error: 'Failed to submit survey responses' });
  }
});

// The authenticated person's own past submissions -- lets the frontend
// show "you already completed this" rather than only ever offering a
// blank form, and lets someone see what they previously said.
router.get('/responses/mine', async (req, res) => {
  try {
    const result = await req.pool.query(
      'SELECT * FROM study_survey_responses WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows.map(decryptResponseRow));
  } catch (error) {
    req.logger.error('Study survey (mine) fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch your survey responses' });
  }
});

// All raw responses, decrypted, for qualitative review (clinician/admin
// only) -- mirrors the existing GET /api/feedback/unreviewed access
// pattern (requireRole).
router.get('/responses', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM study_survey_responses ORDER BY created_at DESC');
    res.json(result.rows.map(decryptResponseRow));
  } catch (error) {
    req.logger.error('Study survey responses fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch survey responses' });
  }
});

// Per-question aggregate (average rating + response count) -- computed in
// SQL since `rating` is a plain, unencrypted integer column (only
// `explanation` is application-layer encrypted), so this doesn't need to
// decrypt anything to aggregate.
router.get('/responses/summary', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const result = await req.pool.query(
      `SELECT question_key,
              COUNT(*) FILTER (WHERE rating IS NOT NULL) AS rated_count,
              AVG(rating) AS average_rating,
              COUNT(*) AS response_count
       FROM study_survey_responses
       GROUP BY question_key
       ORDER BY question_key`
    );
    res.json(
      result.rows.map((row) => ({
        questionKey: row.question_key,
        ratedCount: Number(row.rated_count),
        averageRating: row.average_rating !== null ? Number(row.average_rating) : null,
        responseCount: Number(row.response_count)
      }))
    );
  } catch (error) {
    req.logger.error('Study survey summary error:', error);
    res.status(500).json({ error: 'Failed to summarize survey responses' });
  }
});

module.exports = router;
