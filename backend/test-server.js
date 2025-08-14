const express = require('express');
const app = express();
const PORT = 10001;

// Simple middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/api/documents/test', (req, res) => {
  res.json({ 
    message: 'Document management API is working!',
    timestamp: new Date().toISOString(),
    status: 'ready'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Test server running on port ' + PORT });
});

// Start server
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Test the API: curl http://localhost:10001/api/documents/test');
});
