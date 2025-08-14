const fs = require('fs');
const path = require('path');

// Simulate a provider uploading a document to a user's profile
async function simulateProviderUpload() {
  console.log('🏥 Simulating provider document upload...\n');
  
  // Check if the PDF exists in uploads folder
  const uploadsDir = path.join(__dirname, 'uploads');
  const pdfPath = path.join(uploadsDir, 'BHC Post-Diagnostic Summary Schema.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.log('❌ PDF file not found in uploads folder');
    console.log('Please ensure the brain health diagnosis PDF is in:', uploadsDir);
    return;
  }
  
  console.log('✅ Found PDF file:', path.basename(pdfPath));
  
  // Simulate the document being added to user profile
  const userId = 'test-user-123';
  const documentInfo = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    filename: 'BHC Post-Diagnostic Summary Schema.pdf',
    file_type: 'application/pdf',
    file_size: fs.statSync(pdfPath).size,
    upload_timestamp: new Date().toISOString(),
    provider: 'Dr. Brain Health Specialist',
    userId: userId
  };
  
  console.log('📄 Document info:', documentInfo);
  console.log('👤 Assigned to user:', userId);
  console.log('🔔 Notification will appear when user logs in');
  
  // Create a simple notification file that the frontend can read
  const notificationData = {
    userId: userId,
    documentId: documentInfo.id,
    message: `Your provider ${documentInfo.provider} has uploaded a new document: ${documentInfo.filename}`,
    timestamp: documentInfo.upload_timestamp,
    isDelivered: false
  };
  
  const notificationPath = path.join(uploadsDir, 'user-notifications.json');
  let existingNotifications = [];
  
  try {
    if (fs.existsSync(notificationPath)) {
      existingNotifications = JSON.parse(fs.readFileSync(notificationPath, 'utf8'));
    }
  } catch (error) {
    console.log('⚠️ Could not read existing notifications, starting fresh');
  }
  
  existingNotifications.push(notificationData);
  
  try {
    fs.writeFileSync(notificationPath, JSON.stringify(existingNotifications, null, 2));
    console.log('✅ Notification data saved to:', notificationPath);
  } catch (error) {
    console.log('⚠️ Could not save notification data:', error.message);
  }
  
  console.log('\n🚀 Next steps:');
  console.log('1. Start the backend server: node server.js');
  console.log('2. Refresh your frontend page');
  console.log('3. The document notification should appear in your welcome message');
  console.log('4. You can click "Review new document now" to see the document');
  
  console.log('\n📋 Available API endpoints:');
  console.log('- GET  /api/documents/test - Test the API');
  console.log('- POST /api/documents/upload - Upload a document');
  console.log('- GET  /api/documents/notifications/:userId - Get user notifications');
  console.log('- GET  /api/documents/content/:documentId - Get document content');
  console.log('- GET  /api/documents/debug - View all stored data');
}

// Run the simulation
simulateProviderUpload().catch(console.error);
