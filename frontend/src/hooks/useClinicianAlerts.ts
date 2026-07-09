import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useClinicianAlerts() {
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ['clinical-alerts'],
    queryFn: () => api.listPendingClinicalAlerts(),
    refetchInterval: 30_000
  });

  const acknowledge = useMutation({
    mutationFn: (alertId: string) => api.acknowledgeClinicalAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-alerts'] });
    }
  });

  return {
    alerts: alertsQuery.data || [],
    isLoading: alertsQuery.isLoading,
    error: alertsQuery.error,
    acknowledge: acknowledge.mutateAsync,
    isAcknowledging: acknowledge.isPending
  };
}
