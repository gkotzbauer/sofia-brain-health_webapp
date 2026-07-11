import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../hooks/useProfile';
import { useGoals } from '../../hooks/useGoals';
import { useValues } from '../../hooks/useValues';
import { useConcerns } from '../../hooks/useConcerns';
import { useEducationTopics } from '../../hooks/useEducationTopics';

type FilterKey = 'all' | 'aboutMe' | 'chapters' | 'goals' | 'concerns' | 'values' | 'learning';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'aboutMe', label: 'About Me' },
  { key: 'chapters', label: 'Chapters' },
  { key: 'goals', label: 'Goals' },
  { key: 'concerns', label: 'Concerns' },
  { key: 'values', label: 'Values' },
  { key: 'learning', label: 'Learning' }
];

interface MemoryItem {
  id: string;
  filterKey: Exclude<FilterKey, 'all'>;
  label: string;
  text: string;
  meta?: string;
  timestamp: string | null;
  accentVar: string;
}

const MAX_ITEMS = 20;

function asTimestamp(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

// A live, filterable feed of everything Sofia has learned so far -- inspired
// by sofia-enhanced-narrative.html's "Your Story Journal" panel. Reuses the
// same data every other profile-related page already fetches (About Me,
// goals, story chapters, values, concerns, education topics) rather than
// introducing new backend endpoints, so it costs nothing beyond warming
// react-query caches that the Profile/Goals/Story pages already rely on.
export function MemoryJournalPanel() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const { profile, isLoading: isProfileLoading } = useProfile();
  const { goals, isLoading: isGoalsLoading } = useGoals();
  const { values, isLoading: isValuesLoading } = useValues();
  const { concerns, isLoading: isConcernsLoading } = useConcerns();
  const { topics, isLoading: isTopicsLoading } = useEducationTopics();

  const isLoading = isProfileLoading || isGoalsLoading || isValuesLoading || isConcernsLoading || isTopicsLoading;

  const items = useMemo<MemoryItem[]>(() => {
    const result: MemoryItem[] = [];

    (profile?.aboutMe?.best_life_elements || []).forEach((text, index) => {
      result.push({
        id: `about-best-${index}`,
        filterKey: 'aboutMe',
        label: 'What matters to you',
        text,
        timestamp: null,
        accentVar: '--color-success'
      });
    });
    (profile?.aboutMe?.concerns || []).forEach((text, index) => {
      result.push({
        id: `about-concern-${index}`,
        filterKey: 'aboutMe',
        label: 'About Me',
        text,
        timestamp: null,
        accentVar: '--color-success'
      });
    });

    (profile?.storyChapters || []).forEach((chapter) => {
      result.push({
        id: `chapter-${chapter.id}`,
        filterKey: 'chapters',
        label: 'Chapter',
        text: chapter.title,
        timestamp: asTimestamp(chapter.created_at),
        accentVar: '--color-chapter'
      });
    });

    goals.forEach((goal) => {
      result.push({
        id: `goal-${goal.id}`,
        filterKey: 'goals',
        label: 'Goal',
        text: goal.goal,
        meta: goal.status,
        timestamp: asTimestamp(goal.created_at),
        accentVar: '--color-primary'
      });
    });

    concerns.forEach((concern) => {
      result.push({
        id: `concern-${concern.id}`,
        filterKey: 'concerns',
        label: 'Concern',
        text: concern.concern,
        meta: concern.severity,
        timestamp: asTimestamp(concern.created_at),
        accentVar: '--color-danger-surface'
      });
    });

    values.forEach((value) => {
      result.push({
        id: `value-${value.id}`,
        filterKey: 'values',
        label: 'Value',
        text: value.value_text,
        meta: value.importance,
        timestamp: asTimestamp(value.created_at),
        accentVar: '--color-accent'
      });
    });

    topics.forEach((topic) => {
      result.push({
        id: `topic-${topic.id}`,
        filterKey: 'learning',
        label: 'Learning',
        text: topic.topic,
        meta: topic.engagement,
        timestamp: asTimestamp(topic.created_at),
        accentVar: '--color-education'
      });
    });

    return result.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [profile, goals, values, concerns, topics]);

  const filtered = (filter === 'all' ? items : items.filter((item) => item.filterKey === filter)).slice(0, MAX_ITEMS);

  return (
    <aside className="memory-panel card" aria-label="Your story journal">
      <h2>Your story journal</h2>
      <div className="memory-filter-row" role="group" aria-label="Filter your story journal">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`pill${filter === option.key ? ' pill-active' : ''}`}
            aria-pressed={filter === option.key}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="chat-status">Gathering what Sofia knows so far...</p>}

      {!isLoading && filtered.length === 0 && <p className="empty-state">Nothing here yet -- it'll fill in as you talk with Sofia.</p>}

      <ul className="memory-item-list">
        {filtered.map((item) => (
          <li key={item.id} className="left-accent-card memory-item" style={{ '--accent-color': `var(${item.accentVar})` } as React.CSSProperties}>
            <p className="memory-item-label">{item.label}</p>
            <p className="memory-item-text">{item.text}</p>
            {item.meta && <p className="memory-item-meta">{item.meta}</p>}
          </li>
        ))}
      </ul>

      <p className="memory-panel-links">
        <Link to="/profile">Full profile</Link> · <Link to="/goals">All quests</Link> · <Link to="/story">Full story</Link>
      </p>
    </aside>
  );
}
