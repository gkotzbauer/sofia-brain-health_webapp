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

module.exports = { auditLog };
