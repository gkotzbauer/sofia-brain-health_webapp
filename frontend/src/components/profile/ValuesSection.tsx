import { FormEvent, useState } from 'react';
import { useValues } from '../../hooks/useValues';

const IMPORTANCE_OPTIONS = ['high', 'medium', 'low'];
const IMPORTANCE_LABEL: Record<string, string> = { high: 'High importance', medium: 'Medium importance', low: 'Low importance' };

export function ValuesSection() {
  const { values, isLoading, createValue, isCreating } = useValues();
  const [text, setText] = useState('');
  const [importance, setImportance] = useState('high');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await createValue({ valueText: text.trim(), importance });
    setText('');
  }

  return (
    <section className="profile-detail-section" aria-labelledby="values-heading">
      <h2 id="values-heading">My values</h2>
      <p className="section-intro">Things that matter to you, in your own words -- beyond the checklist above.</p>

      <form onSubmit={handleSubmit} className="profile-detail-form">
        <label htmlFor="new-value-text" className="visually-hidden">
          Add a value
        </label>
        <input
          id="new-value-text"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. Staying independent in my own home"
        />
        <label htmlFor="new-value-importance" className="visually-hidden">
          Importance
        </label>
        <select id="new-value-importance" value={importance} onChange={(event) => setImportance(event.target.value)}>
          {IMPORTANCE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {IMPORTANCE_LABEL[option]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isCreating || !text.trim()}>
          Add
        </button>
      </form>

      {isLoading ? (
        <p>Loading...</p>
      ) : values.length === 0 ? (
        <p className="empty-state">Nothing added yet.</p>
      ) : (
        <ul className="profile-detail-list">
          {values.map((value) => (
            <li key={value.id} className="profile-detail-item">
              <span>{value.value_text}</span>
              <span className={`detail-badge detail-badge-${value.importance}`}>{IMPORTANCE_LABEL[value.importance] || value.importance}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
