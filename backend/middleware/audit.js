// Audit logging function
const auditLog = async function(userId, action, resourceType, resourceId, req) {
  try {
    await req.pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        resourceType,
        resourceId,
        req.ip,
        req.get('user-agent'),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );
  } catch (error) {
    req.logger.error('Audit log error:', error);
  }
};

// Middleware factory function
const auditMiddleware = (actionType) => {
  return (req, res, next) => {
    // Store the original json method
    const originalJson = res.json;
    
    // Override res.json to log after successful response
    res.json = function(data) {
      // Log audit entry asynchronously
      setImmediate(async () => {
        try {
          await req.pool.query(
            `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              req.user?.userId || null,
              actionType,
              req.method + ' ' + req.path,
              req.params.id || null,
              req.ip,
              req.get('user-agent'),
              JSON.stringify({ 
                timestamp: new Date().toISOString(),
                method: req.method,
                path: req.path
              })
            ]
          );
        } catch (error) {
          req.logger.error('Audit middleware logging error:', error);
        }
      });
      
      // Call the original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

module.exports = { auditLog, auditMiddleware };
