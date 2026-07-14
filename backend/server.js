const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const winston = require('winston');
require('dotenv').config();

// Fail closed: refuse to start rather than silently run with an insecure
// default secret or with PHI encryption disabled.
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'ENCRYPTION_KEY'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { auditLog, auditMiddleware } = require('./middleware/audit');
const errorHandler = require('./middleware/errorHandler').errorHandler;

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const chatRoutes = require('./routes/chat');
const documentRoutes = require('./routes/documents');
const safetyRoutes = require('./routes/safety');
const feedbackRoutes = require('./routes/feedback');
const goalRoutes = require('./routes/goals');
const chapterRoutes = require('./routes/chapters');
const valueRoutes = require('./routes/values');
const concernRoutes = require('./routes/concerns');
const educationTopicRoutes = require('./routes/educationTopics');
const adminRoutes = require('./routes/admin');
const studySurveyRoutes = require('./routes/studySurvey');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Initialize PostgreSQL connection (only if DATABASE_URL is provided)
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Managed Postgres on providers like Render is reached over their own
    // private network and commonly presents a self-signed certificate for
    // that internal connection -- rejectUnauthorized: true fails outright
    // there (DEPTH_ZERO_SELF_SIGNED_CERT), even though the connection is
    // still encrypted. Default to false (matches Render); set
    // DB_SSL_REJECT_UNAUTHORIZED=true if hosting somewhere with a properly
    // CA-signed DB certificate and real MITM protection is wanted.
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } : false
  });

  // Pool error handling -- fires on background/idle-client errors, not on
  // every failed query (those are handled per-request by each route's own
  // try/catch). A hard exit here is appropriate: an idle-client error
  // usually means the pool itself is in a bad state.
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  // Log connectivity at startup for operator visibility -- but do NOT null
  // out `pool` on failure. This used to permanently disable the database
  // for the life of the process if this one-shot test connection failed
  // for any reason, including a purely transient one (e.g. the database
  // still coming up when this process starts) -- turning every future
  // request into a 500 with no recovery, even after the database became
  // reachable seconds later. pg's Pool already acquires a connection fresh
  // per query and handles retries/errors at that level; there's no need to
  // gate all future queries behind whether this one test connection
  // happened to succeed.
  pool.connect((err, client, done) => {
    if (err) {
      console.error('Initial database connectivity check failed (queries will still be retried per-request):', err.stack);
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
      auth: '/api/auth/register, /api/auth/login',
      users: '/api/users/*',
      sessions: '/api/sessions/*',
      chat: '/api/chat',
      documents: '/api/documents/*',
      safety: '/api/safety-events/*',
      feedback: '/api/feedback/*',
      goals: '/api/goals/*',
      chapters: '/api/story-chapters/*',
      values: '/api/values/*',
      concerns: '/api/concerns/*',
      educationTopics: '/api/education-topics/*',
      admin: '/api/admin/*'
    },
    documentation: 'This is a backend API server. Use the endpoints above to interact with the Sofia Brain Health Companion application.'
  });
});

// API Routes
app.use('/api', authRoutes); // Unauthenticated auth routes (register/login)
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/sessions', authenticateToken, sessionRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/documents', authenticateToken, auditMiddleware('document_management'), documentRoutes);
app.use('/api/safety-events', authenticateToken, safetyRoutes);
app.use('/api/feedback', authenticateToken, feedbackRoutes);
app.use('/api/goals', authenticateToken, goalRoutes);
app.use('/api/story-chapters', authenticateToken, chapterRoutes);
app.use('/api/values', authenticateToken, valueRoutes);
app.use('/api/concerns', authenticateToken, concernRoutes);
app.use('/api/education-topics', authenticateToken, educationTopicRoutes);
app.use('/api/admin', authenticateToken, adminRoutes); // Admin/clinician routes (role-checked per-route)
app.use('/api/study-survey', authenticateToken, studySurveyRoutes);

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
