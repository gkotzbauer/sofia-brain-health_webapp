import { ChangeEvent, useRef, useState } from 'react';
import { DocumentExtractionCandidates, DocumentUploadResult } from '../../api/client';
import { useDocumentExtraction } from '../../hooks/useDocumentExtraction';
import { DocumentReviewModal } from './DocumentReviewModal';

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

export function DocumentUpload({ onUpload, isUploading, uploadError }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastResult, setLastResult] = useState<DocumentUploadResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<{ documentId: string; candidates: DocumentExtractionCandidates } | null>(null);
  const { extract, isExtracting } = useDocumentExtraction();

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
    // POST /:documentId/extract. Never opens an empty review screen.
    if (result?.document?.id) {
      try {
        const { documentId, candidates } = await extract(result.document.id);
        if (hasAnyCandidates(candidates)) {
          setReviewState({ documentId, candidates });
        }
      } catch {
        // Extraction is a bonus on top of a successful upload -- if it
        // fails (e.g. LLM not configured), the upload itself already
        // succeeded and the document is still available on the page.
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
      {isExtracting && <p className="chat-status">Looking for anything to add to your profile...</p>}
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
    </div>
  );
}
