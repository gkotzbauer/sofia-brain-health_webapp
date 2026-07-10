import { FormEvent, useState } from 'react';
import { useConcerns } from '../../hooks/useConcerns';

const SEVERITY_OPTIONS = ['high', 'moderate', 'low'];
const SEVERITY_LABEL: Record<string, string> = { high: 'High severity', moderate: 'Moderate severity', low: 'Low severity' };

export function ConcernsSection() {
  const { concerns, isLoading, createConcern, isCreating } = useConcerns();
  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const [severity, setSeverity] = useState('moderate');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await createConcern({ concern: text.trim(), severity, context: context.trim() || undefined });
    setText('');
    setContext('');
  }

  return (
    <section className="profile-detail-section" aria-labelledby="concerns-heading">
      <h2 id="concerns-heading">My concerns</h2>
      <p className="section-intro">
        Specific worries you'd like Sofia to know about, with as much or as little detail as you'd like to share.
      </p>

      <form onSubmit={handleSubmit} className="profile-detail-form profile-detail-form-stacked">
        <label htmlFor="new-concern-text">Add a concern</label>
        <input
          id="new-concern-text"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. Forgetting to take my medication"
        />

        <label htmlFor="new-concern-context">Details (optional)</label>
        <textarea
          id="new-concern-context"
          rows={2}
          value={context}
          onChange={(event) => setContext(event.target.value)}
          placeholder="Anything more you'd like to share about this"
        />

        <label htmlFor="new-concern-severity" className="visually-hidden">
          Severity
        </label>
        <div className="profile-detail-form-row">
          <select id="new-concern-severity" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SEVERITY_LABEL[option]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={isCreating || !text.trim()}>
            Add
          </button>
        </div>
      </form>

      {isLoading ? (
        <p>Loading...</p>
      ) : concerns.length === 0 ? (
        <p className="empty-state">Nothing added yet.</p>
      ) : (
        <ul className="profile-detail-list">
          {concerns.map((concern) => (
            <li key={concern.id} className="profile-detail-item profile-detail-item-stacked">
              <div className="profile-detail-item-header">
                <span>{concern.concern}</span>
                <span className={`detail-badge detail-badge-${concern.severity}`}>{SEVERITY_LABEL[concern.severity] || concern.severity}</span>
              </div>
              {concern.context && <p className="profile-detail-context">{concern.context}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
