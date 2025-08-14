const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const winston = require('winston');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
require('dotenv').config();

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { auditLog, auditMiddleware } = require('./middleware/audit');
const errorHandler = require('./middleware/errorHandler').errorHandler;

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const documentRoutes = require('./routes/documents');
const safetyRoutes = require('./routes/safety');
const feedbackRoutes = require('./routes/feedback');
const goalRoutes = require('./routes/goals');
const chapterRoutes = require('./routes/chapters');
const adminRoutes = require('./routes/admin');



// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

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
        file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, text, and JSON files are allowed'));
    }
  }
});

// Initialize PostgreSQL connection (only if DATABASE_URL is provided)
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Pool error handling
  pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  // Test database connection
  pool.connect((err, client, done) => {
    if (err) {
      console.error('Database connection error:', err.stack);
      console.log('Running in test mode without database...');
      pool = null; // Clear the failed pool
    } else {
      console.log('Database connected successfully');
      done();
    }
  });
} else {
  console.log('No DATABASE_URL provided - running in test mode without database');
}

// Initialize Winston logger for HIPAA compliance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Make pool and logger available to routes
app.locals.pool = pool;
app.locals.logger = logger;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve uploaded files (for development/testing)
app.use('/uploads', express.static('uploads'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Attach pool, logger, and auditLog to request
app.use((req, res, next) => {
  req.pool = pool;
  req.logger = logger;
  req.auditLog = auditLog;
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    message: 'Sofia Brain Health Companion API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/users/auth',
      users: '/api/users/*',
      sessions: '/api/sessions/*',
      documents: '/api/document-uploads/*',
      safety: '/api/safety-events/*',
      feedback: '/api/feedback/*',
      goals: '/api/goals/*',
      chapters: '/api/story-chapters/*',
      admin: '/api/admin/*',
      documents: '/api/documents/*'
    },
    documentation: 'This is a backend API server. Use the endpoints above to interact with the Sofia Brain Health Companion application.'
  });
});

// API Routes
app.use('/api', authRoutes); // Unauthenticated auth routes
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/sessions', authenticateToken, sessionRoutes);
app.use('/api/document-uploads', authenticateToken, auditMiddleware('document_upload'), documentRoutes);
app.use('/api/profile-history', authenticateToken, auditMiddleware('profile_change'), documentRoutes);
app.use('/api/safety-events', authenticateToken, safetyRoutes);
app.use('/api/feedback', authenticateToken, feedbackRoutes);
app.use('/api/goals', authenticateToken, goalRoutes);
app.use('/api/story-chapters', authenticateToken, chapterRoutes);
app.use('/api/admin', authenticateToken, adminRoutes); // Admin routes

// Document routes with authentication and audit logging
app.use('/api/documents', authenticateToken, auditMiddleware('document_management'), documentRoutes);

// Add document upload endpoint for provider uploads (no auth required for testing)
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
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

    // Store document for this user (in production this would go to database)
    // For now, we'll store it in a simple file-based system
    const userDocumentsPath = path.join(__dirname, 'uploads', 'user-documents.json');
    let userDocuments = {};
    
    try {
      if (fs.existsSync(userDocumentsPath)) {
        userDocuments = JSON.parse(fs.readFileSync(userDocumentsPath, 'utf8'));
      }
    } catch (error) {
      console.log('Starting fresh user documents file');
    }
    
    if (!userDocuments[userId]) {
      userDocuments[userId] = [];
    }
    
    userDocuments[userId].push(document);
    
    // Save to file
    fs.writeFileSync(userDocumentsPath, JSON.stringify(userDocuments, null, 2));

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

    // Save notification to file
    const notificationsPath = path.join(__dirname, 'uploads', 'user-notifications.json');
    let notifications = {};
    
    try {
      if (fs.existsSync(notificationsPath)) {
        notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      }
    } catch (error) {
      console.log('Starting fresh notifications file');
    }
    
    if (!notifications[userId]) {
      notifications[userId] = [];
    }
    
    notifications[userId].push(notification);
    
    // Save to file
    fs.writeFileSync(notificationsPath, JSON.stringify(notifications, null, 2));

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

// Get pending document notifications for user
app.get('/api/documents/notifications/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const notificationsPath = path.join(__dirname, 'uploads', 'user-notifications.json');
    
    if (!fs.existsSync(notificationsPath)) {
      return res.json([]);
    }
    
    const notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
    const userNotifications = notifications[userId] || [];
    const pendingNotifications = userNotifications.filter(n => !n.isDelivered);
    
    res.json(pendingNotifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get document content by ID
app.get('/api/documents/content/:documentId', (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.query.userId || 'test-user-123';
    const userDocumentsPath = path.join(__dirname, 'uploads', 'user-documents.json');
    
    if (!fs.existsSync(userDocumentsPath)) {
      return res.status(404).json({ error: 'No documents found' });
    }
    
    const userDocuments = JSON.parse(fs.readFileSync(userDocumentsPath, 'utf8'));
    const userDocs = userDocuments[userId] || [];
    const document = userDocs.find(d => d.id === documentId);
    
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
  } catch (error) {
    console.error('Error getting document content:', error);
    res.status(500).json({ error: 'Failed to get document content' });
  }
});

// Mark notification as delivered
app.put('/api/documents/notifications/:notificationId/delivered', (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.query.userId || 'test-user-123';
    const notificationsPath = path.join(__dirname, 'uploads', 'user-notifications.json');
    
    if (!fs.existsSync(notificationsPath)) {
      return res.status(404).json({ error: 'No notifications found' });
    }
    
    const notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
    const userNotifications = notifications[userId] || [];
    const notification = userNotifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    notification.isDelivered = true;
    notification.deliveredAt = new Date().toISOString();
    
    // Save updated notifications
    fs.writeFileSync(notificationsPath, JSON.stringify(notifications, null, 2));
    
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification delivered:', error);
    res.status(500).json({ error: 'Failed to mark notification delivered' });
  }
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    if (pool) {
      pool.end(() => {
        logger.info('Database pool closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Sofia API server running on port ${PORT}`);
});

module.exports = app;
