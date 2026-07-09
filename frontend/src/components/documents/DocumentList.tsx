import { DocumentUploadRecord } from '../../api/client';

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({ documents }: { documents: DocumentUploadRecord[] }) {
  if (documents.length === 0) {
    return <p className="empty-state">No documents uploaded yet.</p>;
  }

  return (
    <ul className="document-list">
      {documents.map((doc) => (
        <li key={doc.id} className="document-list-item">
          <span className="document-name">{doc.filename}</span>
          <span className="document-meta">
            {formatFileSize(doc.file_size)} · {new Date(doc.upload_timestamp).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
