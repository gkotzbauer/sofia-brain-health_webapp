-- Stores a clinician-authored report (e.g. a post-diagnostic letter or
-- care-plan review) once a person has reviewed and accepted the structured
-- data extracted from it -- see backend/utils/llm/clinicalReportExtractionSchema.js
-- for the shape of report_data, and backend/routes/documents.js
-- POST /:documentId/extract-clinical-report / apply-clinical-report for the
-- extract-then-human-review write path (nothing is ever auto-saved here).
--
-- Kept as its own table rather than folded into document_uploads.metadata
-- (where the raw extracted document text already lives) so that: (1) Sofia's
-- per-turn context loader (backend/utils/loadUserContext.js) can cheaply
-- pull "the most recent report on file" with a plain ORDER BY, instead of
-- scanning/parsing arbitrary upload metadata to guess which uploads are
-- clinical reports; and (2) a person can have more than one report over
-- time (e.g. the periodic reviews these clinics describe) as real,
-- independently orderable rows rather than one row being overwritten. This
-- mirrors how every other document-derived data domain in this app
-- (values, concerns, education_topics, goals) already gets its own table
-- fed by a shared extract/apply pattern, rather than one shared JSON blob.
--
-- report_data is AES ciphertext (backend/utils/phiCrypto.js encryptJSON) of
-- the full reviewed report object -- it's clinical PHI, encrypted like every
-- other free-text/JSON PHI column in this app. report_date/assessment_date
-- are left as plain DATE columns (not PHI on their own, needed for
-- ordering/"most recent" lookups), matching how sessions.session_date is
-- already stored unencrypted.
CREATE TABLE clinical_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_upload_id UUID REFERENCES document_uploads(id) ON DELETE SET NULL,
    report_date DATE,
    assessment_date DATE,
    report_data TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clinical_reports_user ON clinical_reports(user_id);
CREATE INDEX idx_clinical_reports_document ON clinical_reports(document_upload_id);
