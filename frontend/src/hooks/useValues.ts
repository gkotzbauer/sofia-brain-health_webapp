import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useValues() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ['values'], queryFn: () => api.listValues() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['values'] });
  }

  const createValue = useMutation({
    mutationFn: (data: { valueText: string; importance?: string }) => api.createValue(data),
    onSuccess: invalidate
  });

  const updateValue = useMutation({
    mutationFn: ({ valueId, data }: { valueId: string; data: Partial<{ valueText: string; importance: string; userNote: string }> }) =>
      api.updateValue(valueId, data),
    onSuccess: invalidate
  });

  return {
    values: query.data || [],
    isLoading: query.isLoading,
    createValue: createValue.mutateAsync,
    isCreating: createValue.isPending,
    updateValue: updateValue.mutateAsync
  };
}
