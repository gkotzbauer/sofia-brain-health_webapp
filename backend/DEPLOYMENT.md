# Deployment Guide

## Environment Variables Required

The following environment variables must be set for the server to run properly:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database_name

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=10000
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com
```

## Recent Fixes Applied

The following issues have been resolved to fix the deployment error:

1. **Fixed export mismatch in `middleware/auth.js`**: 
   - Changed from `module.exports = authMiddleware` to `module.exports = { authenticateToken }`
   - Renamed function from `authMiddleware` to `authenticateToken`

2. **Fixed export mismatch in `middleware/errorHandler.js`**:
   - Changed from `module.exports = errorHandler` to `module.exports = { errorHandler }`
   - Updated import in server.js accordingly

3. **Fixed database reference**:
   - Changed `req.db` to `req.pool` in error handler middleware

## Testing Locally

To test the server locally:

1. Install dependencies: `npm install`
2. Set up environment variables
3. Ensure PostgreSQL is running
4. Run: `npm start`

## Render Deployment

For Render deployment, ensure these environment variables are set in your Render service configuration. 