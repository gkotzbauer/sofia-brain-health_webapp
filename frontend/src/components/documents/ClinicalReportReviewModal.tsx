import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import {
  ClinicalReportAssessmentResult,
  ClinicalReportCandidates,
  ClinicalReportCarePlanItem,
  ClinicalReportDiagnosis,
  ClinicalReportImagingOrLab,
  ClinicalReportSafetyRiskNotes,
  ClinicalReportSupportResource,
  ClinicalReportTextItem
} from '../../api/client';
import { useClinicalReportExtraction } from '../../hooks/useClinicalReportExtraction';
import { DocumentReviewItem } from './DocumentReviewItem';

interface EditableTextItem {
  value: string;
  accepted: boolean;
  sourceExcerpt: string;
}

function toTextItems(list: ClinicalReportTextItem[] | undefined): EditableTextItem[] {
  return (list || []).map((item) => ({ value: item.text, accepted: false, sourceExcerpt: item.source_excerpt }));
}

function updateAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

interface ClinicalReportReviewModalProps {
  documentId: string;
  candidates: ClinicalReportCandidates;
  onClose: () => void;
}

// Clinical counterpart to DocumentReviewModal -- same "nothing is saved
// unless you check it" contract, but sectioned around this schema's nested
// shape (diagnosis, symptom categories, test results, care plan) instead
// of a flat list of strings. The diagnosis section is called out
// separately and labeled "as stated by your clinician" -- see
// utils/systemPrompt.js's "Clinical boundaries" hard rule this exists to
// support: Sofia only ever repeats what's confirmed here, never her own
// read of a symptom or test score.
export function ClinicalReportReviewModal({ documentId, candidates, onClose }: ClinicalReportReviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { applyReport, isApplying, applyError } = useClinicalReportExtraction();

  const [diagnosis, setDiagnosis] = useState<(ClinicalReportDiagnosis & { accepted: boolean }) | null>(() =>
    candidates.diagnosis ? { ...candidates.diagnosis, accepted: false } : null
  );

  const [cognitive, setCognitive] = useState(() => toTextItems(candidates.current_symptoms?.cognitive));
  const [physical, setPhysical] = useState(() => toTextItems(candidates.current_symptoms?.physical));
  const [sleep, setSleep] = useState(() => toTextItems(candidates.current_symptoms?.sleep));
  const [moodOrBehavioral, setMoodOrBehavioral] = useState(() => toTextItems(candidates.current_symptoms?.mood_or_behavioral));
  const [observations, setObservations] = useState(() => toTextItems(candidates.clinical_observations));

  const [assessmentResults, setAssessmentResults] = useState<(ClinicalReportAssessmentResult & { accepted: boolean })[]>(
    () => (candidates.assessment_results || []).map((item) => ({ ...item, accepted: false }))
  );
  const [imagingOrLabs, setImagingOrLabs] = useState<(ClinicalReportImagingOrLab & { accepted: boolean })[]>(
    () => (candidates.imaging_or_labs || []).map((item) => ({ ...item, accepted: false }))
  );
  const [carePlan, setCarePlan] = useState<(ClinicalReportCarePlanItem & { accepted: boolean })[]>(
    () => (candidates.care_plan || []).map((item) => ({ ...item, accepted: false }))
  );
  const [supportResources, setSupportResources] = useState<(ClinicalReportSupportResource & { accepted: boolean })[]>(
    () => (candidates.support_resources || []).map((item) => ({ ...item, accepted: false }))
  );
  const [safetyRiskNotes, setSafetyRiskNotes] = useState<(ClinicalReportSafetyRiskNotes & { accepted: boolean }) | null>(() =>
    candidates.safety_risk_notes ? { ...candidates.safety_risk_notes, accepted: false } : null
  );
  const [includeNextReview, setIncludeNextReview] = useState(Boolean(candidates.next_review?.date || candidates.next_review?.details));

  const symptomGroups: Array<[string, EditableTextItem[], Dispatch<SetStateAction<EditableTextItem[]>>]> = [
    ['Cognitive', cognitive, setCognitive],
    ['Physical', physical, setPhysical],
    ['Sleep', sleep, setSleep],
    ['Mood / behavioral', moodOrBehavioral, setMoodOrBehavioral]
  ];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    // See DocumentReviewModal's identical comment -- deliberately no
    // dialog.close() here to avoid a StrictMode double-invoke firing a
    // spurious close-on-mount.
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) dialogRef.current?.close();
  }

  const totalAccepted =
    (diagnosis?.accepted ? 1 : 0) +
    cognitive.filter((i) => i.accepted).length +
    physical.filter((i) => i.accepted).length +
    sleep.filter((i) => i.accepted).length +
    moodOrBehavioral.filter((i) => i.accepted).length +
    observations.filter((i) => i.accepted).length +
    assessmentResults.filter((i) => i.accepted).length +
    imagingOrLabs.filter((i) => i.accepted).length +
    carePlan.filter((i) => i.accepted).length +
    supportResources.filter((i) => i.accepted).length +
    (safetyRiskNotes?.accepted ? 1 : 0) +
    (includeNextReview ? 1 : 0);

  async function handleSave() {
    const report: ClinicalReportCandidates = {
      document_type: candidates.document_type,
      assessment_info: candidates.assessment_info
    };

    if (diagnosis?.accepted && diagnosis.stated_diagnosis.trim()) {
      report.diagnosis = {
        stated_diagnosis: diagnosis.stated_diagnosis.trim(),
        icd_or_read_code: diagnosis.icd_or_read_code,
        status: diagnosis.status,
        source_excerpt: diagnosis.source_excerpt
      };
    }

    const acceptedCognitive = cognitive.filter((i) => i.accepted && i.value.trim());
    const acceptedPhysical = physical.filter((i) => i.accepted && i.value.trim());
    const acceptedSleep = sleep.filter((i) => i.accepted && i.value.trim());
    const acceptedMood = moodOrBehavioral.filter((i) => i.accepted && i.value.trim());
    if (acceptedCognitive.length || acceptedPhysical.length || acceptedSleep.length || acceptedMood.length) {
      report.current_symptoms = {
        cognitive: acceptedCognitive.map((i) => ({ text: i.value.trim(), source_excerpt: i.sourceExcerpt })),
        physical: acceptedPhysical.map((i) => ({ text: i.value.trim(), source_excerpt: i.sourceExcerpt })),
        sleep: acceptedSleep.map((i) => ({ text: i.value.trim(), source_excerpt: i.sourceExcerpt })),
        mood_or_behavioral: acceptedMood.map((i) => ({ text: i.value.trim(), source_excerpt: i.sourceExcerpt }))
      };
    }

    const acceptedObservations = observations.filter((i) => i.accepted && i.value.trim());
    if (acceptedObservations.length) {
      report.clinical_observations = acceptedObservations.map((i) => ({ text: i.value.trim(), source_excerpt: i.sourceExcerpt }));
    }

    const acceptedResults = assessmentResults.filter((i) => i.accepted && i.test_name.trim());
    if (acceptedResults.length) report.assessment_results = acceptedResults.map(({ accepted: _accepted, ...rest }) => rest);

    const acceptedImaging = imagingOrLabs.filter((i) => i.accepted && i.findings.trim());
    if (acceptedImaging.length) report.imaging_or_labs = acceptedImaging.map(({ accepted: _accepted, ...rest }) => rest);

    const acceptedCarePlan = carePlan.filter((i) => i.accepted && i.item.trim());
    if (acceptedCarePlan.length) report.care_plan = acceptedCarePlan.map(({ accepted: _accepted, ...rest }) => rest);

    const acceptedResources = supportResources.filter((i) => i.accepted && i.name.trim());
    if (acceptedResources.length) report.support_resources = acceptedResources.map(({ accepted: _accepted, ...rest }) => rest);

    if (safetyRiskNotes?.accepted) {
      const { accepted: _accepted, ...rest } = safetyRiskNotes;
      report.safety_risk_notes = rest;
    }

    if (includeNextReview) report.next_review = candidates.next_review;

    await applyReport({ documentId, report });
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="document-review-dialog"
      aria-labelledby="clinical-report-review-heading"
      onClick={handleBackdropClick}
    >
      <div className="document-review-content">
        <h2 id="clinical-report-review-heading">What Sofia found in your clinician's report</h2>
        <p className="section-intro">
          Review each item below -- nothing is saved unless you check it, and you can edit the wording first. This is
          exactly what your document says; Sofia only ever repeats what your clinician documented, never her own
          interpretation of a symptom or score.
        </p>

        {totalAccepted === 0 &&
          !diagnosis &&
          cognitive.length === 0 &&
          physical.length === 0 &&
          sleep.length === 0 &&
          moodOrBehavioral.length === 0 &&
          observations.length === 0 &&
          assessmentResults.length === 0 &&
          imagingOrLabs.length === 0 &&
          carePlan.length === 0 &&
          supportResources.length === 0 &&
          !safetyRiskNotes &&
          !candidates.next_review && <p className="chat-status">Nothing stood out to add from this document.</p>}

        {diagnosis && (
          <section aria-labelledby="review-diagnosis-heading" className="clinical-report-callout">
            <h3 id="review-diagnosis-heading">As stated by your clinician</h3>
            <DocumentReviewItem
              id="clinical-diagnosis"
              label="Diagnosis"
              value={diagnosis.stated_diagnosis}
              sourceExcerpt={diagnosis.source_excerpt}
              accepted={diagnosis.accepted}
              onValueChange={(value) => setDiagnosis((current) => (current ? { ...current, stated_diagnosis: value } : current))}
              onAcceptedChange={(accepted) => setDiagnosis((current) => (current ? { ...current, accepted } : current))}
            >
              {diagnosis.status && <p className="review-item-hint">Status: {diagnosis.status}</p>}
            </DocumentReviewItem>
          </section>
        )}

        {(cognitive.length > 0 || physical.length > 0 || sleep.length > 0 || moodOrBehavioral.length > 0) && (
          <section aria-labelledby="review-symptoms-heading">
            <h3 id="review-symptoms-heading">Symptoms noted in the document</h3>
            {symptomGroups.map(([groupLabel, items, setItems]) =>
              items.map((item, index) => (
                <DocumentReviewItem
                  key={`${groupLabel}-${index}`}
                  id={`symptom-${groupLabel}-${index}`}
                  label={`${groupLabel} symptom`}
                  value={item.value}
                  sourceExcerpt={item.sourceExcerpt}
                  accepted={item.accepted}
                  onValueChange={(value) => setItems((current) => updateAt(current, index, { value }))}
                  onAcceptedChange={(accepted) => setItems((current) => updateAt(current, index, { accepted }))}
                />
              ))
            )}
          </section>
        )}

        {assessmentResults.length > 0 && (
          <section aria-labelledby="review-results-heading">
            <h3 id="review-results-heading">Assessment / test results</h3>
            {assessmentResults.map((item, index) => (
              <DocumentReviewItem
                key={`result-${index}`}
                id={`result-${index}`}
                label="Test name"
                value={item.test_name}
                sourceExcerpt={item.source_excerpt}
                accepted={item.accepted}
                onValueChange={(value) => setAssessmentResults((current) => updateAt(current, index, { test_name: value }))}
                onAcceptedChange={(accepted) => setAssessmentResults((current) => updateAt(current, index, { accepted }))}
              >
                <p className="review-item-hint">
                  Score: {item.score}
                  {item.interpretation ? ` -- ${item.interpretation}` : ''}
                </p>
              </DocumentReviewItem>
            ))}
          </section>
        )}

        {imagingOrLabs.length > 0 && (
          <section aria-labelledby="review-imaging-heading">
            <h3 id="review-imaging-heading">Imaging / labs</h3>
            {imagingOrLabs.map((item, index) => (
              <DocumentReviewItem
                key={`imaging-${index}`}
                id={`imaging-${index}`}
                label={item.type || 'Result'}
                value={item.findings}
                sourceExcerpt={item.source_excerpt}
                accepted={item.accepted}
                onValueChange={(value) => setImagingOrLabs((current) => updateAt(current, index, { findings: value }))}
                onAcceptedChange={(accepted) => setImagingOrLabs((current) => updateAt(current, index, { accepted }))}
              />
            ))}
          </section>
        )}

        {observations.length > 0 && (
          <section aria-labelledby="review-observations-heading">
            <h3 id="review-observations-heading">Clinical observations</h3>
            {observations.map((item, index) => (
              <DocumentReviewItem
                key={`observation-${index}`}
                id={`observation-${index}`}
                label="Observation"
                value={item.value}
                sourceExcerpt={item.sourceExcerpt}
                accepted={item.accepted}
                onValueChange={(value) => setObservations((current) => updateAt(current, index, { value }))}
                onAcceptedChange={(accepted) => setObservations((current) => updateAt(current, index, { accepted }))}
              />
            ))}
          </section>
        )}

        {safetyRiskNotes && (
          <section aria-labelledby="review-safety-heading">
            <h3 id="review-safety-heading">Clinician's safety/risk note</h3>
            <DocumentReviewItem
              id="safety-risk-notes"
              label={safetyRiskNotes.concerns_identified ? 'Concerns identified' : 'No concerns identified'}
              value={safetyRiskNotes.details || ''}
              sourceExcerpt={safetyRiskNotes.source_excerpt}
              accepted={safetyRiskNotes.accepted}
              onValueChange={(value) => setSafetyRiskNotes((current) => (current ? { ...current, details: value } : current))}
              onAcceptedChange={(accepted) => setSafetyRiskNotes((current) => (current ? { ...current, accepted } : current))}
            />
          </section>
        )}

        {carePlan.length > 0 && (
          <section aria-labelledby="review-care-plan-heading">
            <h3 id="review-care-plan-heading">Care plan</h3>
            {carePlan.map((item, index) => (
              <DocumentReviewItem
                key={`care-plan-${index}`}
                id={`care-plan-${index}`}
                label="Care plan item"
                value={item.item}
                sourceExcerpt={item.source_excerpt}
                accepted={item.accepted}
                onValueChange={(value) => setCarePlan((current) => updateAt(current, index, { item: value }))}
                onAcceptedChange={(accepted) => setCarePlan((current) => updateAt(current, index, { accepted }))}
              >
                {item.target_date && <p className="review-item-hint">Target: {item.target_date}</p>}
              </DocumentReviewItem>
            ))}
          </section>
        )}

        {candidates.next_review && (candidates.next_review.date || candidates.next_review.details) && (
          <section aria-labelledby="review-next-review-heading">
            <h3 id="review-next-review-heading">Next review</h3>
            <label className="review-item-toggle">
              <input type="checkbox" checked={includeNextReview} onChange={(event) => setIncludeNextReview(event.target.checked)} />
              <span>
                {[candidates.next_review.date, candidates.next_review.details].filter(Boolean).join(' -- ')}
              </span>
            </label>
          </section>
        )}

        {supportResources.length > 0 && (
          <section aria-labelledby="review-resources-heading">
            <h3 id="review-resources-heading">Support resources</h3>
            {supportResources.map((item, index) => (
              <DocumentReviewItem
                key={`resource-${index}`}
                id={`resource-${index}`}
                label="Resource"
                value={item.name}
                sourceExcerpt={item.source_excerpt}
                accepted={item.accepted}
                onValueChange={(value) => setSupportResources((current) => updateAt(current, index, { name: value }))}
                onAcceptedChange={(accepted) => setSupportResources((current) => updateAt(current, index, { accepted }))}
              >
                {(item.phone || item.website) && (
                  <p className="review-item-hint">{[item.phone, item.website].filter(Boolean).join(' · ')}</p>
                )}
              </DocumentReviewItem>
            ))}
          </section>
        )}

        {applyError && (
          <p className="form-error" role="alert">
            {applyError}
          </p>
        )}

        <div className="document-review-actions">
          <button type="button" className="button-secondary" onClick={() => dialogRef.current?.close()} disabled={isApplying}>
            Skip / decide later
          </button>
          <button type="button" className="button-primary" onClick={handleSave} disabled={isApplying || totalAccepted === 0}>
            {isApplying ? 'Saving...' : 'Save selected'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
