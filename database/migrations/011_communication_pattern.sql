-- Durable cross-session record of a person's adaptive conversation pattern
-- (see backend/utils/communicationPreference.js) -- one of the same fixed
-- enum values already used per-turn in utils/llm/schema.js's
-- adaptive_pattern field, so no encryption needed here (matching how
-- confidence_level, also a fixed small enum, is already stored in the
-- clear on this same table).
ALTER TABLE about_me_profiles ADD COLUMN communication_pattern VARCHAR(50);
