// Sofia Frontend Configuration
const SofiaConfig = {
    // API Configuration
    API_BASE_URL: 'https://sofia-backend-o6jq.onrender.com/api', // Your actual Render app URL
    
    // App Configuration
    APP_NAME: 'Sofia Brain Health Companion',
    APP_VERSION: '1.0.0',
    
    // Feature Flags
    ENABLE_OFFLINE_MODE: true,
    ENABLE_PDF_UPLOAD: true,
    ENABLE_AUDIT_LOGGING: true,
    
    // UI Configuration
    THEME: 'default', // 'default', 'dark', 'high-contrast'
    ANIMATIONS_ENABLED: true,
    
    // Debug Configuration
    DEBUG_MODE: false,
    LOG_LEVEL: 'info' // 'debug', 'info', 'warn', 'error'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SofiaConfig;
} 