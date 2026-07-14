import { SurveyScale } from '../api/client';

// The 1-5 label sets specified by the study instrument, verbatim. The
// confidence scale only names points 1, 3, and 5 in the instrument itself
// -- 2 and 4 are deliberately left unlabeled (empty string) rather than
// inventing wording the instrument doesn't specify.
export const SCALE_LABELS: Record<Exclude<SurveyScale, 'open'>, string[]> = {
  likelihood: ['Extremely Unlikely', 'Unlikely', 'Neutral', 'Likely', 'Extremely Likely'],
  agreement: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
  confidence: ['Not Very Confident', '', 'Somewhat Confident', '', 'Very Confident']
};

export const SECTION_LABELS: Record<string, string> = {
  feasibility: 'Feasibility',
  quality_of_life: 'Quality of Life',
  confidence_capability: 'Confidence and Capability',
  adaptability: 'Adaptability'
};
