-- Enables application-layer AES encryption (see backend/utils/phiCrypto.js)
-- for PHI-bearing columns. Columns that were already TEXT/TEXT[] need no
-- type change -- only the route layer changes to encrypt/decrypt through
-- them. Columns that were JSONB must become TEXT, since ciphertext is an
-- opaque string, not valid JSON.
--
-- Existing rows are cast to their text representation rather than actually
-- encrypted in place; this is acceptable for this prototype's pre-existing
-- dev/staging data (see refactor plan). All new writes go through phiCrypto.

ALTER TABLE about_me_profiles
  ALTER COLUMN best_life_elements DROP DEFAULT,
  ALTER COLUMN best_life_elements TYPE TEXT USING best_life_elements::text,
  ALTER COLUMN concerns DROP DEFAULT,
  ALTER COLUMN concerns TYPE TEXT USING concerns::text;

ALTER TABLE sessions
  ALTER COLUMN conversation_log DROP DEFAULT,
  ALTER COLUMN conversation_log TYPE TEXT USING conversation_log::text;

ALTER TABLE document_uploads
  ALTER COLUMN metadata TYPE TEXT USING metadata::text;

COMMENT ON COLUMN about_me_profiles.best_life_elements IS 'AES ciphertext (backend/utils/phiCrypto.js) of a JSON array. Previously plaintext JSONB.';
COMMENT ON COLUMN about_me_profiles.concerns IS 'AES ciphertext of a JSON array. Previously plaintext JSONB.';
COMMENT ON COLUMN sessions.conversation_log IS 'AES ciphertext of a JSON array of conversation turns. Previously plaintext JSONB.';
COMMENT ON COLUMN document_uploads.metadata IS 'AES ciphertext of a JSON object (may embed extractedText). Previously plaintext JSONB.';
COMMENT ON COLUMN goals.goal IS 'Application-layer AES ciphertext (backend/utils/phiCrypto.js), stored in the existing TEXT column.';
COMMENT ON COLUMN story_chapters.moment IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN story_chapters.choices IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN story_chapters.learning IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN safety_events.keywords IS 'Each element is application-layer AES ciphertext, stored in the existing TEXT[] column.';
COMMENT ON COLUMN safety_events.context IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN feedback.feedback_text IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
