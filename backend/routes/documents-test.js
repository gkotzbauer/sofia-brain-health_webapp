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

// Test endpoint - no authentication required
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Document management API is working!',
    timestamp: new Date().toISOString(),
    status: 'ready'
  });
});

// Upload and process a new document (test mode - no auth)
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, mimetype, size, path: filePath } = req.file;
    
    console.log('📄 Processing file:', { filename, mimetype, size, filePath });
    
    // Process document content based on type
    let extractedText = '';
    let documentType = 'unknown';
    
    if (mimetype === 'application/pdf') {
      try {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
        documentType = 'pdf';
        console.log('✅ PDF processed successfully, extracted', extractedText.length, 'characters');
      } catch (error) {
        console.error('❌ PDF processing error:', error);
        extractedText = 'PDF processing failed: ' + error.message;
      }
    } else if (mimetype.includes('text') || mimetype === 'application/json') {
      try {
        extractedText = await fs.readFile(filePath, 'utf8');
        documentType = mimetype === 'application/json' ? 'json' : 'text';
        console.log('✅ Text file processed successfully, extracted', extractedText.length, 'characters');
      } catch (error) {
        console.error('❌ Text file processing error:', error);
        extractedText = 'Text processing failed: ' + error.message;
      }
    }

    // Create mock document response (no database)
    const mockDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: filename,
      file_type: mimetype,
      file_size: size,
      upload_timestamp: new Date().toISOString(),
      extracted_count: extractedText.length > 0 ? 1 : 0
    };

    // Create mock notification
    const mockNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: `New document uploaded: ${filename}`
    };

    console.log('✅ Document processed successfully');
    
    res.json({
      success: true,
      document: mockDocument,
      notification: mockNotification,
      extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
      message: `Document uploaded and processed successfully. ${extractedText.length} characters extracted.`,
      documentType: documentType
    });

  } catch (error) {
    console.error('❌ Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload and process document: ' + error.message });
  }
});

// Get document content by ID (test mode - returns mock data)
router.get('/content/:documentId', (req, res) => {
  const { documentId } = req.params;
  
  // For testing, return mock document data
  res.json({
    id: documentId,
    filename: 'Test Document.pdf',
    fileType: 'application/pdf',
    uploadTimestamp: new Date().toISOString(),
    extractedText: 'This is test document content for testing purposes.',
    documentType: 'pdf',
    fileSize: 1024
  });
});

// Test endpoint to list uploaded files
router.get('/files', async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const files = await fs.readdir(uploadsDir);
    
    const fileList = [];
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = await fs.stat(filePath);
      fileList.push({
        name: file,
        size: stats.size,
        modified: stats.mtime,
        path: filePath
      });
    }
    
    res.json({
      uploadsDirectory: uploadsDir,
      fileCount: files.length,
      files: fileList
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files: ' + error.message });
  }
});

module.exports = router;
