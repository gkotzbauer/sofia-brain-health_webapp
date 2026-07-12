import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ClinicalReportCandidates } from '../api/client';

export function useClinicalReportExtraction() {
  const queryClient = useQueryClient();

  const extract = useMutation({
    mutationFn: (documentId: string) => api.extractClinicalReport(documentId)
  });

  const applyReport = useMutation({
    mutationFn: ({ documentId, report }: { documentId: string; report: ClinicalReportCandidates }) =>
      api.applyClinicalReport(documentId, report),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-reports'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  return {
    extract: extract.mutateAsync,
    isExtracting: extract.isPending,
    extractError: extract.error instanceof Error ? extract.error.message : null,
    applyReport: applyReport.mutateAsync,
    isApplying: applyReport.isPending,
    applyError: applyReport.error instanceof Error ? applyReport.error.message : null
  };
}
