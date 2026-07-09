// Ported from the legacy app's companionConfig.aboutMeFramework
// (frontend/sofia-index.html) rather than reinvented -- these exact option
// lists are what the "About Me" conversation used to offer.
export const BEST_LIFE_ELEMENTS = [
  'Spend time with people I care about',
  'Live on my own / be independent',
  'Take care of my daily needs',
  'Exercise or play games regularly',
  'Participate in favorite hobbies',
  'Spend time outdoors or travel',
  'Work, volunteer, or help others',
  'Spend time with pets',
  'Have mental stimulation everyday'
];

export const CONCERN_CATEGORIES = [
  'Getting help with daily tasks',
  'My ability to live on my own',
  'My safety',
  'My finances',
  'My anxiety',
  'Losing interest in hobbies',
  'My diet',
  'Being lost or disoriented',
  'My sleep',
  'Alcohol or tobacco use',
  'My balance, falling',
  'My hearing or vision',
  'Being alone',
  'Being a burden',
  'Quality of care I receive'
];

export const CONFIDENCE_LEVELS = ['Very confident', 'Somewhat confident', 'Not very confident'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// Ported from the legacy chapter mood-arc picker (5 fixed emotional beats).
export const MOOD_ARC_OPTIONS = ['😔', '😐', '😊', '😄', '🌟'];
export const MOOD_ARC_LENGTH = 5;
