-- Durable, per-user record of which Lancet Commission risk-factor domains
-- (backend/utils/riskDomains.js) Sofia has already substantively covered in
-- conversation -- see utils/systemPrompt.js's "Tiered education delivery"
-- section. Without this, education coverage was entirely conversation-
-- driven with no memory across sessions of what's already been discussed.
--
-- AES ciphertext (backend/utils/phiCrypto.js encryptJSON) of a JSON array
-- of domain keys, matching the existing best_life_elements/concerns
-- pattern on this same table (see migrations/003_phi_encryption.sql).
ALTER TABLE about_me_profiles ADD COLUMN risk_domains_covered TEXT;
