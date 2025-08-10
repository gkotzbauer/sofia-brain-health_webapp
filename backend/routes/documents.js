const express = require('express');
const router = express.Router();

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

module.exports = router;
