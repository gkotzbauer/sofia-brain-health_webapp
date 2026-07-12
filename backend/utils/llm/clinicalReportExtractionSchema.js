// Structured-output definition for extracting candidate structured data from
// a clinician-authored document (e.g. a post-diagnostic letter, clinic
// summary, or care-plan review) -- distinct from documentExtractionSchema.js,
// which extracts self-reported wellness fields (best-life elements,
// concerns, values, goals). This schema is for content a clinician wrote,
// not content Sofia infers about the person -- every field it can hold is
// something the document explicitly states, grounded in a source_excerpt,
// never invented, and always human-reviewed before being saved (see
// routes/documents.js POST /:documentId/extract-clinical-report and
// POST /:documentId/apply-clinical-report).
//
// `diagnosis.stated_diagnosis` is named deliberately, not `diagnosis` --
// every layer downstream (this schema, the review UI, Sofia's system
// prompt) must stay unambiguous that this is a quote of what a clinician
// documented, never Sofia's own clinical judgment. Sofia never diagnoses;
// see utils/systemPrompt.js "Clinical boundaries".
//
// Test/assessment results and care-plan items are intentionally free-form
// arrays (test_name/score/category as plain strings) rather than a fixed
// enum or named-key object -- this schema needs to work across whatever
// battery or format a given clinic uses, not just the one sample letter it
// was designed against.
const CLINICAL_REPORT_EXTRACTION_TOOL_NAME = 'sofia_clinical_report_extraction';

const CLINICAL_REPORT_EXTRACTION_TOOL_DESCRIPTION =
  'Candidate structured data extracted from a clinician-authored document (e.g. a post-diagnostic letter or care-plan review), each fact grounded in a short excerpt -- never invented or inferred beyond what the document states. The person reviews and chooses what to accept before anything is saved.';

const withExcerpt = (textProperties) => ({
  type: 'object',
  properties: { ...textProperties, source_excerpt: { type: 'string', description: 'A short verbatim quote from the document that grounds this fact.' } }
});

const CLINICAL_REPORT_EXTRACTION_PARAMETERS = {
  type: 'object',
  properties: {
    document_type: {
      type: ['string', 'null'],
      description: 'Best guess at what kind of clinical document this is, if evident.',
      enum: ['post_diagnostic_report', 'clinic_letter', 'assessment_summary', 'care_plan_review', 'other', null]
    },
    assessment_info: {
      type: ['object', 'null'],
      description: 'When and by whom the underlying assessment/visit happened.',
      properties: {
        assessment_date: { type: ['string', 'null'], description: 'Date of the actual assessment/visit, if stated (free text, e.g. "19/Nov/2024").' },
        report_date: { type: ['string', 'null'], description: 'Date the report/letter itself was written, if different from the assessment date.' },
        clinicians: {
          type: 'array',
          description: 'Clinicians named as involved in the assessment.',
          items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } } }
        },
        clinic_name: { type: ['string', 'null'] }
      }
    },
    diagnosis: {
      type: ['object', 'null'],
      description: "The clinician's own stated diagnosis -- never Sofia's inference. Only set if the document explicitly states a diagnosis.",
      properties: {
        stated_diagnosis: { type: 'string', description: 'The diagnosis exactly as the clinician wrote it, e.g. "Mild Cognitive Impairment (MCI)".' },
        icd_or_read_code: { type: ['string', 'null'] },
        status: {
          type: ['string', 'null'],
          enum: ['confirmed', 'provisional', 'unchanged', 'changed', 'ruled_out', 'pending_further_investigation', null]
        },
        source_excerpt: { type: 'string' }
      }
    },
    patient_background: {
      type: ['object', 'null'],
      description: "Historical/contextual information about the person's situation, as described in the document.",
      properties: {
        symptom_duration: { type: ['string', 'null'] },
        previous_occupation: { type: ['string', 'null'] },
        employment_status: { type: ['string', 'null'] },
        family_history: {
          type: ['object', 'null'],
          properties: { father: { type: ['string', 'null'] }, mother: { type: ['string', 'null'] }, other: { type: ['string', 'null'] } }
        },
        caregiving_history: { type: ['string', 'null'] },
        source_excerpt: { type: 'string' }
      }
    },
    current_symptoms: {
      type: ['object', 'null'],
      description: 'Symptoms and functional challenges described in the document, grouped by category.',
      properties: {
        cognitive: { type: 'array', items: withExcerpt({ text: { type: 'string' } }) },
        physical: { type: 'array', items: withExcerpt({ text: { type: 'string' } }) },
        sleep: { type: 'array', items: withExcerpt({ text: { type: 'string' } }) },
        mood_or_behavioral: { type: 'array', items: withExcerpt({ text: { type: 'string' } }) }
      }
    },
    assessment_results: {
      type: 'array',
      description: 'Any named test/scale results in the document (e.g. SMMSE, ACE-III, HADS, or any other clinic\'s battery) -- free-form so it generalizes across clinics rather than assuming one specific set of tests.',
      items: withExcerpt({
        test_name: { type: 'string' },
        score: { type: 'string' },
        subscores: {
          type: 'array',
          items: { type: 'object', properties: { domain: { type: 'string' }, score: { type: 'string' } } }
        },
        interpretation: { type: ['string', 'null'] },
        date: { type: ['string', 'null'] }
      })
    },
    imaging_or_labs: {
      type: 'array',
      description: 'Imaging, lab, or other diagnostic procedure results or mentions (including declined/planned procedures).',
      items: withExcerpt({ type: { type: 'string' }, date: { type: ['string', 'null'] }, findings: { type: 'string' } })
    },
    clinical_observations: {
      type: 'array',
      description: "Clinician's direct observations from the assessment (e.g. presentation on the day, insight, affect).",
      items: withExcerpt({ text: { type: 'string' } })
    },
    safety_risk_notes: {
      type: ['object', 'null'],
      description: "The clinician's own safety/risk assessment, if the document includes one -- distinct from and additional to Sofia's own ongoing safety monitoring, never a replacement for it.",
      properties: {
        concerns_identified: { type: 'boolean' },
        details: { type: ['string', 'null'] },
        source_excerpt: { type: 'string' }
      }
    },
    care_plan: {
      type: 'array',
      description: 'Planned next steps for the person\'s care, as stated in the document.',
      items: withExcerpt({
        item: { type: 'string' },
        category: { type: ['string', 'null'], enum: ['monitoring', 'referral', 'lifestyle', 'research_participation', 'follow_up', 'other', null] },
        target_date: { type: ['string', 'null'] }
      })
    },
    next_review: {
      type: ['object', 'null'],
      description: 'When/how the person will next be reviewed by this clinician or team, if stated.',
      properties: { date: { type: ['string', 'null'] }, details: { type: ['string', 'null'] } }
    },
    support_resources: {
      type: 'array',
      description: 'External support organizations, helplines, or publications the document points the person toward.',
      items: withExcerpt({
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        website: { type: ['string', 'null'] }
      })
    }
  }
};

module.exports = {
  CLINICAL_REPORT_EXTRACTION_TOOL_NAME,
  CLINICAL_REPORT_EXTRACTION_TOOL_DESCRIPTION,
  CLINICAL_REPORT_EXTRACTION_PARAMETERS
};
