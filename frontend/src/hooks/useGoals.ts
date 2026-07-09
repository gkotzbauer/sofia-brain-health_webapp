import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Goal } from '../api/client';

export function useGoals() {
  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.listGoals()
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
  }

  const createGoal = useMutation({
    mutationFn: (data: { goal: string; confidence: number; linkedBestLifeElements?: string[] }) => api.createGoal(data),
    onSuccess: invalidate
  });

  const updateGoal = useMutation({
    mutationFn: ({
      goalId,
      data
    }: {
      goalId: string;
      data: Partial<{ goal: string; confidence: number; status: Goal['status']; userNote: string }>;
    }) => api.updateGoal(goalId, data),
    onSuccess: invalidate
  });

  const recordProgress = useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: { progressNote: string; confidenceUpdate?: number } }) =>
      api.recordGoalProgress(goalId, data),
    onSuccess: invalidate
  });

  return {
    goals: goalsQuery.data || [],
    isLoading: goalsQuery.isLoading,
    createGoal: createGoal.mutateAsync,
    isCreating: createGoal.isPending,
    updateGoal: updateGoal.mutateAsync,
    recordProgress: recordProgress.mutateAsync
  };
}
