const fs = require('fs');
const path = require('path');

// Simple test script to verify document upload functionality
console.log('🧪 Testing Document Upload Setup...\n');

// Check if uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
    console.log('✅ Uploads directory exists:', uploadsDir);
    
    // List files in uploads directory
    const files = fs.readdirSync(uploadsDir);
    if (files.length > 0) {
        console.log('📁 Files in uploads directory:');
        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            console.log(`   📄 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        });
    } else {
        console.log('📁 Uploads directory is empty - ready for files');
    }
} else {
    console.log('❌ Uploads directory not found');
}

// Check if required packages are installed
console.log('\n📦 Checking required packages...');
try {
    require('pdf-parse');
    console.log('✅ pdf-parse package available');
} catch (error) {
    console.log('❌ pdf-parse package not found - run: npm install pdf-parse');
}

try {
    require('multer');
    console.log('✅ multer package available');
} catch (error) {
    console.log('❌ multer package not found - run: npm install multer');
}

console.log('\n🚀 To test document upload:');
console.log('1. Copy your brain health PDF to:', uploadsDir);
console.log('2. Start the server: npm start');
console.log('3. Use the new /api/documents/upload endpoint');
console.log('4. Check the database for uploaded documents');
