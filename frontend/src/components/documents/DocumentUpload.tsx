import { ChangeEvent, useRef, useState } from 'react';
import { ClinicalReportCandidates, DocumentExtractionCandidates, DocumentUploadResult } from '../../api/client';
import { useDocumentExtraction } from '../../hooks/useDocumentExtraction';
import { useClinicalReportExtraction } from '../../hooks/useClinicalReportExtraction';
import { DocumentReviewModal } from './DocumentReviewModal';
import { ClinicalReportReviewModal } from './ClinicalReportReviewModal';

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<DocumentUploadResult | undefined>;
  isUploading: boolean;
  uploadError: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // matches the backend's multer limit

function hasAnyCandidates(candidates: DocumentExtractionCandidates): boolean {
  return Boolean(
    candidates.best_life_elements?.length ||
      candidates.concerns?.length ||
      candidates.confidence_level ||
      candidates.values?.length ||
      candidates.concerns_detailed?.length ||
      candidates.education_topics?.length ||
      candidates.goals?.length
  );
}

function hasAnyClinicalCandidates(candidates: ClinicalReportCandidates): boolean {
  return Boolean(
    candidates.diagnosis ||
      candidates.current_symptoms?.cognitive?.length ||
      candidates.current_symptoms?.physical?.length ||
      candidates.current_symptoms?.sleep?.length ||
      candidates.current_symptoms?.mood_or_behavioral?.length ||
      candidates.assessment_results?.length ||
      candidates.imaging_or_labs?.length ||
      candidates.clinical_observations?.length ||
      candidates.safety_risk_notes ||
      candidates.care_plan?.length ||
      candidates.next_review?.date ||
      candidates.next_review?.details ||
      candidates.support_resources?.length
  );
}

export function DocumentUpload({ onUpload, isUploading, uploadError }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastResult, setLastResult] = useState<DocumentUploadResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<{ documentId: string; candidates: DocumentExtractionCandidates } | null>(null);
  const [clinicalReviewState, setClinicalReviewState] = useState<{ documentId: string; candidates: ClinicalReportCandidates } | null>(null);
  // Holds wellness candidates found alongside a clinical report, so the
  // wellness review only opens once the (higher-priority) clinical review
  // is closed -- showing two native <dialog> modals at once is confusing,
  // and a clinician-authored document's diagnostic content takes precedence.
  const [queuedWellnessReview, setQueuedWellnessReview] = useState<{ documentId: string; candidates: DocumentExtractionCandidates } | null>(
    null
  );
  const { extract, isExtracting } = useDocumentExtraction();
  const { extract: extractClinical, isExtracting: isExtractingClinical } = useClinicalReportExtraction();

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    setLastResult(null);

    if (file.size > MAX_FILE_SIZE) {
      setLocalError('That file is larger than 10MB -- please choose a smaller one.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const result = await onUpload(file);
    if (result) setLastResult(result);
    if (inputRef.current) inputRef.current.value = '';

    // Offer to review what Sofia found in the document, if the LLM found
    // anything to propose -- see backend routes/documents.js
    // POST /:documentId/extract and POST /:documentId/extract-clinical-report.
    // Both run on every upload (rather than asking the person to say up
    // front what kind of document it is) since each is cheap, bounded, and
    // silently finds nothing on documents outside its domain -- never opens
    // an empty review screen. If both find something, the clinical review
    // (higher-stakes, clinician-authored content) is shown first; the
    // wellness review opens once that one closes.
    if (result?.document?.id) {
      const documentId = result.document.id;

      let wellnessCandidates: DocumentExtractionCandidates | null = null;
      try {
        const wellness = await extract(documentId);
        if (hasAnyCandidates(wellness.candidates)) wellnessCandidates = wellness.candidates;
      } catch {
        // Extraction is a bonus on top of a successful upload -- if it
        // fails (e.g. LLM not configured), the upload itself already
        // succeeded and the document is still available on the page.
      }

      let clinicalCandidates: ClinicalReportCandidates | null = null;
      try {
        const clinical = await extractClinical(documentId);
        if (hasAnyClinicalCandidates(clinical.candidates)) clinicalCandidates = clinical.candidates;
      } catch {
        // Same bonus-on-top reasoning as above.
      }

      if (clinicalCandidates) {
        setClinicalReviewState({ documentId, candidates: clinicalCandidates });
        if (wellnessCandidates) setQueuedWellnessReview({ documentId, candidates: wellnessCandidates });
      } else if (wellnessCandidates) {
        setReviewState({ documentId, candidates: wellnessCandidates });
      }
    }
  }

  return (
    <div className="document-upload">
      <label htmlFor="document-upload-input" className="document-upload-label">
        Upload a document (PDF or text) to share with Sofia
      </label>
      <input
        id="document-upload-input"
        ref={inputRef}
        type="file"
        accept=".pdf,text/plain,application/pdf"
        onChange={handleChange}
        disabled={isUploading}
      />
      {isUploading && <p className="chat-status">Uploading and reading your document...</p>}
      {(isExtracting || isExtractingClinical) && <p className="chat-status">Looking for anything to add to your profile...</p>}
      {(localError || uploadError) && (
        <p className="form-error" role="alert">
          {localError || uploadError}
        </p>
      )}
      {lastResult && (
        <p className="save-confirmation" role="status">
          {lastResult.message}
        </p>
      )}
      {reviewState && (
        <DocumentReviewModal
          documentId={reviewState.documentId}
          candidates={reviewState.candidates}
          onClose={() => setReviewState(null)}
        />
      )}
      {clinicalReviewState && (
        <ClinicalReportReviewModal
          documentId={clinicalReviewState.documentId}
          candidates={clinicalReviewState.candidates}
          onClose={() => {
            setClinicalReviewState(null);
            // See the comment above where these are queued -- open the
            // wellness review only after the clinical one has been dealt
            // with, rather than stacking two native <dialog> modals.
            if (queuedWellnessReview) {
              setReviewState(queuedWellnessReview);
              setQueuedWellnessReview(null);
            }
          }}
        />
      )}
    </div>
  );
}
