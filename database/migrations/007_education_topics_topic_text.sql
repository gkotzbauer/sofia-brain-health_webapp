-- education_topics.topic is about to be encrypted at the application layer
-- (see routes/educationTopics.js). AES ciphertext is larger than its
-- plaintext and could exceed a VARCHAR(255) limit depending on input
-- length, so widen it to TEXT first -- same defensive reasoning as the
-- JSONB->TEXT conversions in 003_phi_encryption.sql.
ALTER TABLE education_topics
  ALTER COLUMN topic TYPE TEXT;

COMMENT ON COLUMN education_topics.topic IS 'Application-layer AES ciphertext (backend/utils/phiCrypto.js), stored in a TEXT column (widened from VARCHAR(255) in this migration).';
COMMENT ON COLUMN values.value_text IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN values.user_note IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN concerns.concern IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN concerns.context IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN concerns.user_note IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN education_topics.user_note IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
