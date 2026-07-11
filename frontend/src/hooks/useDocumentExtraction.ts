import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApplyExtractionPayload } from '../api/client';

export function useDocumentExtraction() {
  const queryClient = useQueryClient();

  const extract = useMutation({
    mutationFn: (documentId: string) => api.extractDocument(documentId)
  });

  const applyExtraction = useMutation({
    mutationFn: ({ documentId, payload }: { documentId: string; payload: ApplyExtractionPayload }) =>
      api.applyDocumentExtraction(documentId, payload),
    onSuccess: () => {
      // The accepted candidates land in the same profile the Profile page
      // reads (About Me, values, concerns, education topics, goals) --
      // refetch all of it so the person sees what was just added.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['values'] });
      queryClient.invalidateQueries({ queryKey: ['concerns'] });
      queryClient.invalidateQueries({ queryKey: ['education-topics'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    }
  });

  return {
    extract: extract.mutateAsync,
    isExtracting: extract.isPending,
    extractError: extract.error instanceof Error ? extract.error.message : null,
    applyExtraction: applyExtraction.mutateAsync,
    isApplying: applyExtraction.isPending,
    applyError: applyExtraction.error instanceof Error ? applyExtraction.error.message : null
  };
}
