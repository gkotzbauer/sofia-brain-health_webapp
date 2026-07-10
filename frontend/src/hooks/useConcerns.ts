import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useConcerns() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ['concerns'], queryFn: () => api.listConcerns() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['concerns'] });
  }

  const createConcern = useMutation({
    mutationFn: (data: { concern: string; severity?: string; context?: string }) => api.createConcern(data),
    onSuccess: invalidate
  });

  const updateConcern = useMutation({
    mutationFn: ({
      concernId,
      data
    }: {
      concernId: string;
      data: Partial<{ concern: string; severity: string; context: string; userNote: string }>;
    }) => api.updateConcern(concernId, data),
    onSuccess: invalidate
  });

  return {
    concerns: query.data || [],
    isLoading: query.isLoading,
    createConcern: createConcern.mutateAsync,
    isCreating: createConcern.isPending,
    updateConcern: updateConcern.mutateAsync
  };
}
