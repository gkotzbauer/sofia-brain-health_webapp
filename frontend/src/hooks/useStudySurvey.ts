import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, StudySurveyAnswerInput, StudySurveyQuestion, StudySurveyResponse } from '../api/client';

// Stable references for the "still loading" fallback -- a fresh []/[] on
// every render would change identity even when nothing loaded, which
// StudySurveyPage.tsx's useEffect (keyed on `questions`) would otherwise
// treat as new data and re-run indefinitely.
const EMPTY_QUESTIONS: StudySurveyQuestion[] = [];
const EMPTY_RESPONSES: StudySurveyResponse[] = [];

export function useStudySurvey() {
  const queryClient = useQueryClient();

  const questionsQuery = useQuery({
    queryKey: ['study-survey', 'questions'],
    queryFn: () => api.getStudySurveyQuestions()
  });

  const mineQuery = useQuery({
    queryKey: ['study-survey', 'mine'],
    queryFn: () => api.getMyStudySurveyResponses()
  });

  const submit = useMutation({
    mutationFn: (responses: StudySurveyAnswerInput[]) => api.submitStudySurveyResponses(responses),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-survey', 'mine'] });
    }
  });

  return {
    questions: questionsQuery.data?.questions || EMPTY_QUESTIONS,
    isLoadingQuestions: questionsQuery.isLoading,
    previousResponses: mineQuery.data || EMPTY_RESPONSES,
    isLoadingPrevious: mineQuery.isLoading,
    submitResponses: submit.mutateAsync,
    isSubmitting: submit.isPending,
    submitError: submit.error instanceof Error ? submit.error.message : null
  };
}
