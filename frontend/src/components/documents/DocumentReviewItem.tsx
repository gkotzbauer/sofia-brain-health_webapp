import { ReactNode } from 'react';

interface DocumentReviewItemProps {
  id: string;
  label: string;
  sourceExcerpt: string;
  value: string;
  onValueChange: (value: string) => void;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  disableAccept?: boolean;
  disabledReason?: string;
  children?: ReactNode;
}

// A single candidate row in DocumentReviewModal -- shows what Sofia
// proposed, lets the person edit it, and defaults to unchecked so nothing
// is ever accepted by default (see backend routes/documents.js
// POST /:documentId/apply-extraction, which only ever writes what's
// explicitly submitted here).
export function DocumentReviewItem({
  id,
  label,
  sourceExcerpt,
  value,
  onValueChange,
  accepted,
  onAcceptedChange,
  disableAccept,
  disabledReason,
  children
}: DocumentReviewItemProps) {
  const textFieldId = `${id}-text`;
  return (
    <div className="review-item left-accent-card" style={{ '--accent-color': 'var(--color-chapter)' } as React.CSSProperties}>
      <label className="review-item-toggle">
        <input
          type="checkbox"
          checked={accepted}
          disabled={disableAccept}
          onChange={(event) => onAcceptedChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      <label className="review-item-field" htmlFor={textFieldId}>
        <span className="visually-hidden">{label} text</span>
        <input id={textFieldId} type="text" value={value} onChange={(event) => onValueChange(event.target.value)} />
      </label>
      {children}
      {disableAccept && disabledReason && <p className="review-item-hint">{disabledReason}</p>}
      {sourceExcerpt && <p className="review-item-excerpt">From your document: "{sourceExcerpt}"</p>}
    </div>
  );
}
