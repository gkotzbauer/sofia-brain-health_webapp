// API Client Module for Sofia
const SofiaAPI = (function() {
    // Auto-detect API URL based on environment
    const API_BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:10000/api' 
        : (window.SofiaConfig ? window.SofiaConfig.API_BASE_URL : 'https://your-render-app-name.onrender.com/api');
    
    let authToken = localStorage.getItem('sofia_auth_token');
    let currentUser = null;
    let currentSessionId = null;
    
    // Log API configuration for debugging
    console.log('Sofia API configured with base URL:', API_BASE_URL);

    // Helper function for API calls
    async function apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (authToken) {
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired, clear and redirect to login
                    localStorage.removeItem('sofia_auth_token');
                    authToken = null;
                    throw new Error('Authentication required');
                }
                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // Enhanced API call with offline support
    async function apiCallWithOfflineSupport(endpoint, method = 'GET', data = null) {
        try {
            return await apiCall(endpoint, method, data);
        } catch (error) {
            // If offline or network error, queue the request
            if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                const offlineQueue = JSON.parse(localStorage.getItem('sofia_offline_api_queue') || '[]');
                offlineQueue.push({
                    endpoint,
                    method,
                    data,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem('sofia_offline_api_queue', JSON.stringify(offlineQueue));
                
                console.log(`Request queued for offline sync: ${method} ${endpoint}`);
                
                // Return a pending status
                return { 
                    status: 'queued_offline', 
                    message: 'Request queued for when connection is restored',
                    queueLength: offlineQueue.length
                };
            }
            throw error;
        }
    }

    // Process queued API requests when back online
    async function processOfflineQueue() {
        const queue = JSON.parse(localStorage.getItem('sofia_offline_api_queue') || '[]');
        if (queue.length === 0) return { processed: 0, failed: 0 };
        
        console.log(`Processing ${queue.length} offline API requests...`);
        const failed = [];
        let processed = 0;
        
        for (const request of queue) {
            try {
                // Skip authentication calls in queue as they may be stale
                if (request.endpoint === '/users/auth') {
                    console.log('Skipping queued auth request');
                    continue;
                }
                
                await apiCall(request.endpoint, request.method, request.data);
                processed++;
                console.log(`Successfully processed: ${request.method} ${request.endpoint}`);
            } catch (error) {
                console.error('Failed to process queued request:', error);
                // Only re-queue if not an auth error
                if (!error.message.includes('Authentication required')) {
                    failed.push(request);
                }
            }
        }
        
        // Keep only failed requests in queue
        localStorage.setItem('sofia_offline_api_queue', JSON.stringify(failed));
        
        const result = { processed, failed: failed.length };
        console.log(`Offline queue processing complete:`, result);
        return result;
    }

    // Public API methods
    return {
        // Authentication
        async authenticate(name, age) {
            try {
                const response = await apiCall('/users/auth', 'POST', { name, age });
                authToken = response.token;
                currentUser = response.user;
                localStorage.setItem('sofia_auth_token', authToken);
                
                // Process any queued requests after successful auth
                if (navigator.onLine) {
                    setTimeout(() => processOfflineQueue(), 1000);
                }
                
                return response;
            } catch (error) {
                console.error('Authentication failed:', error);
                throw error;
            }
        },

        // Get user profile with all data
        async getUserProfile() {
            try {
                const profile = await apiCall('/users/profile');
                return profile;
            } catch (error) {
                console.error('Failed to fetch profile:', error);
                throw error;
            }
        },

        // Create new session
        async createSession() {
            try {
                const session = await apiCallWithOfflineSupport('/sessions', 'POST');
                if (session.status !== 'queued_offline') {
                    currentSessionId = session.id;
                }
                return session;
            } catch (error) {
                console.error('Failed to create session:', error);
                throw error;
            }
        },

        // Update session
        async updateSession(duration, topics, conversationLog) {
            if (!currentSessionId && navigator.onLine) return;
            
            try {
                return await apiCallWithOfflineSupport(`/sessions/${currentSessionId}`, 'PUT', {
                    duration_minutes: duration,
                    main_topics: topics,
                    conversation_log: conversationLog
                });
            } catch (error) {
                console.error('Failed to update session:', error);
                throw error;
            }
        },

        // Update About Me profile
        async updateAboutMe(data) {
            try {
                return await apiCallWithOfflineSupport('/users/about-me', 'PUT', data);
            } catch (error) {
                console.error('Failed to update About Me:', error);
                throw error;
            }
        },

        // Create story chapter
        async createChapter(chapterData) {
            try {
                return await apiCallWithOfflineSupport('/story-chapters', 'POST', chapterData);
            } catch (error) {
                console.error('Failed to create chapter:', error);
                throw error;
            }
        },

        // ============= DOCUMENT MANAGEMENT METHODS =============
        
        // Upload and process a document
        async uploadDocument(file) {
            try {
                const formData = new FormData();
                formData.append('document', file);
                
                const options = {
                    method: 'POST',
                    headers: {}
                };
                
                if (authToken) {
                    options.headers['Authorization'] = `Bearer ${authToken}`;
                }
                
                // Remove Content-Type header for FormData
                delete options.headers['Content-Type'];
                
                const response = await fetch(`${API_BASE_URL}/documents/upload`, {
                    ...options,
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error(`Document upload failed: ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('Document upload failed:', error);
                throw error;
            }
        },
        
        // Get document content by ID
        async getDocumentContent(documentId) {
            try {
                return await apiCall(`/documents/content/${documentId}`);
            } catch (error) {
                console.error('Failed to fetch document content:', error);
                throw error;
            }
        },
        
        // Get pending document notifications for user
        async getDocumentNotifications(userId) {
            try {
                return await apiCall(`/documents/notifications/${userId}`);
            } catch (error) {
                console.error('Failed to fetch document notifications:', error);
                throw error;
            }
        },
        
        // Mark document notification as delivered
        async markNotificationDelivered(notificationId) {
            try {
                return await apiCall(`/documents/notifications/${notificationId}/delivered`, 'PUT');
            } catch (error) {
                console.error('Failed to mark notification as delivered:', error);
                throw error;
            }
        },
        
        // ============= END DOCUMENT MANAGEMENT METHODS =============

        // Create goal
        async createGoal(goalData) {
            try {
                return await apiCallWithOfflineSupport('/goals', 'POST', goalData);
            } catch (error) {
                console.error('Failed to create goal:', error);
                throw error;
            }
        },

        // Submit feedback
        async submitFeedback(feedbackText, conversationContext) {
            try {
                return await apiCallWithOfflineSupport('/feedback', 'POST', {
                    sessionId: currentSessionId,
                    feedbackText,
                    conversationContext
                });
            } catch (error) {
                console.error('Failed to submit feedback:', error);
                throw error;
            }
        },

        // Create safety event
        async createSafetyEvent(eventData) {
            try {
                return await apiCallWithOfflineSupport('/safety-events', 'POST', {
                    sessionId: currentSessionId,
                    ...eventData
                });
            } catch (error) {
                console.error('Failed to create safety event:', error);
                throw error;
            }
        },

        // Track document upload
        async trackDocumentUpload(uploadData) {
            try {
                return await apiCallWithOfflineSupport('/document-uploads', 'POST', uploadData);
            } catch (error) {
                console.error('Failed to track document upload:', error);
                throw error;
            }
        },

        // Update document processing status
        async updateDocumentUpload(uploadId, appliedCount) {
            try {
                return await apiCallWithOfflineSupport(`/document-uploads/${uploadId}`, 'PUT', { appliedCount });
            } catch (error) {
                console.error('Failed to update document status:', error);
                throw error;
            }
        },

        // Track profile variable change
        async trackProfileChange(changeData) {
            try {
                return await apiCallWithOfflineSupport('/profile-history', 'POST', changeData);
            } catch (error) {
                console.error('Failed to track profile change:', error);
                throw error;
            }
        },

        // Process offline queue manually
        processOfflineQueue,

        // Check authentication status
        isAuthenticated() {
            return !!authToken;
        },

        // Get current user
        getCurrentUser() {
            return currentUser;
        },

        // Get offline queue status
        getOfflineQueueStatus() {
            const apiQueue = JSON.parse(localStorage.getItem('sofia_offline_api_queue') || '[]');
            const dataQueue = JSON.parse(localStorage.getItem('sofia_offline_queue') || '[]');
            return {
                apiRequests: apiQueue.length,
                dataItems: dataQueue.length,
                total: apiQueue.length + dataQueue.length
            };
        },

        // Logout
        logout() {
            authToken = null;
            currentUser = null;
            currentSessionId = null;
            localStorage.removeItem('sofia_auth_token');
        }
    };
})();

// Integration functions to replace localStorage usage
async function loadUserHistoryFromAPI() {
    try {
        const profile = await SofiaAPI.getUserProfile();
        
        // Transform API data to match existing userHistory structure
        const userHistory = {
            profile: {
                name: profile.user.name,
                age: profile.user.age,
                registrationDate: profile.user.registration_date,
                lastVisit: profile.user.last_visit,
                totalSessions: profile.user.total_sessions
            },
            aboutMe: {
                bestLifeElements: profile.aboutMe?.best_life_elements || [],
                concerns: profile.aboutMe?.concerns || [],
                confidenceLevel: profile.aboutMe?.confidence_level || "",
                confidenceTimestamp: profile.aboutMe?.confidence_timestamp,
                userDefinedNextSteps: profile.aboutMe?.user_defined_next_steps || [],
                profileCompleteness: profile.aboutMe?.profile_completeness || 0,
                lastUpdated: profile.aboutMe?.updated_at
            },
            storyChapters: profile.storyChapters.map(ch => ({
                title: ch.title,
                moment: ch.moment,
                moodArc: ch.mood_arc,
                choices: ch.choices,
                learning: ch.learning,
                timestamp: ch.created_at,
                linkedBestLifeElements: ch.linked_best_life_elements
            })),
            goals: profile.goals.map(g => ({
                goal: g.goal,
                setDate: g.created_at,
                confidence: g.confidence,
                status: g.status,
                linkedBestLifeElements: g.linked_best_life_elements,
                userNote: g.user_note,
                lastEdited: g.last_edited
            })),
            concerns: profile.concerns.map(c => ({
                concern: c.concern,
                timestamp: c.created_at,
                severity: c.severity,
                context: c.context,
                userNote: c.user_note,
                lastEdited: c.last_edited
            })),
            values: profile.values.map(v => ({
                value: v.value_text,
                timestamp: v.created_at,
                importance: v.importance,
                userNote: v.user_note,
                lastEdited: v.last_edited
            })),
            educationTopics: profile.educationTopics.map(e => ({
                topic: e.topic,
                timestamp: e.created_at,
                engagement: e.engagement,
                userNote: e.user_note,
                lastEdited: e.last_edited
            }))
        };
        
        return userHistory;
    } catch (error) {
        console.error('Failed to load user history from API:', error);
        return null;
    }
}

// Replace saveUserHistory with API calls
async function saveToAPI(dataType, data) {
    try {
        switch(dataType) {
            case 'aboutMe':
                await SofiaAPI.updateAboutMe(data);
                break;
            case 'chapter':
                await SofiaAPI.createChapter(data);
                break;
            case 'goal':
                await SofiaAPI.createGoal(data);
                break;
            case 'feedback':
                await SofiaAPI.submitFeedback(data.text, data.context);
                break;
            case 'safetyEvent':
                await SofiaAPI.createSafetyEvent(data);
                break;
        }
    } catch (error) {
        console.error(`Failed to save ${dataType} to API:`, error);
        // Fallback to localStorage for offline support
        const offlineQueue = JSON.parse(localStorage.getItem('sofia_offline_queue') || '[]');
        offlineQueue.push({ type: dataType, data, timestamp: new Date().toISOString() });
        localStorage.setItem('sofia_offline_queue', JSON.stringify(offlineQueue));
    }
}

// Enhanced sync function that processes both queues
async function syncOfflineData() {
    // First process API queue
    const apiQueueResult = await SofiaAPI.processOfflineQueue();
    console.log('API queue sync result:', apiQueueResult);
    
    // Then process data queue
    const offlineQueue = JSON.parse(localStorage.getItem('sofia_offline_queue') || '[]');
    
    if (offlineQueue.length === 0) return;
    
    console.log(`Syncing ${offlineQueue.length} offline data items...`);
    const failed = [];
    
    for (const item of offlineQueue) {
        try {
            await saveToAPI(item.type, item.data);
        } catch (error) {
            console.error('Failed to sync offline data:', error);
            // Only re-queue if not an auth error
            if (!error.message.includes('Authentication required')) {
                failed.push(item);
            }
        }
    }
    
    // Update queue with only failed items
    if (failed.length > 0) {
        localStorage.setItem('sofia_offline_queue', JSON.stringify(failed));
        console.log(`${failed.length} items remain in offline queue`);
    } else {
        localStorage.removeItem('sofia_offline_queue');
        console.log('All offline data synced successfully');
    }
}

// Check online status and sync
window.addEventListener('online', () => {
    console.log('Connection restored - syncing offline data...');
    setTimeout(syncOfflineData, 2000); // Wait 2 seconds for connection to stabilize
});

// Also try to sync on page load if online
if (navigator.onLine && typeof SofiaAPI !== 'undefined') {
    setTimeout(syncOfflineData, 5000); // Wait 5 seconds after load
}

// Periodic sync attempt every 30 seconds if items are queued
setInterval(() => {
    if (navigator.onLine) {
        const status = SofiaAPI.getOfflineQueueStatus();
        if (status.total > 0) {
            console.log(`Attempting periodic sync of ${status.total} queued items...`);
            syncOfflineData();
        }
    }
}, 30000);
