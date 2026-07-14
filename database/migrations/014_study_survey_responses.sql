-- The actual 16-question feasibility study instrument (Feasibility x4,
-- Quality of Life x1, Confidence/Capability x7, Adaptability x4 -- see
-- backend/utils/studySurveyQuestions.js for the canonical question list),
-- so the endpoints evaluated by hand this session can be measured with
-- real users instead of only predicted.
--
-- Row-per-answer rather than one JSON blob per submission, so ratings are
-- directly queryable/aggregable per question across all users (see
-- GET /api/study-survey/responses/summary) -- rating is a plain integer
-- (not PHI on its own), while explanation is a free-text personal account
-- and is AES ciphertext (backend/utils/phiCrypto.js encryptField), matching
-- every other free-text PHI column in this app. submission_id groups the
-- rows from one sitting together without forcing exactly-16-rows-or-
-- nothing at the database level (a person can submit a partial set).
CREATE TABLE study_survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL,
    survey_version VARCHAR(20) NOT NULL DEFAULT '1',
    question_key VARCHAR(50) NOT NULL,
    rating INTEGER,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_study_survey_responses_user ON study_survey_responses(user_id);
CREATE INDEX idx_study_survey_responses_question ON study_survey_responses(question_key);
CREATE INDEX idx_study_survey_responses_submission ON study_survey_responses(submission_id);
