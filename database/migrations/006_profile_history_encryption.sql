-- Closes a gap left by 003_phi_encryption.sql: profile_variable_history
-- logs changes to (and, for document-upload notifications, messages about)
-- PHI-bearing fields, but was never itself brought under application-layer
-- encryption (backend/utils/phiCrypto.js). variable_value/previous_value
-- are already TEXT (no type change needed, only an app-layer change to
-- encrypt/decrypt through them -- see routes/users.js, routes/documents.js).
-- source_details is JSONB and must become TEXT, since ciphertext is an
-- opaque string, not valid JSON.

ALTER TABLE profile_variable_history
  ALTER COLUMN source_details TYPE TEXT USING source_details::text;

COMMENT ON COLUMN profile_variable_history.variable_value IS 'Application-layer AES ciphertext (backend/utils/phiCrypto.js), stored in the existing TEXT column.';
COMMENT ON COLUMN profile_variable_history.previous_value IS 'Application-layer AES ciphertext, stored in the existing TEXT column.';
COMMENT ON COLUMN profile_variable_history.source_details IS 'AES ciphertext of a JSON object. Previously plaintext JSONB.';
