import { FormEvent, useState } from 'react';
import { useEducationTopics } from '../../hooks/useEducationTopics';

const ENGAGEMENT_OPTIONS = ['high', 'moderate', 'low'];
const ENGAGEMENT_LABEL: Record<string, string> = { high: 'Very interested', moderate: 'Somewhat interested', low: 'Just curious' };

export function EducationTopicsSection() {
  const { topics, isLoading, createTopic, isCreating } = useEducationTopics();
  const [text, setText] = useState('');
  const [engagement, setEngagement] = useState('moderate');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await createTopic({ topic: text.trim(), engagement });
    setText('');
  }

  return (
    <section className="profile-detail-section" aria-labelledby="education-topics-heading">
      <h2 id="education-topics-heading">Topics I'd like to learn about</h2>
      <p className="section-intro">Anything you'd like Sofia to bring up or teach you more about.</p>

      <form onSubmit={handleSubmit} className="profile-detail-form">
        <label htmlFor="new-topic-text" className="visually-hidden">
          Add a topic
        </label>
        <input
          id="new-topic-text"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. Sleep and memory"
        />
        <label htmlFor="new-topic-engagement" className="visually-hidden">
          Interest level
        </label>
        <select id="new-topic-engagement" value={engagement} onChange={(event) => setEngagement(event.target.value)}>
          {ENGAGEMENT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {ENGAGEMENT_LABEL[option]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isCreating || !text.trim()}>
          Add
        </button>
      </form>

      {isLoading ? (
        <p>Loading...</p>
      ) : topics.length === 0 ? (
        <p className="empty-state">Nothing added yet.</p>
      ) : (
        <ul className="profile-detail-list">
          {topics.map((topic) => (
            <li key={topic.id} className="profile-detail-item">
              <span>{topic.topic}</span>
              <span className={`detail-badge detail-badge-${topic.engagement}`}>{ENGAGEMENT_LABEL[topic.engagement] || topic.engagement}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
