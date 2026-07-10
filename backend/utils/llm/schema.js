// Shared, provider-agnostic definition of Sofia's structured per-turn
// output. Anthropic tool_use and OpenAI function-calling both accept
// standard JSON Schema for their parameters, so one definition backs both
// providers (see anthropicProvider.js / openaiProvider.js). Deliberately
// NOT using OpenAI "strict" structured outputs (which forbids optional
// properties and nullable unions) so the same loose schema -- and the same
// reliability characteristics -- apply to both providers.
const SOFIA_TURN_TOOL_NAME = 'sofia_turn_response';

const SOFIA_TURN_TOOL_DESCRIPTION =
  "Sofia's next conversational turn, plus structured tracking of CARE phase, education tier, adaptive pattern, any pivot, a safety assessment, and any goal/chapter the user is proposing to save.";

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
    }
  },
  required: ['reply', 'care_phase', 'safety_assessment']
};

module.exports = { SOFIA_TURN_TOOL_NAME, SOFIA_TURN_TOOL_DESCRIPTION, SOFIA_TURN_PARAMETERS };
