import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, AboutMe } from '../api/client';

export function useProfile() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile()
  });

  const updateAboutMe = useMutation({
    mutationFn: (data: Partial<AboutMe>) => api.updateAboutMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  });

  const updateLanguagePreference = useMutation({
    mutationFn: (preferredLanguage: string) => api.updateLanguagePreference(preferredLanguage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateAboutMe: updateAboutMe.mutateAsync,
    isSaving: updateAboutMe.isPending,
    updateLanguagePreference: updateLanguagePreference.mutateAsync,
    isSavingLanguagePreference: updateLanguagePreference.isPending
  };
}
