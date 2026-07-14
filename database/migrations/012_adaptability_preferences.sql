-- Two optional, low-effort adaptability preferences (see the evaluation
-- against the study's Adaptability endpoint -- cultural respect and
-- communication style were previously entirely prompt-inferential, with
-- no way for a person to actually tell Sofia anything).
--
-- cultural_context: freeform, AES ciphertext (backend/utils/phiCrypto.js
-- encryptField) of a short note the person can optionally add on their
-- About Me page, e.g. "I'd love it if Sofia understood X about my
-- background." Matches the existing best_life_elements/concerns pattern
-- on this same table.
ALTER TABLE about_me_profiles ADD COLUMN cultural_context TEXT;

-- preferred_language: freeform, plain text (not PHI on its own -- matches
-- how users.name/age are already stored unencrypted). Full translation is
-- out of scope for now; this captures intent so vocabulary/pacing can
-- adapt today and so real localization work can be prioritized later.
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(100);
