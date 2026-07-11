import { FormEvent, useState } from 'react';
import { useConversation } from '../../hooks/useConversation';
import { useFeedback } from '../../hooks/useFeedback';

// Rendered on its own page (pages/FeedbackPage.tsx) -- a lightweight,
// always-available way to tell us how the conversation is going, separate
// from anything Sofia herself tracks. Posts to the existing backend
// feedback endpoint (previously unused by the frontend).
export function FeedbackPanel() {
  const { sessionId } = useConversation();
  const { submitFeedback, isSubmitting, submitError } = useFeedback();
  const [feedbackText, setFeedbackText] = useState('');
  const [sentLog, setSentLog] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = feedbackText.trim();
    if (!trimmed) return;
    await submitFeedback({ sessionId: sessionId || undefined, feedbackText: trimmed });
    setSentLog((log) => [trimmed, ...log]);
    setFeedbackText('');
  }

  return (
    <div className="feedback-panel">
      <p className="section-intro">How was this conversation? Any suggestions help us improve.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="feedback-text" className="visually-hidden">
          Your feedback
        </label>
        <textarea
          id="feedback-text"
          rows={3}
          placeholder="How was this conversation? Any suggestions?"
          value={feedbackText}
          onChange={(event) => setFeedbackText(event.target.value)}
          disabled={isSubmitting}
        />
        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
        <button type="submit" className="button-primary" disabled={isSubmitting || !feedbackText.trim()}>
          {isSubmitting ? 'Sending...' : 'Submit feedback'}
        </button>
      </form>

      {sentLog.length > 0 && (
        <div className="feedback-log">
          {sentLog.map((text, index) => (
            <p key={index} className="feedback-confirmation" role="status">
              Thank you -- shared: "{text}"
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
