import { useDocuments } from '../hooks/useDocuments';
import { DocumentUpload } from '../components/documents/DocumentUpload';
import { DocumentList } from '../components/documents/DocumentList';

export function DocumentsPage() {
  const { documents, isLoading, upload, isUploading, uploadError } = useDocuments();

  return (
    <div className="documents-page">
      <h1>Your documents</h1>
      <p className="section-intro">
        Share lab results, a clinician's summary, or notes -- Sofia can refer to them in your conversation.
      </p>
      <DocumentUpload onUpload={upload} isUploading={isUploading} uploadError={uploadError} />
      {isLoading ? <p>Loading your documents...</p> : <DocumentList documents={documents} />}
    </div>
  );
}
