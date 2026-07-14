// The single source of truth for the 16-question feasibility study
// instrument, served to the frontend via GET /api/study-survey/questions
// so question wording lives in exactly one place. Sections and NPT
// constructs match the study protocol verbatim; `scale` selects which
// label set the frontend shows (see frontend/src/constants/
// surveyScales.ts) -- 'open' questions have no rating, free text only.
const STUDY_SURVEY_QUESTIONS = [
  // Primary Endpoint: Feasibility (NPT: Cognitive Participation)
  {
    key: 'feasibility_goals',
    section: 'feasibility',
    nptConstruct: 'Cognitive Participation',
    scale: 'likelihood',
    text: 'On a scale of 1 to 5, how likely are you to use the Cognitive Care Companion to help you achieve your brain health goal(s)?'
  },
  {
    key: 'feasibility_understand_brain',
    section: 'feasibility',
    nptConstruct: 'Cognitive Participation',
    scale: 'likelihood',
    text: 'On a scale of 1 to 5, how likely are you to use the Cognitive Care Companion to help you understand what is happening in your brain as you age?'
  },
  {
    key: 'feasibility_lifestyle',
    section: 'feasibility',
    nptConstruct: 'Cognitive Participation',
    scale: 'likelihood',
    text: 'On a scale of 1 to 5, how likely are you to use the Cognitive Care Companion to help you understand the lifestyle choices you can make to influence your brain health?'
  },
  {
    key: 'feasibility_recommend',
    section: 'feasibility',
    nptConstruct: 'Cognitive Participation',
    scale: 'likelihood',
    text: 'On a scale of 1 to 5, how likely are you to recommend the Cognitive Care Companion to an aging adult as a tool to help them achieve their brain health goals?'
  },

  // Secondary Endpoint: Quality of Life (NPT: Reflexive Monitoring)
  {
    key: 'qol_effective',
    section: 'quality_of_life',
    nptConstruct: 'Reflexive Monitoring',
    scale: 'agreement',
    text: 'The Cognitive Care Companion is an effective solution for helping me address my brain health concerns or goals.'
  },

  // Secondary Endpoint: Confidence and Capability
  {
    key: 'confidence_regular_use',
    section: 'confidence_capability',
    nptConstruct: 'Reflexive Monitoring',
    scale: 'confidence',
    text: 'I am confident I can regularly use the Cognitive Care Companion to address my brain health concerns or goals.'
  },
  {
    key: 'coherence_understand_brain',
    section: 'confidence_capability',
    nptConstruct: 'Coherence',
    scale: 'agreement',
    text: 'The Cognitive Care Companion helps me understand what is happening in my brain as I age.'
  },
  {
    key: 'coherence_understand_conditions',
    section: 'confidence_capability',
    nptConstruct: 'Coherence',
    scale: 'agreement',
    text: 'The Cognitive Care Companion helps me understand the health conditions that influence my brain health.'
  },
  {
    key: 'coherence_understand_lifestyle',
    section: 'confidence_capability',
    nptConstruct: 'Coherence',
    scale: 'agreement',
    text: 'The Cognitive Care Companion helps me understand the lifestyle choices I can make to influence my brain health.'
  },
  {
    key: 'collective_action_clear',
    section: 'confidence_capability',
    nptConstruct: 'Collective Action',
    scale: 'agreement',
    text: 'The Cognitive Care Companion communicates in a way that is clear and easy to understand.'
  },
  {
    key: 'collective_action_easy',
    section: 'confidence_capability',
    nptConstruct: 'Collective Action',
    scale: 'agreement',
    text: 'The Cognitive Care Companion is easy to use.'
  },
  {
    key: 'collective_action_independent',
    section: 'confidence_capability',
    nptConstruct: 'Collective Action',
    scale: 'agreement',
    text: 'I could use the Cognitive Care Companion without needing help from someone else.'
  },

  // Secondary Endpoint: Adaptability
  {
    key: 'adaptability_challenges',
    section: 'adaptability',
    nptConstruct: null,
    scale: 'open',
    text: 'Did you encounter any challenges when using the Cognitive Care Companion?'
  },
  {
    key: 'adaptability_improvements',
    section: 'adaptability',
    nptConstruct: null,
    scale: 'open',
    text: 'What improvements are needed for you to regularly use the Companion to address your brain health concerns or goals?'
  },
  {
    key: 'adaptability_communication_style',
    section: 'adaptability',
    nptConstruct: null,
    scale: 'open',
    text: 'Did the style of communication (e.g., language, tone, speed) used by the Companion feel natural and relatable to you?'
  },
  {
    key: 'adaptability_cultural_respect',
    section: 'adaptability',
    nptConstruct: null,
    scale: 'open',
    text: 'Did the Companion communicate with you in a way that was respectful of your cultural background?'
  }
];

const STUDY_SURVEY_QUESTION_KEYS = STUDY_SURVEY_QUESTIONS.map((q) => q.key);
const STUDY_SURVEY_QUESTIONS_BY_KEY = Object.fromEntries(STUDY_SURVEY_QUESTIONS.map((q) => [q.key, q]));

module.exports = { STUDY_SURVEY_QUESTIONS, STUDY_SURVEY_QUESTION_KEYS, STUDY_SURVEY_QUESTIONS_BY_KEY };
