import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

// Backend POST /api/feedback already existed (backend/routes/feedback.js)
// but had no frontend caller anywhere -- this wires it up. No list query
// here: feedback is a one-way "tell us how this went" note, not something
// the person needs to review afterward (clinicians see it via a separate
// admin view, out of scope here).
export function useFeedback() {
  const submit = useMutation({
    mutationFn: (data: { sessionId?: string; feedbackText: string; challengesText?: string; improvementsText?: string }) =>
      api.submitFeedback(data)
  });

  return {
    submitFeedback: submit.mutateAsync,
    isSubmitting: submit.isPending,
    submitError: submit.error instanceof Error ? submit.error.message : null
  };
}
