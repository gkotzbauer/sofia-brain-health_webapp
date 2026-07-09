import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useProfile } from './useProfile';

// There is no dedicated list endpoint for story chapters -- the backend
// only exposes POST /story-chapters, and chapters are otherwise read via
// GET /users/profile (see useProfile). This hook layers chapter creation on
// top of that shared profile cache rather than introducing a second source
// of truth.
export function useChapters() {
  const queryClient = useQueryClient();
  const { profile, isLoading } = useProfile();

  const createChapter = useMutation({
    mutationFn: (data: {
      title: string;
      moment: string;
      moodArc: string[];
      choices: string;
      learning: string;
      linkedBestLifeElements?: string[];
    }) => api.createChapter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  });

  return {
    chapters: profile?.storyChapters || [],
    isLoading,
    createChapter: createChapter.mutateAsync,
    isCreating: createChapter.isPending
  };
}
