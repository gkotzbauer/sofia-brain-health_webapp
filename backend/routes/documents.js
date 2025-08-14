const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

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
    const userId = req.user.userId;
    const { filename, fileType, fileSize, extractedCount, metadata } = req.body;
    
    const result = await req.pool.query(
      `INSERT INTO document_uploads 
       (user_id, filename, file_type, file_size, extracted_count, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, filename, fileType, fileSize, extractedCount, JSON.stringify(metadata)]
    );
    
    await req.auditLog(userId, 'DOCUMENT_UPLOADED', 'document_uploads', result.rows[0].id, req);
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Document upload tracking error:', error);
    res.status(500).json({ error: 'Failed to track document upload' });
  }
});

// Update document processing status
router.put('/document-uploads/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { appliedCount } = req.body;
    
    const result = await req.pool.query(
      `UPDATE document_uploads 
       SET applied_count = $1, processed_timestamp = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [appliedCount, uploadId, req.user.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Document update error:', error);
    res.status(500).json({ error: 'Failed to update document status' });
  }
});

// Track profile variable changes
router.post('/profile-history', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { variableName, variableValue, previousValue, source, sourceDetails } = req.body;
    
    const result = await req.pool.query(
      `INSERT INTO profile_variable_history 
       (user_id, variable_name, variable_value, previous_value, source, source_details)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, variableName, variableValue, previousValue, source, JSON.stringify(sourceDetails)]
    );
    
    await req.auditLog(userId, 'PROFILE_VARIABLE_UPDATED', 'profile_variable_history', result.rows[0].id, req);
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Profile history tracking error:', error);
    res.status(500).json({ error: 'Failed to track profile change' });
  }
});

// Get profile variable history
router.get('/profile-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
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
    
    res.json(result.rows);
  } catch (error) {
    req.logger.error('Profile history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile history' });
  }
});

// Get document upload history
router.get('/document-uploads/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await req.pool.query(
      `SELECT * FROM document_uploads 
       WHERE user_id = $1 
       ORDER BY upload_timestamp DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    req.logger.error('Document uploads fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch document uploads' });
  }
});

// ============= NEW DOCUMENT MANAGEMENT ROUTES =============

// Upload and process a new document
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    const userId = req.user.userId;
    
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

    // Store document in database with content
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
        JSON.stringify({
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
        `New document uploaded: ${filename}`,
        'document',
        JSON.stringify({
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
      document: result.rows[0],
      notification: notificationResult.rows[0],
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
    const userId = req.user.userId;
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
    const metadata = document.metadata || {};
    
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

// Get pending document notifications for user
router.get('/notifications/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const result = await req.pool.query(
      `SELECT * FROM profile_variable_history 
       WHERE user_id = $1 
       AND variable_name = 'document_notification'
       AND is_active = true
       ORDER BY timestamp DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    req.logger.error('Document notifications fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch document notifications' });
  }
});

// Mark document notification as delivered
router.put('/notifications/:notificationId/delivered', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;
    
    const result = await req.pool.query(
      `UPDATE profile_variable_history 
       SET is_active = false, 
           source_details = COALESCE(source_details, '{}'::jsonb) || '{"delivered": true, "deliveredAt": $1}'::jsonb
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [new Date().toISOString(), notificationId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await req.auditLog(userId, 'NOTIFICATION_DELIVERED', 'profile_variable_history', notificationId, req);
    
    res.json(result.rows[0]);
  } catch (error) {
    req.logger.error('Notification delivery update error:', error);
    res.status(500).json({ error: 'Failed to update notification status' });
  }
});

// ============= END NEW DOCUMENT MANAGEMENT ROUTES =============

module.exports = router;
