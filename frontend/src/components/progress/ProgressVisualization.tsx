import { useEffect, useState } from 'react';
import { Goal, StoryChapter } from '../../api/client';

type Style = 'journey' | 'garden' | 'constellation' | 'simple';
const STYLES: { key: Style; label: string }[] = [
  { key: 'journey', label: 'Journey' },
  { key: 'garden', label: 'Garden' },
  { key: 'constellation', label: 'Constellation' },
  { key: 'simple', label: 'Simple' }
];
const STORAGE_KEY = 'sofia_progress_style';

interface ProgressVisualizationProps {
  goals: Goal[];
  chapters: StoryChapter[];
}

// Deterministic pseudo-random in [0, 1), seeded by index -- stable across
// re-renders (unlike Math.random) so stars don't jump around.
function seededRandom(seed: number): number {
  const value = Math.sin(seed * 999.99) * 10000;
  return value - Math.floor(value);
}

function JourneyView({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return <p className="empty-state">Set a quest to begin your journey map.</p>;
  return (
    <div className="journey-view">
      {goals.map((goal, index) => (
        <div key={goal.id} className="journey-node-wrapper">
          <div className={`journey-node journey-node-${goal.status}`} title={goal.goal}>
            {goal.status === 'completed' ? '🏁' : index === goals.length - 1 ? '📍' : '●'}
          </div>
          {index < goals.length - 1 && <div className="journey-path" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}

function GardenView({ achievementCount }: { achievementCount: number }) {
  const stage = achievementCount === 0 ? '🌱' : achievementCount < 3 ? '🌿' : achievementCount < 6 ? '🌳' : '🌸';
  return (
    <div className="garden-view">
      <div className="garden-plant" aria-hidden="true">
        {stage}
      </div>
      <p>
        {achievementCount === 0
          ? 'Your garden is just getting started.'
          : `Your garden has grown from ${achievementCount} moment${achievementCount === 1 ? '' : 's'} of progress.`}
      </p>
    </div>
  );
}

function ConstellationView({ achievementCount }: { achievementCount: number }) {
  if (achievementCount === 0) return <p className="empty-state">Your constellation will form as you make progress.</p>;
  const stars = Array.from({ length: achievementCount }, (_, index) => ({
    top: 10 + seededRandom(index * 2 + 1) * 70,
    left: 5 + seededRandom(index * 2 + 2) * 90
  }));
  return (
    <div className="constellation-view">
      {stars.map((star, index) => (
        <span key={index} className="constellation-star" style={{ top: `${star.top}%`, left: `${star.left}%` }} aria-hidden="true">
          ⭐
        </span>
      ))}
      <span className="visually-hidden">{achievementCount} moments of progress, shown as stars</span>
    </div>
  );
}

function SimpleView({ goals, chapters }: { goals: Goal[]; chapters: StoryChapter[] }) {
  const active = goals.filter((goal) => goal.status === 'active').length;
  const completed = goals.filter((goal) => goal.status === 'completed').length;
  const confidences = goals.map((goal) => goal.confidence).filter((value): value is number => value != null);
  const avgConfidence = confidences.length ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 10) / 10 : null;

  return (
    <dl className="simple-view">
      <div className="simple-stat">
        <dt>Active quests</dt>
        <dd>{active}</dd>
      </div>
      <div className="simple-stat">
        <dt>Completed</dt>
        <dd>{completed}</dd>
      </div>
      <div className="simple-stat">
        <dt>Chapters written</dt>
        <dd>{chapters.length}</dd>
      </div>
      <div className="simple-stat">
        <dt>Average confidence</dt>
        <dd>{avgConfidence ?? '—'}</dd>
      </div>
    </dl>
  );
}

export function ProgressVisualization({ goals, chapters }: ProgressVisualizationProps) {
  const [style, setStyle] = useState<Style>(() => (localStorage.getItem(STORAGE_KEY) as Style) || 'simple');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, style);
  }, [style]);

  const achievementCount = goals.filter((goal) => goal.status === 'completed').length + chapters.length;

  return (
    <div className="progress-visualization">
      <div className="progress-style-switcher" role="group" aria-label="Progress view style">
        {STYLES.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={style === option.key}
            className={style === option.key ? 'toggle-chip toggle-chip-selected' : 'toggle-chip'}
            onClick={() => setStyle(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="progress-view-body">
        {style === 'journey' && <JourneyView goals={goals} />}
        {style === 'garden' && <GardenView achievementCount={achievementCount} />}
        {style === 'constellation' && <ConstellationView achievementCount={achievementCount} />}
        {style === 'simple' && <SimpleView goals={goals} chapters={chapters} />}
      </div>
    </div>
  );
}
