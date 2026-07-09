import { useGoals } from '../hooks/useGoals';
import { useChapters } from '../hooks/useChapters';
import { GoalConfidenceGate } from '../components/goals/GoalConfidenceGate';
import { GoalList } from '../components/goals/GoalList';
import { ProgressVisualization } from '../components/progress/ProgressVisualization';

export function GoalsPage() {
  const { goals, isLoading, createGoal, updateGoal, recordProgress } = useGoals();
  const { chapters } = useChapters();

  return (
    <div className="goals-page">
      <h1>Your quests</h1>

      <section aria-label="Your progress">
        <ProgressVisualization goals={goals} chapters={chapters} />
      </section>

      <section aria-label="Set a new quest">
        <h2>Set a new quest</h2>
        <GoalConfidenceGate
          onCreateGoal={(data) => createGoal(data)}
          onSaveNote={(goalId, note) => updateGoal({ goalId, data: { userNote: note } })}
        />
      </section>

      <section aria-label="Your quests">
        {isLoading ? (
          <p>Loading your quests...</p>
        ) : (
          <GoalList
            goals={goals}
            onUpdateStatus={(goalId, status) => updateGoal({ goalId, data: { status } })}
            onRecordProgress={(goalId, note) => recordProgress({ goalId, data: { progressNote: note } })}
          />
        )}
      </section>
    </div>
  );
}
