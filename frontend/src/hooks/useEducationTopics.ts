import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useEducationTopics() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ['education-topics'], queryFn: () => api.listEducationTopics() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['education-topics'] });
  }

  const createTopic = useMutation({
    mutationFn: (data: { topic: string; engagement?: string }) => api.createEducationTopic(data),
    onSuccess: invalidate
  });

  const updateTopic = useMutation({
    mutationFn: ({
      topicId,
      data
    }: {
      topicId: string;
      data: Partial<{ topic: string; engagement: string; userNote: string }>;
    }) => api.updateEducationTopic(topicId, data),
    onSuccess: invalidate
  });

  return {
    topics: query.data || [],
    isLoading: query.isLoading,
    createTopic: createTopic.mutateAsync,
    isCreating: createTopic.isPending,
    updateTopic: updateTopic.mutateAsync
  };
}
