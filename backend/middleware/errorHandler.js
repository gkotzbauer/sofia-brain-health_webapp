const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Log error to database
    if (req.db) {
        req.db.query(`
            INSERT INTO audit_log (user_id, action, resource_type, metadata)
            VALUES ($1, 'error', 'system', $2)
        `, [
            req.user?.id || null,
            {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString()
            }
        ]).catch(console.error);
    }
    
    // Send appropriate error response
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    
    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;
