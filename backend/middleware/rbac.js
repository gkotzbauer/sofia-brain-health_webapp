// Restricts a route to users whose req.user.role is one of the given roles.
// Must run after authenticateToken, which populates req.user.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireRole };
