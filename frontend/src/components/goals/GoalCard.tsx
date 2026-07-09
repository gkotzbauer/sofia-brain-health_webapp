import { useState } from 'react';
import { Goal } from '../../api/client';

interface GoalCardProps {
  goal: Goal;
  onUpdateStatus: (status: Goal['status']) => Promise<unknown>;
  onRecordProgress: (note: string, confidenceUpdate?: number) => Promise<unknown>;
}

const STATUS_LABELS: Record<Goal['status'], string> = {
  active: 'Active quest',
  completed: 'Completed',
  paused: 'Paused',
  abandoned: 'Set aside'
};

export function GoalCard({ goal, onUpdateStatus, onRecordProgress }: GoalCardProps) {
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleProgressSubmit() {
    if (!note.trim()) return;
    setIsSubmitting(true);
    try {
      await onRecordProgress(note.trim());
      setNote('');
      setShowProgressForm(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={`goal-card goal-card-${goal.status}`}>
      <div className="goal-card-header">
        <p className="goal-card-text">{goal.goal}</p>
        <span className="goal-card-status">{STATUS_LABELS[goal.status]}</span>
      </div>
      {goal.confidence != null && (
        <p className="goal-card-confidence">Confidence: {goal.confidence}/10</p>
      )}
      {goal.user_note && <p className="goal-card-note">{goal.user_note}</p>}

      <div className="goal-card-actions">
        {goal.status === 'active' && (
          <>
            <button type="button" onClick={() => setShowProgressForm((prev) => !prev)}>
              Log progress
            </button>
            <button type="button" onClick={() => onUpdateStatus('completed')}>
              Mark complete
            </button>
            <button type="button" onClick={() => onUpdateStatus('paused')}>
              Pause
            </button>
          </>
        )}
        {goal.status === 'paused' && (
          <button type="button" onClick={() => onUpdateStatus('active')}>
            Resume
          </button>
        )}
      </div>

      {showProgressForm && (
        <div className="goal-progress-form">
          <label htmlFor={`progress-${goal.id}`} className="visually-hidden">
            Progress note
          </label>
          <textarea
            id={`progress-${goal.id}`}
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="How is it going?"
          />
          <button type="button" onClick={handleProgressSubmit} disabled={isSubmitting || !note.trim()}>
            {isSubmitting ? 'Saving...' : 'Save note'}
          </button>
        </div>
      )}
    </div>
  );
}
