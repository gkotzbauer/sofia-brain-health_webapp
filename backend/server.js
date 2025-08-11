const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const documentRoutes = require('./routes/documents');
const safetyRoutes = require('./routes/safety');
const feedbackRoutes = require('./routes/feedback');
const goalsRoutes = require('./routes/goals');
const chaptersRoutes = require('./routes/chapters');

// Import middleware
const authMiddleware = require('./middleware/auth');
const auditMiddleware = require('./middleware/audit');
const errorHandler = require('./middleware/errorHandler');

// Create Express app
const app = express();

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected:', res.rows[0].now);
    }
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Attach database to request
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/sessions', authMiddleware, sessionRoutes);
app.use('/api/document-uploads', authMiddleware, auditMiddleware('document_upload'), documentRoutes);
app.use('/api/profile-history', authMiddleware, auditMiddleware('profile_change'), documentRoutes);
app.use('/api/safety-events', authMiddleware, safetyRoutes);
app.use('/api/feedback', authMiddleware, feedbackRoutes);
app.use('/api/goals', authMiddleware, goalsRoutes);
app.use('/api/story-chapters', authMiddleware, chaptersRoutes);

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Sofia API server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('Database pool closed');
            process.exit(0);
        });
    });
});
