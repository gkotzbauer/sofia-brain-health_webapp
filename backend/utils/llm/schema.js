// Shared, provider-agnostic definition of Sofia's structured per-turn
// output. Anthropic tool_use and OpenAI function-calling both accept
// standard JSON Schema for their parameters, so one definition backs both
// providers (see anthropicProvider.js / openaiProvider.js). Deliberately
// NOT using OpenAI "strict" structured outputs (which forbids optional
// properties and nullable unions) so the same loose schema -- and the same
// reliability characteristics -- apply to both providers.
const { RISK_DOMAIN_KEYS } = require('../riskDomains');

const SOFIA_TURN_TOOL_NAME = 'sofia_turn_response';

const SOFIA_TURN_TOOL_DESCRIPTION =
  "Sofia's next conversational turn, plus structured tracking of CARE phase, education tier, adaptive pattern, any pivot, a safety assessment, and any goal/chapter/value/concern/education-topic the user is proposing to save.";

const SOFIA_TURN_PARAMETERS = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: "The only field shown to the user -- Sofia's natural-language reply, in her warm hero's-journey voice."
    },
    entry_point: {
      type: 'string',
      enum: ['validation', 'strength_based', 'goal_oriented', 'educational']
    },
    care_phase: {
      type: 'string',
      enum: ['clarify', 'assess', 'relate', 'engage', 'complete']
    },
    education_tier: {
      type: ['string', 'null'],
      enum: ['micro', 'standard', 'deep_dive', null]
    },
    education_domain: {
      type: ['string', 'null'],
      description:
        "Only set when this turn's reply delivers a standard or deep_dive education moment that substantively covers one of these specific Lancet Commission risk-factor domains (see 'Brain health domains' in the system prompt) -- not for micro moments, general conversation, or education on something outside this list. Leave null otherwise.",
      enum: [...RISK_DOMAIN_KEYS, null]
    },
    adaptive_pattern: {
      type: ['string', 'null'],
      enum: ['anxious', 'information_seeker', 'action_oriented', 'reluctant', null]
    },
    pivot: {
      type: ['object', 'null'],
      properties: {
        type: { type: 'string', enum: ['distress', 'direct_question', 'new_concern', 'fatigue'] },
        note: { type: 'string' }
      }
    },
    safety_assessment: {
      type: 'object',
      description: 'Set on every turn, even when nothing is wrong (trigger_type "none", risk_level "low").',
      properties: {
        risk_level: { type: 'string', enum: ['low', 'moderate', 'high', 'critical'] },
        trigger_type: { type: 'string', enum: ['none', 'emergency', 'distress', 'frustration', 'repetition', 'inclusion'] },
        rationale: { type: 'string' }
      },
      required: ['risk_level', 'trigger_type', 'rationale']
    },
    proposed_goal: {
      type: ['object', 'null'],
      description: 'Only set when proposing to save a new/updated goal -- never assume it is saved.',
      properties: {
        text: { type: 'string' },
        confidence: { type: 'integer', minimum: 1, maximum: 10 }
      }
    },
    proposed_chapter: {
      type: ['object', 'null'],
      description: 'Only set when proposing to save a story chapter -- never assume it is saved.',
      properties: {
        title: { type: 'string' },
        moment: { type: 'string' },
        moodArc: { type: 'array', items: { type: 'string' } },
        choices: { type: 'string' },
        learning: { type: 'string' }
      }
    },
    proposed_value: {
      type: ['object', 'null'],
      description:
        'Only set when the person has expressed a personal value worth saving to their profile (e.g. "I really want to stay independent") -- never assume it is saved.',
      properties: {
        text: { type: 'string' },
        importance: { type: 'string', enum: ['high', 'medium', 'low'] }
      }
    },
    proposed_concern_detail: {
      type: ['object', 'null'],
      description:
        'Only set when the person has expressed a specific worry worth saving to their profile, with enough detail to be more than a one-line concern -- never assume it is saved.',
      properties: {
        text: { type: 'string' },
        severity: { type: 'string', enum: ['mild', 'moderate', 'severe'] },
        context: { type: 'string' }
      }
    },
    proposed_education_topic: {
      type: ['object', 'null'],
      description:
        'Only set when the person has shown curiosity about a specific topic worth tracking as something to teach them more about -- never assume it is saved.',
      properties: {
        text: { type: 'string' },
        engagement: { type: 'string', enum: ['low', 'moderate', 'high'] }
      }
    },
    quick_replies: {
      type: ['array', 'null'],
      description:
        "2-4 short, concrete things the person might say or tap next, in their own voice (e.g. \"Tell me more about that\", \"Let's set a goal\", \"Not right now\") -- this is what makes the conversation feel actively facilitated rather than an open blank box. Offer these at nearly every turn where there's a natural next step or choice; omit (null) only for moments that call for open reflection, like sitting with strong emotion.",
      items: { type: 'string' }
    },
    inline_picker: {
      type: ['object', 'null'],
      description:
        'Set this to invite the person to pick from a fixed set of options shown as selectable chips directly in the chat, instead of free text -- used for the structured About Me onboarding. The app supplies the actual option list and does the saving; you only choose which picker to show and the lead-in prompt text.',
      properties: {
        type: { type: 'string', enum: ['best_life_elements', 'concerns', 'confidence_level'] },
        prompt: { type: 'string', description: 'A short lead-in line introducing the picker, shown just above the choices.' }
      }
    }
  },
  required: ['reply', 'care_phase', 'safety_assessment']
};

module.exports = { SOFIA_TURN_TOOL_NAME, SOFIA_TURN_TOOL_DESCRIPTION, SOFIA_TURN_PARAMETERS };
