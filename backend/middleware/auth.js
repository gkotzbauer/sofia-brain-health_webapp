const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const token = authHeader.substring(7);
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            
            // Get user from database
            const result = await req.db.query(
                'SELECT id, name, age FROM users WHERE id = $1 AND is_active = true',
                [decoded.userId]
            );
            
            if (result.rowCount === 0) {
                return res.status(401).json({ error: 'User not found' });
            }
            
            req.user = result.rows[0];
            next();
        } catch (jwtError) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    } catch (error) {
        next(error);
    }
};

module.exports = authMiddleware;
