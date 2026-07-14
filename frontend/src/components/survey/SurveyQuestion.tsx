import { StudySurveyQuestion } from '../../api/client';
import { SCALE_LABELS } from '../../constants/surveyScales';

export interface SurveyAnswerState {
  rating: number | null;
  explanation: string;
}

interface SurveyQuestionProps {
  question: StudySurveyQuestion;
  answer: SurveyAnswerState;
  onChange: (next: SurveyAnswerState) => void;
  index: number;
}

// Generalized from GoalConfidenceGate's 1-10 slider pattern (frontend/src/
// components/goals/GoalConfidenceGate.tsx), but 1-5 with the study
// instrument's own label sets, and always paired with a "please explain
// your answer" follow-up -- the instrument asks for an explanation on
// every question, not just low ratings. Open-ended Adaptability questions
// (question.scale === 'open') skip the rating slider entirely.
export function SurveyQuestion({ question, answer, onChange, index }: SurveyQuestionProps) {
  const labels = question.scale !== 'open' ? SCALE_LABELS[question.scale] : null;

  return (
    <div className="survey-question">
      <p className="survey-question-text">
        <span className="survey-question-number">{index + 1}.</span> {question.text}
      </p>

      {labels && (
        <div className="survey-rating-row">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={answer.rating ?? 3}
            aria-label={question.text}
            onChange={(event) => onChange({ ...answer, rating: Number(event.target.value) })}
          />
          <output className="survey-rating-value">
            {answer.rating ?? '--'}
            {answer.rating ? ` -- ${labels[answer.rating - 1] || ''}` : ' -- move the slider to answer'}
          </output>
        </div>
      )}

      <label className="survey-explanation-label" htmlFor={`survey-explain-${question.key}`}>
        Please explain your answer{labels ? ' (optional)' : ''}
      </label>
      <textarea
        id={`survey-explain-${question.key}`}
        rows={2}
        value={answer.explanation}
        onChange={(event) => onChange({ ...answer, explanation: event.target.value })}
      />
    </div>
  );
}
