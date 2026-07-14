-- Two optional, structured prompts alongside the existing free-text
-- feedback -- see the Adaptability evaluation: a single blank textarea is
-- a known low-yield capture pattern next to a direct, specific question.
-- Both nullable (a submission can answer either, both, or neither, same as
-- the existing open feedback_text) and AES ciphertext
-- (backend/utils/phiCrypto.js encryptField), matching feedback_text's
-- existing encryption.
ALTER TABLE feedback ADD COLUMN challenges_text TEXT;
ALTER TABLE feedback ADD COLUMN improvements_text TEXT;
