// Shared per-user context fetch, used both for a normal chat turn
// (routes/chat.js) and the session-opening turn (routes/sessions.js) -- the
// same profile/goals/chapters/documents shape backs both, and this is also
// where profile completeness (see routes/users.js calculateCompleteness)
// gets surfaced for the "invite the person to fill in their profile" nudge
// in utils/systemPrompt.js.
const { decryptJSON, decryptField } = require('./phiCrypto');

async function loadUserContext(pool, userId) {
  const [
    aboutMeResult,
    goalsResult,
    chaptersResult,
    documentsResult,
    valuesResult,
    concernsResult,
    educationTopicsResult,
    clinicalReportResult
  ] = await Promise.all([
    pool.query('SELECT * FROM about_me_profiles WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    pool.query('SELECT * FROM story_chapters WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5', [userId]),
    pool.query(
      'SELECT filename, metadata FROM document_uploads WHERE user_id = $1 ORDER BY upload_timestamp DESC LIMIT 3',
      [userId]
    ),
    pool.query('SELECT * FROM values WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    pool.query('SELECT * FROM concerns WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    pool.query('SELECT * FROM education_topics WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    // Most recent clinical report only -- see database/migrations/009_clinical_reports.sql
    // and utils/systemPrompt.js's "Diagnostic information on file" section.
    pool.query(
      'SELECT report_data, report_date FROM clinical_reports WHERE user_id = $1 ORDER BY report_date DESC NULLS LAST, created_at DESC LIMIT 1',
      [userId]
    )
  ]);

  const aboutMeRow = aboutMeResult.rows[0];
  const aboutMe = aboutMeRow
    ? {
        ...aboutMeRow,
        best_life_elements: decryptJSON(aboutMeRow.best_life_elements) || [],
        concerns: decryptJSON(aboutMeRow.concerns) || []
      }
    : null;
  const goals = goalsResult.rows.map((goal) => ({ ...goal, goal: decryptField(goal.goal) }));
  const chapters = chaptersResult.rows;
  const documents = documentsResult.rows.map((row) => {
    const metadata = decryptJSON(row.metadata) || {};
    return { filename: row.filename, extractedText: metadata.extractedText || '' };
  });
  const values = valuesResult.rows.map((value) => ({ ...value, value_text: decryptField(value.value_text) }));
  const concerns = concernsResult.rows.map((concern) => ({ ...concern, concern: decryptField(concern.concern) }));
  const educationTopics = educationTopicsResult.rows.map((topic) => ({ ...topic, topic: decryptField(topic.topic) }));
  const profileCompleteness = aboutMeRow?.profile_completeness ?? 0;
  const clinicalReportRow = clinicalReportResult.rows[0];
  const clinicalReport = clinicalReportRow ? decryptJSON(clinicalReportRow.report_data) : null;

  return { aboutMe, goals, chapters, documents, values, concerns, educationTopics, profileCompleteness, clinicalReport };
}

module.exports = { loadUserContext };
