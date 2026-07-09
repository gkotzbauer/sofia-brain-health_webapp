import { FormEvent, useState } from 'react';
import { MOOD_ARC_LENGTH, MOOD_ARC_OPTIONS } from '../../constants/aboutMeOptions';

interface ChapterFormProps {
  onSave: (data: { title: string; moment: string; moodArc: string[]; choices: string; learning: string }) => Promise<unknown>;
  onCancel: () => void;
}

export function ChapterForm({ onSave, onCancel }: ChapterFormProps) {
  const [title, setTitle] = useState('');
  const [moment, setMoment] = useState('');
  const [choices, setChoices] = useState('');
  const [learning, setLearning] = useState('');
  const [moodArc, setMoodArc] = useState<string[]>(Array(MOOD_ARC_LENGTH).fill('😐'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !moment.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave({ title: title.trim(), moment: moment.trim(), moodArc, choices: choices.trim(), learning: learning.trim() });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="chapter-form" onSubmit={handleSubmit}>
      <label htmlFor="chapter-title">Chapter title</label>
      <input id="chapter-title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} required />

      <label htmlFor="chapter-moment">Describe the key moment</label>
      <textarea id="chapter-moment" rows={3} value={moment} onChange={(event) => setMoment(event.target.value)} required />

      <fieldset className="mood-arc-picker">
        <legend>Your emotional journey through this moment</legend>
        <div className="mood-arc-nodes">
          {moodArc.map((mood, index) => (
            <label key={index} className="mood-arc-node">
              <span className="visually-hidden">Beat {index + 1} mood</span>
              <select
                value={mood}
                onChange={(event) => {
                  const next = [...moodArc];
                  next[index] = event.target.value;
                  setMoodArc(next);
                }}
              >
                {MOOD_ARC_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="chapter-choices">What choices led to this moment?</label>
      <textarea id="chapter-choices" rows={2} value={choices} onChange={(event) => setChoices(event.target.value)} />

      <label htmlFor="chapter-learning">What did you learn?</label>
      <textarea id="chapter-learning" rows={2} value={learning} onChange={(event) => setLearning(event.target.value)} />

      <div className="chapter-form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting || !title.trim() || !moment.trim()}>
          {isSubmitting ? 'Saving...' : 'Save chapter'}
        </button>
      </div>
    </form>
  );
}
