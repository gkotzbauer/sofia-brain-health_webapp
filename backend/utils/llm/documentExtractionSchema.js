// Structured-output definition for extracting candidate profile fields from
// an uploaded document (e.g. a clinician's after-visit summary or care
// plan). Separate tool from schema.js's sofia_turn_response -- this is a
// one-off document-processing call, not a conversational turn, and reuses
// only the forced-tool-call plumbing (see anthropicProvider.js/
// openaiProvider.js generateStructuredExtraction), not the conversation
// system prompt. Every candidate is nullable/omittable and carries a
// source_excerpt so the review UI (frontend DocumentReviewModal) can show
// the user what in the document grounds each suggestion -- candidates are
// never auto-written to the profile (see routes/documents.js /extract and
// /apply-extraction).
const DOCUMENT_EXTRACTION_TOOL_NAME = 'sofia_document_extraction';

const DOCUMENT_EXTRACTION_TOOL_DESCRIPTION =
  'Candidate profile fields extracted from a document, each grounded in a short excerpt -- never invented. The person reviews and chooses which candidates to accept before anything is saved.';

const candidateWithExcerpt = (textProperties) => ({
  type: 'object',
  properties: { ...textProperties, source_excerpt: { type: 'string', description: 'A short verbatim quote from the document that grounds this candidate.' } }
});

const DOCUMENT_EXTRACTION_PARAMETERS = {
  type: 'object',
  properties: {
    best_life_elements: {
      type: 'array',
      description: 'Things that make this person\'s life meaningful, if the document mentions any.',
      items: candidateWithExcerpt({ text: { type: 'string' } })
    },
    concerns: {
      type: 'array',
      description: 'Simple concern statements suitable for the About Me profile\'s concerns list.',
      items: candidateWithExcerpt({ text: { type: 'string' } })
    },
    confidence_level: {
      type: ['object', 'null'],
      description: 'Only set if the document states or clearly implies an overall confidence/self-efficacy level.',
      properties: {
        value: { type: 'string', enum: ['Very confident', 'Somewhat confident', 'Not very confident'] },
        source_excerpt: { type: 'string' }
      }
    },
    values: {
      type: 'array',
      description: 'Personal values, for the values table (value_text + importance).',
      items: candidateWithExcerpt({
        value_text: { type: 'string' },
        importance: { type: 'string', enum: ['high', 'medium', 'low'] }
      })
    },
    concerns_detailed: {
      type: 'array',
      description: 'Richer concern entries for the concerns table (concern + severity + context), distinct from the simpler best_life_elements-style concerns above.',
      items: candidateWithExcerpt({
        concern: { type: 'string' },
        severity: { type: 'string', enum: ['mild', 'moderate', 'severe'] },
        context: { type: 'string' }
      })
    },
    education_topics: {
      type: 'array',
      description: 'Topics the person may want to learn more about, for the education_topics table.',
      items: candidateWithExcerpt({
        topic: { type: 'string' },
        engagement: { type: 'string', enum: ['low', 'moderate', 'high'] }
      })
    },
    goals: {
      type: 'array',
      description: 'Goals stated or clearly implied in the document. Confidence is left for the person to set/confirm during review -- do not guess one.',
      items: candidateWithExcerpt({ goal: { type: 'string' } })
    }
  }
};

module.exports = { DOCUMENT_EXTRACTION_TOOL_NAME, DOCUMENT_EXTRACTION_TOOL_DESCRIPTION, DOCUMENT_EXTRACTION_PARAMETERS };
