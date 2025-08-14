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

// Simple in-memory storage for testing (in production this would be a database)
const documentStore = new Map();
const notificationStore = new Map();

// Helper function to get user documents
function getUserDocuments(userId) {
  if (!documentStore.has(userId)) {
    documentStore.set(userId, []);
  }
  return documentStore.get(userId);
}

// Helper function to get user notifications
function getUserNotifications(userId) {
  if (!notificationStore.has(userId)) {
    notificationStore.set(userId, []);
  }
  return notificationStore.get(userId);
}

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Document management API is working!',
    timestamp: new Date().toISOString(),
    status: 'ready',
    documentCount: documentStore.size,
    notificationCount: notificationStore.size
  });
});

// Upload and process a new document
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    // For testing, use a default user ID (in production this would come from auth)
    const userId = req.query.userId || 'test-user-123';
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, mimetype, size, path: filePath } = req.file;
    
    console.log('📄 Processing file for user:', userId, { filename, mimetype, size, filePath });
    
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

    // Create document object
    const document = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: filename,
      file_type: mimetype,
      file_size: size,
      upload_timestamp: new Date().toISOString(),
      extracted_count: extractedText.length > 0 ? 1 : 0,
      metadata: {
        originalName: req.file.originalname,
        filePath: filePath,
        documentType: documentType,
        extractedText: extractedText,
        uploadTimestamp: new Date().toISOString()
      }
    };

    // Store document for this user
    const userDocuments = getUserDocuments(userId);
    userDocuments.push(document);
    documentStore.set(userId, userDocuments);

    // Create notification for this user
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId: document.id,
      timestamp: new Date().toISOString(),
      isRead: false,
      isDelivered: false,
      message: `Your provider has uploaded a new document: ${filename}`,
      userId: userId
    };

    const userNotifications = getUserNotifications(userId);
    userNotifications.push(notification);
    notificationStore.set(userId, userNotifications);

    console.log('✅ Document stored for user:', userId);
    console.log('🔔 Notification created for user:', userId);
    
    res.json({
      success: true,
      document: document,
      notification: notification,
      extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
      message: `Document uploaded and processed successfully. ${extractedText.length} characters extracted.`,
      documentType: documentType
    });

  } catch (error) {
    console.error('❌ Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload and process document: ' + error.message });
  }
});

// Get document content by ID
router.get('/content/:documentId', (req, res) => {
  const { documentId } = req.params;
  const userId = req.query.userId || 'test-user-123';
  
  const userDocuments = getUserDocuments(userId);
  const document = userDocuments.find(d => d.id === documentId);
  
  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }
  
  res.json({
    id: document.id,
    filename: document.filename,
    fileType: document.file_type,
    uploadTimestamp: document.upload_timestamp,
    extractedText: document.metadata?.extractedText || '',
    documentType: document.metadata?.documentType || 'unknown',
    fileSize: document.file_size
  });
});

// Get pending document notifications for user
router.get('/notifications/:userId', (req, res) => {
  const { userId } = req.params;
  
  const userNotifications = getUserNotifications(userId);
  const pendingNotifications = userNotifications.filter(n => !n.isDelivered);
  
  res.json(pendingNotifications);
});

// Mark document notification as delivered
router.put('/notifications/:notificationId/delivered', (req, res) => {
  const { notificationId } = req.params;
  const userId = req.query.userId || 'test-user-123';
  
  const userNotifications = getUserNotifications(userId);
  const notification = userNotifications.find(n => n.id === notificationId);
  
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  notification.isDelivered = true;
  notification.deliveredAt = new Date().toISOString();
  
  res.json(notification);
});

// Get all documents for a user
router.get('/user/:userId', (req, res) => {
  const { userId } = req.params;
  
  const userDocuments = getUserDocuments(userId);
  res.json(userDocuments);
});

// List all stored data (for debugging)
router.get('/debug', (req, res) => {
  res.json({
    documentStore: Object.fromEntries(documentStore),
    notificationStore: Object.fromEntries(notificationStore),
    totalDocuments: Array.from(documentStore.values()).flat().length,
    totalNotifications: Array.from(notificationStore.values()).flat().length
  });
});

module.exports = router;
