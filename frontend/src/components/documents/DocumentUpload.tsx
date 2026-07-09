import { ChangeEvent, useRef, useState } from 'react';
import { DocumentUploadResult } from '../../api/client';

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<DocumentUploadResult | undefined>;
  isUploading: boolean;
  uploadError: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // matches the backend's multer limit

export function DocumentUpload({ onUpload, isUploading, uploadError }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastResult, setLastResult] = useState<DocumentUploadResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

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
    </div>
  );
}
