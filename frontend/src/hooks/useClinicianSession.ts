import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useClinicianSession(sessionId: string | undefined) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ['clinician-session', sessionId],
    queryFn: () => api.getClinicianSession(sessionId as string),
    enabled: !!sessionId
  });

  const sendMessage = useMutation({
    mutationFn: (message: string) => api.sendClinicianMessage(sessionId as string, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinician-session', sessionId] });
    }
  });

  return {
    session: sessionQuery.data,
    isLoading: sessionQuery.isLoading,
    error: sessionQuery.error,
    sendMessage: sendMessage.mutateAsync,
    isSending: sendMessage.isPending
  };
}
