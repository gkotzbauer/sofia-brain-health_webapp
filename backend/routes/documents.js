const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const { encryptJSON, decryptJSON, encryptField, decryptField } = require('../utils/phiCrypto');
const llm = require('../utils/llm');
const {
  DOCUMENT_EXTRACTION_TOOL_NAME,
  DOCUMENT_EXTRACTION_TOOL_DESCRIPTION,
  DOCUMENT_EXTRACTION_PARAMETERS
} = require('../utils/llm/documentExtractionSchema');
const {
  CLINICAL_REPORT_EXTRACTION_TOOL_NAME,
  CLINICAL_REPORT_EXTRACTION_TOOL_DESCRIPTION,
  CLINICAL_REPORT_EXTRACTION_PARAMETERS
} = require('../utils/llm/clinicalReportExtractionSchema');
const { updateAboutMe } = require('./users');
const { createValue } = require('./values');
const { createConcern } = require('./concerns');
const { createEducationTopic } = require('./educationTopics');
const { createGoal } = require('./goals');

// How much of a document's extracted text gets sent to the LLM for
// candidate-field extraction -- larger than the 1500-char per-turn chat cap
// (utils/systemPrompt.js DOCUMENT_EXCERPT_CAP) since this is a one-off call,
// not spent on every conversational turn.
const EXTRACTION_TEXT_CAP = 4000;
// Clinician letters/reports (post-diagnostic summaries, care-plan reviews)
// routinely run several pages -- much longer than the self-reported
// wellness documents EXTRACTION_TEXT_CAP was sized for. Truncating away the
// diagnosis or care-plan section (which often appear later in the letter)
// would silently drop the most important content, so this gets its own,
// larger cap.
const CLINICAL_REPORT_TEXT_CAP = 12000;
// Below this, there's not enough text to meaningfully extract anything --
// skip the LLM call entirely rather than spend one on near-nothing.
const MIN_EXTRACTABLE_LENGTH = 50;

// Appends new string items to an existing array, skipping blanks and exact
// duplicates -- used to merge accepted document-extraction candidates into
// an existing About Me profile without ever discarding what was there.
function dedupeAppend(existing, incoming) {
  const merged = [...(existing || [])];
  for (const item of incoming || []) {
    const trimmed = typeof item === 'string' ? item.trim() : '';
    if (trimmed && !merged.includes(trimmed)) {
      merged.push(trimmed);
    }
  }
  return merged;
}

function decryptHistoryRow(row) {
  if (!row) return row;
  return {
    ...row,
    variable_value: decryptField(row.variable_value),
    previous_value: decryptField(row.previous_value),
    source_details: decryptJSON(row.source_details)
  };
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow PDF, text, and JSON files
    if (file.mimetype === 'application/pdf' ||
        file.mimetype.includes('text') ||
        file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, text, and JSON files are allowed'));
    }
  }
});

// Track document upload
router.post('/document-uploads', async (req, res) => {
  try {
    const userId = req.user.id;
    const { filename, fileType, fileSize, extractedCount, metadata } = req.body;

    const result = await req.pool.query(
      `INSERT INTO document_uploads
       (user_id, filename, file_type, file_size, extracted_count, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, filename, fileType, fileSize, extractedCount, encryptJSON(metadata)]
    );

    await req.auditLog(userId, 'DOCUMENT_UPLOADED', 'document_uploads', result.rows[0].id, req);

    res.json({ ...result.rows[0], metadata: decryptJSON(result.rows[0].metadata) });
  } catch (error) {
    req.logger.error('Document upload tracking error:', error);
    res.status(500).json({ error: 'Failed to track document upload' });
  }
});

// Update document processing status
router.put('/document-uploads/:uploadId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { uploadId } = req.params;
    const { appliedCount } = req.body;

    const result = await req.pool.query(
      `UPDATE document_uploads
       SET applied_count = $1, processed_timestamp = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [appliedCount, uploadId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document upload not found' });
    }

    res.json({ ...result.rows[0], metadata: decryptJSON(result.rows[0].metadata) });
  } catch (error) {
    req.logger.error('Document update error:', error);
    res.status(500).json({ error: 'Failed to update document status' });
  }
});

// Track profile variable changes
router.post('/profile-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { variableName, variableValue, previousValue, source, sourceDetails } = req.body;

    const result = await req.pool.query(
      `INSERT INTO profile_variable_history
       (user_id, variable_name, variable_value, previous_value, source, source_details)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, variableName, encryptField(variableValue), encryptField(previousValue), source, encryptJSON(sourceDetails)]
    );

    await req.auditLog(userId, 'PROFILE_VARIABLE_UPDATED', 'profile_variable_history', result.rows[0].id, req);

    res.json(decryptHistoryRow(result.rows[0]));
  } catch (error) {
    req.logger.error('Profile history tracking error:', error);
    res.status(500).json({ error: 'Failed to track profile change' });
  }
});

// Get profile variable history (for the authenticated user only -- this
// used to trust a client-supplied :userId path param, letting any
// authenticated user read any other user's profile-change history)
router.get('/profile-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { variableName, source, limit = 50 } = req.query;

    let query = `
      SELECT * FROM profile_variable_history
      WHERE user_id = $1
    `;
    const params = [userId];

    if (variableName) {
      query += ` AND variable_name = $${params.length + 1}`;
      params.push(variableName);
    }

    if (source) {
      query += ` AND source = $${params.length + 1}`;
      params.push(source);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await req.pool.query(query, params);

    await req.auditLog(userId, 'PROFILE_HISTORY_VIEWED', 'profile_variable_history', null, req);

    res.json(result.rows.map(decryptHistoryRow));
  } catch (error) {
    req.logger.error('Profile history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile history' });
  }
});

// Get document upload history (for the authenticated user only -- see the
// profile-history note above; same class of bug, same fix)
router.get('/document-uploads', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await req.pool.query(
      `SELECT * FROM document_uploads
       WHERE user_id = $1
       ORDER BY upload_timestamp DESC`,
      [userId]
    );

    res.json(result.rows.map((row) => ({ ...row, metadata: decryptJSON(row.metadata) })));
  } catch (error) {
    req.logger.error('Document uploads fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch document uploads' });
  }
});

// ============= NEW DOCUMENT MANAGEMENT ROUTES =============

// Upload and process a new document
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, mimetype, size, path: filePath } = req.file;

    // Process document content based on type
    let extractedText = '';
    let documentType = 'unknown';

    if (mimetype === 'application/pdf') {
      try {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
        documentType = 'pdf';
      } catch (error) {
        req.logger.error('PDF processing error:', error);
        extractedText = 'PDF processing failed';
      }
    } else if (mimetype.includes('text') || mimetype === 'application/json') {
      try {
        extractedText = await fs.readFile(filePath, 'utf8');
        documentType = mimetype === 'application/json' ? 'json' : 'text';
      } catch (error) {
        req.logger.error('Text file processing error:', error);
        extractedText = 'Text processing failed';
      }
    }

    // Store document in database with content (encrypted -- may contain PHI)
    const result = await req.pool.query(
      `INSERT INTO document_uploads
       (user_id, filename, file_type, file_size, extracted_count, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        userId,
        filename,
        mimetype,
        size,
        extractedText.length > 0 ? 1 : 0,
        encryptJSON({
          originalName: req.file.originalname,
          filePath: filePath,
          documentType: documentType,
          extractedText: extractedText,
          uploadTimestamp: new Date().toISOString()
        })
      ]
    );

    // Create notification for user
    const notificationResult = await req.pool.query(
      `INSERT INTO profile_variable_history
       (user_id, variable_name, variable_value, source, source_details)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        userId,
        'document_notification',
        encryptField(`New document uploaded: ${filename}`),
        'document',
        encryptJSON({
          documentId: result.rows[0].id,
          filename: filename,
          documentType: documentType,
          message: `Your provider has uploaded a new document: ${filename}`
        })
      ]
    );

    await req.auditLog(userId, 'DOCUMENT_UPLOADED', 'document_uploads', result.rows[0].id, req);

    res.json({
      success: true,
      document: { ...result.rows[0], metadata: decryptJSON(result.rows[0].metadata) },
      notification: decryptHistoryRow(notificationResult.rows[0]),
      extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
      message: `Document uploaded and processed successfully. ${extractedText.length} characters extracted.`
    });

  } catch (error) {
    req.logger.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload and process document' });
  }
});

// Get document content by ID
router.get('/content/:documentId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    const result = await req.pool.query(
      `SELECT * FROM document_uploads
       WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = result.rows[0];
    const metadata = decryptJSON(document.metadata) || {};

    res.json({
      id: document.id,
      filename: document.filename,
      fileType: document.file_type,
      uploadTimestamp: document.upload_timestamp,
      extractedText: metadata.extractedText || '',
      documentType: metadata.documentType || 'unknown',
      fileSize: document.file_size
    });

  } catch (error) {
    req.logger.error('Document content fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch document content' });
  }
});

// Extract candidate profile fields from a document the user has already
// uploaded (routes/documents.js POST /upload). A separate step from upload
// itself so a slow/failed LLM call never blocks the upload response, and so
// extraction can be retried without re-uploading. Never writes anything --
// returns raw candidates, each grounded in a source_excerpt, for the
// frontend's DocumentReviewModal to show the person before they choose what
// (if anything) to accept. See POST /:documentId/apply-extraction below for
// the write side of this human-in-the-loop flow.
router.post('/:documentId/extract', async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    const result = await req.pool.query(
      'SELECT * FROM document_uploads WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const metadata = decryptJSON(result.rows[0].metadata) || {};
    const extractedText = (metadata.extractedText || '').trim();

    if (extractedText.length < MIN_EXTRACTABLE_LENGTH) {
      return res.json({ documentId, candidates: {} });
    }

    if (!llm.isConfigured()) {
      return res.status(503).json({ error: 'The document extraction assistant is not configured on this server yet.' });
    }

    const systemText =
      "You are extracting structured profile candidates from a document (e.g. a clinician's after-visit summary or care plan) for an aging-adult cognitive-care app. Only propose fields you can ground in an explicit excerpt from the text below -- do not infer or invent. Leave a field/array empty if the document doesn't address it.";
    const userText = `--- "${result.rows[0].filename}" ---\n${extractedText.slice(0, EXTRACTION_TEXT_CAP)}`;

    const candidates = await llm.getProvider().generateStructuredExtraction({
      systemText,
      userText,
      toolName: DOCUMENT_EXTRACTION_TOOL_NAME,
      toolDescription: DOCUMENT_EXTRACTION_TOOL_DESCRIPTION,
      parameters: DOCUMENT_EXTRACTION_PARAMETERS
    });

    await req.auditLog(userId, 'DOCUMENT_EXTRACTED', 'document_uploads', documentId, req);

    res.json({ documentId, candidates });
  } catch (error) {
    req.logger.error('Document extraction error:', error);
    res.status(500).json({ error: 'Failed to extract candidates from document' });
  }
});

// Writes only the candidates the person accepted (and possibly edited) in
// the review modal -- every top-level field is optional, present only when
// accepted. Reuses the same insert/update functions the manual profile
// forms use (routes/users.js updateAboutMe, routes/values.js createValue,
// etc.) rather than duplicating storage logic, and tags every write's
// profile_variable_history row source:'document' so it's distinguishable
// from a self-entered edit (see profile_variable_history.source).
router.post('/:documentId/apply-extraction', async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;
    const { bestLifeElements, concerns, confidenceLevel, values, concernsDetailed, educationTopics, goals } = req.body;

    const docResult = await req.pool.query(
      'SELECT id FROM document_uploads WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const sourceDetails = { documentId, action: 'extraction_applied', timestamp: new Date().toISOString() };
    const applied = {};
    let appliedCount = 0;

    const hasAboutMeUpdate =
      (Array.isArray(bestLifeElements) && bestLifeElements.length > 0) ||
      (Array.isArray(concerns) && concerns.length > 0) ||
      Boolean(confidenceLevel);

    if (hasAboutMeUpdate) {
      const currentResult = await req.pool.query('SELECT * FROM about_me_profiles WHERE user_id = $1', [userId]);
      const current = currentResult.rows[0];
      const currentBestLifeElements = current ? decryptJSON(current.best_life_elements) || [] : [];
      const currentConcerns = current ? decryptJSON(current.concerns) || [] : [];

      const mergedBestLifeElements = dedupeAppend(currentBestLifeElements, bestLifeElements);
      const mergedConcerns = dedupeAppend(currentConcerns, concerns);
      const finalConfidenceLevel = confidenceLevel || current?.confidence_level || null;

      applied.aboutMe = await updateAboutMe(
        req.pool,
        userId,
        {
          bestLifeElements: mergedBestLifeElements,
          concerns: mergedConcerns,
          confidenceLevel: finalConfidenceLevel,
          userDefinedNextSteps: current?.user_defined_next_steps || []
        },
        { source: 'document', sourceDetails }
      );
      appliedCount += (bestLifeElements?.length || 0) + (concerns?.length || 0) + (confidenceLevel ? 1 : 0);
    }

    if (Array.isArray(values) && values.length) {
      applied.values = [];
      for (const item of values) {
        if (typeof item?.valueText !== 'string' || !item.valueText.trim()) continue;
        const created = await createValue(req.pool, userId, { valueText: item.valueText, importance: item.importance });
        await req.pool.query(
          `INSERT INTO profile_variable_history (user_id, variable_name, variable_value, source, source_details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'value', encryptField(item.valueText), 'document', encryptJSON(sourceDetails)]
        );
        applied.values.push(created);
        appliedCount += 1;
      }
    }

    if (Array.isArray(concernsDetailed) && concernsDetailed.length) {
      applied.concerns = [];
      for (const item of concernsDetailed) {
        if (typeof item?.concern !== 'string' || !item.concern.trim()) continue;
        const created = await createConcern(req.pool, userId, { concern: item.concern, severity: item.severity, context: item.context });
        await req.pool.query(
          `INSERT INTO profile_variable_history (user_id, variable_name, variable_value, source, source_details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'concern', encryptField(item.concern), 'document', encryptJSON(sourceDetails)]
        );
        applied.concerns.push(created);
        appliedCount += 1;
      }
    }

    if (Array.isArray(educationTopics) && educationTopics.length) {
      applied.educationTopics = [];
      for (const item of educationTopics) {
        if (typeof item?.topic !== 'string' || !item.topic.trim()) continue;
        const created = await createEducationTopic(req.pool, userId, { topic: item.topic, engagement: item.engagement });
        await req.pool.query(
          `INSERT INTO profile_variable_history (user_id, variable_name, variable_value, source, source_details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'educationTopic', encryptField(item.topic), 'document', encryptJSON(sourceDetails)]
        );
        applied.educationTopics.push(created);
        appliedCount += 1;
      }
    }

    if (Array.isArray(goals) && goals.length) {
      applied.goals = [];
      for (const item of goals) {
        // Preserves the conversational confidence-gate's spirit (see
        // utils/systemPrompt.js "Goals") even for a document-derived goal --
        // the review UI requires the person to set a confidence value
        // before a goal candidate can be accepted, so one is always
        // expected here.
        if (typeof item?.goal !== 'string' || !item.goal.trim() || typeof item.confidence !== 'number') continue;
        const created = await createGoal(req.pool, userId, { goal: item.goal, confidence: item.confidence, linkedBestLifeElements: null });
        await req.pool.query(
          `INSERT INTO profile_variable_history (user_id, variable_name, variable_value, source, source_details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'goal', encryptField(item.goal), 'document', encryptJSON(sourceDetails)]
        );
        applied.goals.push(created);
        appliedCount += 1;
      }
    }

    await req.pool.query(
      `UPDATE document_uploads SET applied_count = $1, processed_timestamp = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [appliedCount, documentId, userId]
    );

    await req.auditLog(userId, 'DOCUMENT_EXTRACTION_APPLIED', 'document_uploads', documentId, req);

    res.json({ appliedCount, applied });
  } catch (error) {
    req.logger.error('Document extraction apply error:', error);
    res.status(500).json({ error: 'Failed to apply document extraction' });
  }
});

// Best-effort parse of a free-text date (clinician letters write dates like
// "19/Nov/2024") into a SQL-safe DATE value. Returns null rather than
// throwing on anything unparseable -- the original text is never lost
// either way, since it stays inside the encrypted report_data blob
// regardless of whether this plain, sortable column could be populated.
function parseReportDate(value) {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

// Extract candidate structured data from a clinician-authored document
// (e.g. a post-diagnostic letter or care-plan review) -- the clinical
// counterpart to POST /:documentId/extract above. Same never-write,
// candidates-only contract: every fact is grounded in a source_excerpt, and
// nothing is saved until the person reviews it via
// POST /:documentId/apply-clinical-report. Kept as a fully separate
// endpoint/schema from the wellness extraction above rather than folded in,
// since clinical facts (a stated diagnosis, care plan) are a categorically
// different -- and higher-stakes -- kind of data than self-reported
// wellness fields.
router.post('/:documentId/extract-clinical-report', async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    const result = await req.pool.query(
      'SELECT * FROM document_uploads WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const metadata = decryptJSON(result.rows[0].metadata) || {};
    const extractedText = (metadata.extractedText || '').trim();

    if (extractedText.length < MIN_EXTRACTABLE_LENGTH) {
      return res.json({ documentId, candidates: {} });
    }

    if (!llm.isConfigured()) {
      return res.status(503).json({ error: 'The document extraction assistant is not configured on this server yet.' });
    }

    const systemText =
      "You are extracting structured clinical data from a document a clinician wrote or ordered for an aging-adult cognitive-care app -- this may be a post-diagnostic letter, care-plan review, or a scored cognitive-screening report (e.g. BrainCheck Assess) with per-domain scores, percentiles, and functional correlates. Only extract facts you can ground in an explicit excerpt from the text below -- never infer, guess, or add your own clinical opinion. Leave a field/array empty or null if the document doesn't address it. The diagnosis field must quote what the clinician wrote, verbatim in meaning -- do not soften, hedge, or reinterpret it. A screening device's combined/composite score and impression belong in cognitive_screening_summary, never in diagnosis -- a screening report explicitly is not a diagnosis, even when it strongly implies impairment. If reason_for_testing suggests a safety-relevant history (e.g. abuse, self-harm), also populate safety_risk_notes -- don't leave that signal only in reason_for_testing.";
    const userText = `--- "${result.rows[0].filename}" ---\n${extractedText.slice(0, CLINICAL_REPORT_TEXT_CAP)}`;

    const candidates = await llm.getProvider().generateStructuredExtraction({
      systemText,
      userText,
      toolName: CLINICAL_REPORT_EXTRACTION_TOOL_NAME,
      toolDescription: CLINICAL_REPORT_EXTRACTION_TOOL_DESCRIPTION,
      parameters: CLINICAL_REPORT_EXTRACTION_PARAMETERS
    });

    await req.auditLog(userId, 'CLINICAL_REPORT_EXTRACTED', 'document_uploads', documentId, req);

    res.json({ documentId, candidates });
  } catch (error) {
    req.logger.error('Clinical report extraction error:', error);
    res.status(500).json({ error: 'Failed to extract clinical report from document' });
  }
});

// Saves the clinical report exactly as the person reviewed/edited it in the
// review modal -- the whole reviewed object is stored as one row (encrypted
// wholesale, like the extraction candidates it came from) rather than
// merged field-by-field into other tables, since this is a self-contained
// report as of a point in time, not a set of independent profile facts.
router.post('/:documentId/apply-clinical-report', async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;
    const reportData = req.body?.report;

    if (!reportData || typeof reportData !== 'object') {
      return res.status(400).json({ error: 'A report object is required' });
    }

    const docResult = await req.pool.query(
      'SELECT id FROM document_uploads WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const reportDate = parseReportDate(reportData.assessment_info?.report_date);
    const assessmentDate = parseReportDate(reportData.assessment_info?.assessment_date);

    const insertResult = await req.pool.query(
      `INSERT INTO clinical_reports (user_id, document_upload_id, report_date, assessment_date, report_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, report_date, assessment_date, applied_at`,
      [userId, documentId, reportDate, assessmentDate, encryptJSON(reportData)]
    );

    await req.pool.query(
      `UPDATE document_uploads SET applied_count = applied_count + 1, processed_timestamp = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    await req.auditLog(userId, 'CLINICAL_REPORT_APPLIED', 'clinical_reports', insertResult.rows[0].id, req);

    res.json({ clinicalReport: { ...insertResult.rows[0], report_data: reportData } });
  } catch (error) {
    req.logger.error('Clinical report apply error:', error);
    res.status(500).json({ error: 'Failed to save clinical report' });
  }
});

// Get pending document notifications for the authenticated user (same
// IDOR fix as above -- this used to trust a client-supplied :userId)
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await req.pool.query(
      `SELECT * FROM profile_variable_history
       WHERE user_id = $1
       AND variable_name = 'document_notification'
       AND is_active = true
       ORDER BY timestamp DESC`,
      [userId]
    );

    res.json(result.rows.map(decryptHistoryRow));
  } catch (error) {
    req.logger.error('Document notifications fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch document notifications' });
  }
});

// Mark document notification as delivered
router.put('/notifications/:notificationId/delivered', async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    // source_details is encrypted, so it can no longer be updated with an
    // in-SQL JSONB merge (`source_details || '{...}'::jsonb`) -- fetch,
    // decrypt, merge, re-encrypt, then write back as an ordinary column set.
    // (The prior JSONB-merge SQL also had a latent bug: `$1` was embedded
    // inside a quoted JSON string literal, so parameter substitution never
    // actually applied there -- the literal text "$1" was being stored
    // instead of the real timestamp.)
    const existing = await req.pool.query(
      'SELECT source_details FROM profile_variable_history WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    const mergedSourceDetails = {
      ...(decryptJSON(existing.rows[0].source_details) || {}),
      delivered: true,
      deliveredAt: new Date().toISOString()
    };

    const result = await req.pool.query(
      `UPDATE profile_variable_history
       SET is_active = false, source_details = $1
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [encryptJSON(mergedSourceDetails), notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await req.auditLog(userId, 'NOTIFICATION_DELIVERED', 'profile_variable_history', notificationId, req);

    res.json(decryptHistoryRow(result.rows[0]));
  } catch (error) {
    req.logger.error('Notification delivery update error:', error);
    res.status(500).json({ error: 'Failed to update notification status' });
  }
});

// ============= END NEW DOCUMENT MANAGEMENT ROUTES =============

module.exports = router;
