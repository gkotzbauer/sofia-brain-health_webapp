-- Lets a clinician jump straight from a pending alert to the session it came
-- from (needed for both the existing safety-trigger alerts and the new
-- context-cap alerts introduced alongside this migration).
ALTER TABLE clinical_alerts
  ADD COLUMN session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_clinical_alerts_session ON clinical_alerts(session_id);
