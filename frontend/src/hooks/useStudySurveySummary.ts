import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// Clinician/admin-only aggregate view (backend/routes/studySurvey.js
// GET /responses/summary, requireRole('clinician','admin')) -- separate
// from useStudySurvey.ts, which is the respondent-facing flow.
export function useStudySurveySummary() {
  const summaryQuery = useQuery({
    queryKey: ['study-survey', 'summary'],
    queryFn: () => api.getStudySurveySummary()
  });
  const questionsQuery = useQuery({
    queryKey: ['study-survey', 'questions'],
    queryFn: () => api.getStudySurveyQuestions()
  });

  return {
    summary: summaryQuery.data || [],
    questions: questionsQuery.data?.questions || [],
    isLoading: summaryQuery.isLoading || questionsQuery.isLoading
  };
}
