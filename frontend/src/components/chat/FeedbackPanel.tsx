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
  const [challengesText, setChallengesText] = useState('');
  const [improvementsText, setImprovementsText] = useState('');
  const [sentCount, setSentCount] = useState(0);

  // Any one of the three optional prompts is enough to submit -- a direct
  // question ("did you run into any challenges?") surfaces more than a
  // single open textarea on its own, so these are offered alongside it
  // rather than requiring all three.
  const hasContent = Boolean(feedbackText.trim() || challengesText.trim() || improvementsText.trim());

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasContent) return;
    await submitFeedback({
      sessionId: sessionId || undefined,
      feedbackText: feedbackText.trim(),
      challengesText: challengesText.trim() || undefined,
      improvementsText: improvementsText.trim() || undefined
    });
    setSentCount((count) => count + 1);
    setFeedbackText('');
    setChallengesText('');
    setImprovementsText('');
  }

  return (
    <div className="feedback-panel">
      <p className="section-intro">How was this conversation? Any of the below helps us improve -- answer whichever feels relevant.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="feedback-text">General feedback</label>
        <textarea
          id="feedback-text"
          rows={3}
          placeholder="How was this conversation? Any suggestions?"
          value={feedbackText}
          onChange={(event) => setFeedbackText(event.target.value)}
          disabled={isSubmitting}
        />

        <label htmlFor="feedback-challenges">Did you run into any challenges using Sofia?</label>
        <textarea
          id="feedback-challenges"
          rows={2}
          placeholder="Optional -- anything that got in your way?"
          value={challengesText}
          onChange={(event) => setChallengesText(event.target.value)}
          disabled={isSubmitting}
        />

        <label htmlFor="feedback-improvements">What would help you use Sofia more regularly?</label>
        <textarea
          id="feedback-improvements"
          rows={2}
          placeholder="Optional -- what would make this easier to stick with?"
          value={improvementsText}
          onChange={(event) => setImprovementsText(event.target.value)}
          disabled={isSubmitting}
        />

        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
        <button type="submit" className="button-primary" disabled={isSubmitting || !hasContent}>
          {isSubmitting ? 'Sending...' : 'Submit feedback'}
        </button>
      </form>

      {sentCount > 0 && (
        <p className="feedback-confirmation" role="status">
          Thank you -- your feedback was shared.
        </p>
      )}
    </div>
  );
}
