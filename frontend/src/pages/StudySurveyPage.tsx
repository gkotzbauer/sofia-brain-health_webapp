import { useEffect, useMemo, useState } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useStudySurvey } from '../hooks/useStudySurvey';
import { SurveyAnswerState, SurveyQuestion } from '../components/survey/SurveyQuestion';
import { SECTION_LABELS } from '../constants/surveyScales';
import { StudySurveyQuestion } from '../api/client';

// How many sessions before this feels worth offering -- matches
// PROGRESS_REFLECTION_INTERVAL's reasoning in backend/routes/sessions.js:
// early answers would mostly reflect first impressions rather than real
// usage. Not a hard gate -- someone can always fill it out via this page,
// this only softens how it's framed before that point.
const SURVEY_MEANINGFUL_USAGE_THRESHOLD = 3;

function groupBySection(questions: StudySurveyQuestion[]) {
  const groups = new Map<string, StudySurveyQuestion[]>();
  for (const question of questions) {
    const list = groups.get(question.section) || [];
    list.push(question);
    groups.set(question.section, list);
  }
  return groups;
}

export function StudySurveyPage() {
  const { profile } = useProfile();
  const { questions, isLoadingQuestions, previousResponses, isLoadingPrevious, submitResponses, isSubmitting, submitError } =
    useStudySurvey();
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerState>>({});
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    const missingKeys = questions.filter((question) => !answers[question.key]);
    if (missingKeys.length === 0) return;
    setAnswers((current) => {
      const next = { ...current };
      for (const question of missingKeys) {
        next[question.key] = { rating: null, explanation: '' };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const grouped = useMemo(() => groupBySection(questions), [questions]);
  const totalSessions = profile?.user?.total_sessions ?? 0;
  const hasEnoughUsage = totalSessions >= SURVEY_MEANINGFUL_USAGE_THRESHOLD;
  const lastCompletedAt = previousResponses[0]?.created_at;

  const answeredCount = questions.filter((q) => {
    const answer = answers[q.key];
    return answer && (answer.rating !== null || answer.explanation.trim());
  }).length;

  async function handleSubmit() {
    const responses = questions
      .map((question) => {
        const answer = answers[question.key];
        if (!answer || (answer.rating === null && !answer.explanation.trim())) return null;
        return {
          questionKey: question.key,
          rating: answer.rating ?? undefined,
          explanation: answer.explanation.trim() || undefined
        };
      })
      .filter((response): response is NonNullable<typeof response> => response !== null);

    if (responses.length === 0) return;

    await submitResponses(responses);
    setJustSubmitted(true);
  }

  return (
    <div className="study-survey-page">
      <h1>Feasibility survey</h1>
      <p className="section-intro">
        This is the actual research survey behind the evaluation of Sofia's design -- your honest answers help make Sofia
        better for you and for other people using it. Answer whichever questions feel relevant; nothing here is required.
      </p>

      {!hasEnoughUsage && (
        <p className="survey-usage-note">
          You'll likely have more to say after a few more sessions -- but feel free to answer now, or come back later.
        </p>
      )}

      {lastCompletedAt && !justSubmitted && (
        <p className="survey-previous-note">
          You last completed this on {new Date(lastCompletedAt).toLocaleDateString()}. Answering again replaces nothing --
          each submission is kept, so feel free to update your answers as your experience changes.
        </p>
      )}

      {justSubmitted && (
        <p className="save-confirmation" role="status">
          Thank you -- your answers have been recorded.
        </p>
      )}

      {(isLoadingQuestions || isLoadingPrevious) && <p>Loading the survey...</p>}

      {!isLoadingQuestions &&
        Array.from(grouped.entries()).map(([section, sectionQuestions]) => (
          <section key={section} className="survey-section" aria-labelledby={`survey-section-${section}`}>
            <h2 id={`survey-section-${section}`}>{SECTION_LABELS[section] || section}</h2>
            {sectionQuestions.map((question) => {
              const globalIndex = questions.findIndex((q) => q.key === question.key);
              return (
                <SurveyQuestion
                  key={question.key}
                  question={question}
                  index={globalIndex}
                  answer={answers[question.key] || { rating: null, explanation: '' }}
                  onChange={(next) => setAnswers((current) => ({ ...current, [question.key]: next }))}
                />
              );
            })}
          </section>
        ))}

      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}

      {!isLoadingQuestions && (
        <button type="button" className="button-primary" onClick={handleSubmit} disabled={isSubmitting || answeredCount === 0}>
          {isSubmitting ? 'Submitting...' : `Submit ${answeredCount > 0 ? `(${answeredCount} answered)` : ''}`}
        </button>
      )}
    </div>
  );
}
