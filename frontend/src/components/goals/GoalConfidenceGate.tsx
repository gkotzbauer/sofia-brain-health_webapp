import { FormEvent, useState } from 'react';

interface GoalConfidenceGateProps {
  onCreateGoal: (data: { goal: string; confidence: number }) => Promise<{ id: string } | undefined>;
  onSaveNote: (goalId: string, note: string) => Promise<unknown>;
}

// Implements sofia-conversation-methodology.md section 4C: below a
// confidence of 7, we don't just save the goal and move on -- we ask what
// would raise it, and record that as a support note. At 7+, we ask for a
// first step and record that instead. Either way the goal is saved (so
// nothing the person shares is lost), just with different framing.
export function GoalConfidenceGate({ onCreateGoal, onSaveNote }: GoalConfidenceGateProps) {
  const [step, setStep] = useState<'goal' | 'confidence' | 'followUp' | 'done'>('goal');
  const [goalText, setGoalText] = useState('');
  const [confidence, setConfidence] = useState(7);
  const [followUp, setFollowUp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleGoalSubmit(event: FormEvent) {
    event.preventDefault();
    if (!goalText.trim()) return;
    setStep('confidence');
  }

  function handleConfidenceSubmit(event: FormEvent) {
    event.preventDefault();
    setStep('followUp');
  }

  async function handleFollowUpSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await onCreateGoal({ goal: goalText.trim(), confidence });
      if (created?.id && followUp.trim()) {
        await onSaveNote(created.id, followUp.trim());
      }
      setStep('done');
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setGoalText('');
    setConfidence(7);
    setFollowUp('');
    setStep('goal');
  }

  if (step === 'done') {
    return (
      <div className="confidence-gate confidence-gate-done">
        <p>Your quest has been added. Every step forward counts.</p>
        <button type="button" onClick={reset}>
          Set another goal
        </button>
      </div>
    );
  }

  return (
    <div className="confidence-gate">
      {step === 'goal' && (
        <form onSubmit={handleGoalSubmit}>
          <label htmlFor="new-goal-text">What would you like to work toward?</label>
          <textarea
            id="new-goal-text"
            rows={2}
            value={goalText}
            onChange={(event) => setGoalText(event.target.value)}
            placeholder="e.g. Remember my grandchildren's names at our next visit"
          />
          <button type="submit" disabled={!goalText.trim()}>
            Continue
          </button>
        </form>
      )}

      {step === 'confidence' && (
        <form onSubmit={handleConfidenceSubmit}>
          <label htmlFor="goal-confidence">
            On a scale of 1 to 10, how confident do you feel about achieving this?
          </label>
          <div className="confidence-slider-row">
            <input
              id="goal-confidence"
              type="range"
              min={1}
              max={10}
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
            />
            <output htmlFor="goal-confidence" className="confidence-value">
              {confidence}
            </output>
          </div>
          <button type="submit">Continue</button>
        </form>
      )}

      {step === 'followUp' && (
        <form onSubmit={handleFollowUpSubmit}>
          {confidence < 7 ? (
            <label htmlFor="goal-followup">What would help you feel more confident about this?</label>
          ) : (
            <label htmlFor="goal-followup">Wonderful. What's your first step?</label>
          )}
          <textarea
            id="goal-followup"
            rows={2}
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save this quest'}
          </button>
        </form>
      )}
    </div>
  );
}
