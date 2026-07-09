import { Goal } from '../../api/client';
import { GoalCard } from './GoalCard';

interface GoalListProps {
  goals: Goal[];
  onUpdateStatus: (goalId: string, status: Goal['status']) => Promise<unknown>;
  onRecordProgress: (goalId: string, note: string) => Promise<unknown>;
}

export function GoalList({ goals, onUpdateStatus, onRecordProgress }: GoalListProps) {
  if (goals.length === 0) {
    return <p className="empty-state">No quests yet -- set one above whenever you're ready.</p>;
  }

  const order: Record<Goal['status'], number> = { active: 0, paused: 1, completed: 2, abandoned: 3 };
  const sorted = [...goals].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="goal-list">
      {sorted.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          onUpdateStatus={(status) => onUpdateStatus(goal.id, status)}
          onRecordProgress={(note) => onRecordProgress(goal.id, note)}
        />
      ))}
    </div>
  );
}
