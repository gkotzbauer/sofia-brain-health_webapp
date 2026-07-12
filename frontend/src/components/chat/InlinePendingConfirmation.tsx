import { useState } from 'react';
import { PendingConfirmation } from '../../api/client';
import { useGoals } from '../../hooks/useGoals';
import { useChapters } from '../../hooks/useChapters';
import { useValues } from '../../hooks/useValues';
import { useConcerns } from '../../hooks/useConcerns';
import { useEducationTopics } from '../../hooks/useEducationTopics';

interface InlinePendingConfirmationProps {
  confirmation: PendingConfirmation;
  onResolved: (summaryMessage: string) => void;
  disabled?: boolean;
}

const LABELS: Record<PendingConfirmation['type'], string> = {
  goal: 'Sofia noticed a possible goal',
  chapter: 'Sofia noticed a story chapter',
  value: 'Sofia noticed a value',
  concern: 'Sofia noticed a concern',
  education_topic: 'Sofia noticed something you might want to learn about'
};

// The piece that was missing this whole time: state.pendingConfirmation
// (set whenever the model proposes a goal/chapter/value/concern/education
// topic -- see backend/utils/turnState.js) was never read by any component
// anywhere in the frontend, so proposals -- even goals and chapters, which
// have existed since early in this project -- were never actually
// actionable. This renders that proposal as an editable card and writes it
// through the SAME existing create endpoints the manual profile forms use.
export function InlinePendingConfirmation({ confirmation, onResolved, disabled }: InlinePendingConfirmationProps) {
  const { createGoal, isCreating: isCreatingGoal } = useGoals();
  const { createChapter, isCreating: isCreatingChapter } = useChapters();
  const { createValue, isCreating: isCreatingValue } = useValues();
  const { createConcern, isCreating: isCreatingConcern } = useConcerns();
  const { createTopic, isCreating: isCreatingTopic } = useEducationTopics();

  const payload = confirmation.payload as Record<string, unknown>;
  const [text, setText] = useState(String((confirmation.type === 'chapter' ? payload.title : payload.text) ?? ''));
  const [secondary, setSecondary] = useState(
    confirmation.type === 'goal'
      ? String(payload.confidence ?? '7')
      : confirmation.type === 'value'
        ? String(payload.importance ?? 'high')
        : confirmation.type === 'concern'
          ? String(payload.severity ?? 'moderate')
          : String(payload.engagement ?? 'moderate')
  );
  const [moment, setMoment] = useState(String(payload.moment ?? ''));
  const [choices, setChoices] = useState(String(payload.choices ?? ''));
  const [learning, setLearning] = useState(String(payload.learning ?? ''));
  const [context, setContext] = useState(String(payload.context ?? ''));

  const isSaving = isCreatingGoal || isCreatingChapter || isCreatingValue || isCreatingConcern || isCreatingTopic;

  async function handleSave() {
    switch (confirmation.type) {
      case 'goal':
        await createGoal({ goal: text, confidence: Number(secondary) || 7 });
        onResolved(`Yes, let's save that goal: "${text}".`);
        return;
      case 'chapter':
        await createChapter({ title: text, moment, moodArc: (payload.moodArc as string[]) || [], choices, learning });
        onResolved(`Yes, let's save that chapter: "${text}".`);
        return;
      case 'value':
        await createValue({ valueText: text, importance: secondary });
        onResolved(`Yes, save that as one of my values: "${text}".`);
        return;
      case 'concern':
        await createConcern({ concern: text, severity: secondary, context });
        onResolved(`Yes, save that concern: "${text}".`);
        return;
      case 'education_topic':
        await createTopic({ topic: text, engagement: secondary });
        onResolved(`Yes, I'd like to learn more about that: "${text}".`);
    }
  }

  // Deliberately sends a real message rather than only hiding the card
  // locally -- a silent local-only dismiss means the model never learns
  // the person declined, so nothing stops it from proposing the identical
  // thing again next turn (this was half of the repeated-goal bug: the
  // other half is utils/systemPrompt.js now telling the model what's
  // already pending, plus utils/turnState.js's hard suppression backstop).
  function handleDismiss() {
    onResolved('Not right now, thanks.');
  }

  return (
    <div className="pending-confirmation left-accent-card" style={{ '--accent-color': 'var(--color-primary)' } as React.CSSProperties}>
      <p className="pending-confirmation-label">{LABELS[confirmation.type]}</p>
      <label className="review-item-field">
        <span className="visually-hidden">{confirmation.type === 'chapter' ? 'Chapter title' : 'Text'}</span>
        <input type="text" value={text} onChange={(event) => setText(event.target.value)} disabled={disabled || isSaving} />
      </label>

      {confirmation.type === 'goal' && (
        <label className="review-item-field">
          How confident (1-10)?
          <select value={secondary} onChange={(event) => setSecondary(event.target.value)} disabled={disabled || isSaving}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      {confirmation.type === 'value' && (
        <label className="review-item-field">
          Importance
          <select value={secondary} onChange={(event) => setSecondary(event.target.value)} disabled={disabled || isSaving}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      )}

      {confirmation.type === 'concern' && (
        <>
          <label className="review-item-field">
            Severity
            <select value={secondary} onChange={(event) => setSecondary(event.target.value)} disabled={disabled || isSaving}>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </label>
          <label className="review-item-field">
            Context (optional)
            <input type="text" value={context} onChange={(event) => setContext(event.target.value)} disabled={disabled || isSaving} />
          </label>
        </>
      )}

      {confirmation.type === 'education_topic' && (
        <label className="review-item-field">
          Interest
          <select value={secondary} onChange={(event) => setSecondary(event.target.value)} disabled={disabled || isSaving}>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </label>
      )}

      {confirmation.type === 'chapter' && (
        <>
          <label className="review-item-field">
            The moment
            <input type="text" value={moment} onChange={(event) => setMoment(event.target.value)} disabled={disabled || isSaving} />
          </label>
          <label className="review-item-field">
            Choices made (optional)
            <input type="text" value={choices} onChange={(event) => setChoices(event.target.value)} disabled={disabled || isSaving} />
          </label>
          <label className="review-item-field">
            What you learned (optional)
            <input type="text" value={learning} onChange={(event) => setLearning(event.target.value)} disabled={disabled || isSaving} />
          </label>
          {Array.isArray(payload.moodArc) && payload.moodArc.length > 0 && (
            <p className="review-item-excerpt">Mood arc: {(payload.moodArc as string[]).join(' ')}</p>
          )}
        </>
      )}

      <div className="inline-picker-actions">
        <button type="button" className="button-secondary" onClick={handleDismiss} disabled={disabled || isSaving}>
          Not now
        </button>
        <button type="button" className="button-primary" onClick={handleSave} disabled={disabled || isSaving || !text.trim()}>
          {isSaving ? 'Saving...' : 'Save it'}
        </button>
      </div>
    </div>
  );
}
