/**
 * API wrapper module for Pool Automation Dashboard
 * Provides secure, authenticated API calls with retry logic
 */

const DashboardAPI = (function() {
    'use strict';
    
    const config = window.DashboardConfig || {
        api: { baseUrl: '/api', timeout: 30000, retryAttempts: 3, retryDelay: 1000 }
    };
    
    // Request queue for offline support
    const requestQueue = [];
    let isOnline = navigator.onLine;
    
    // Monitor online/offline status
    window.addEventListener('online', () => {
        isOnline = true;
        processQueue();
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
    });
    
    /**
     * Get authentication headers
     * @returns {Object} Headers object with auth token
     */
    function getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        };
        
        // Add CSRF token if available
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken.content;
        }
        
        // Add auth token if available
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        return headers;
    }
    
    /**
     * Make an authenticated API request with retry logic
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise} - Promise resolving to response data
     */
    async function request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') 
            ? endpoint 
            : `${config.api.baseUrl}${endpoint}`;
        
        const defaultOptions = {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'same-origin',
            timeout: config.api.timeout
        };
        
        const requestOptions = { ...defaultOptions, ...options };
        
        // Add timeout support
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);
        requestOptions.signal = controller.signal;
        delete requestOptions.timeout;
        
        // Sanitize body data if present
        if (requestOptions.body && typeof requestOptions.body === 'object') {
            requestOptions.body = JSON.stringify(sanitizeData(requestOptions.body));
        }
        
        let lastError;
        
        // Retry logic
        for (let attempt = 0; attempt < config.api.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, requestOptions);
                clearTimeout(timeoutId);
                
                // Handle authentication errors
                if (response.status === 401) {
                    handleAuthError();
                    throw new Error('Authentication required');
                }
                
                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') || 60);
                    const limitType = data.message || 'requests';
                    
                    // Show user-friendly rate limit message
                    if (window.UIManager) {
                        UIManager.showToast(
                            `Too many ${limitType}. Please wait ${retryAfter} seconds before trying again.`,
                            'warning',
                            Math.min(retryAfter * 1000, 10000) // Cap at 10 seconds display
                        );
                    }
                    
                    // For non-critical requests, automatically retry after the specified time
                    if (attempt < config.api.retryAttempts - 1 && retryAfter <= 60) {
                        await delay(retryAfter * 1000);
                        continue;
                    }
                    
                    throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
                }
                
                // Handle server errors with retry
                if (response.status >= 500 && attempt < config.api.retryAttempts - 1) {
                    await delay(config.api.retryDelay * Math.pow(2, attempt));
                    continue;
                }
                
                // Parse response
                const contentType = response.headers.get('content-type');
                let data;
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
                
                if (!response.ok) {
                    throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
                }
                
                return data;
                
            } catch (error) {
                clearTimeout(timeoutId);
                lastError = error;
                
                // Don't retry on client errors or auth errors
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                
                if (error.message.includes('401') || 
                    error.message.includes('Authentication') ||
                    error.message.includes('Rate limited')) {
                    throw error;
                }
                
                // Queue request if offline
                if (!isOnline && attempt === config.api.retryAttempts - 1) {
                    queueRequest(endpoint, options);
                    throw new Error('Offline - request queued');
                }
                
                // Wait before retry
                if (attempt < config.api.retryAttempts - 1) {
                    await delay(config.api.retryDelay * Math.pow(2, attempt));
                }
            }
        }
        
        throw lastError || new Error('Request failed after retries');
    }
    
    /**
     * Sanitize data to prevent XSS
     * @param {Object} data - Data to sanitize
     * @returns {Object} - Sanitized data
     */
    function sanitizeData(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        
        const sanitized = Array.isArray(data) ? [] : {};
        
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const value = data[key];
                
                if (typeof value === 'string') {
                    // Only escape HTML for fields that might be displayed
                    sanitized[key] = escapeHtml(value);
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = sanitizeData(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }
        
        return sanitized;
    }
    
    /**
     * Handle authentication errors
     */
    function handleAuthError() {
        // Clear auth data
        localStorage.removeItem('authToken');
        
        // Redirect to login if not already there
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        }
    }
    
    /**
     * Queue request for later processing
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     */
    function queueRequest(endpoint, options) {
        requestQueue.push({ endpoint, options, timestamp: Date.now() });
        
        // Limit queue size
        if (requestQueue.length > 100) {
            requestQueue.shift();
        }
        
        // Save queue to localStorage
        localStorage.setItem('requestQueue', JSON.stringify(requestQueue));
    }
    
    /**
     * Process queued requests
     */
    async function processQueue() {
        if (!isOnline || requestQueue.length === 0) return;
        
        const queue = [...requestQueue];
        requestQueue.length = 0;
        
        for (const item of queue) {
            try {
                await request(item.endpoint, item.options);
            } catch (error) {
                console.error('Failed to process queued request:', error);
            }
        }
        
        localStorage.removeItem('requestQueue');
    }
    
    /**
     * Delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Promise that resolves after delay
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Load queued requests on startup
    try {
        const savedQueue = localStorage.getItem('requestQueue');
        if (savedQueue) {
            requestQueue.push(...JSON.parse(savedQueue));
            processQueue();
        }
    } catch (error) {
        console.error('Error loading request queue:', error);
    }
    
    // Public API methods
    return {
        // Core request method
        request,
        
        // Convenience methods
        get: (endpoint, options = {}) => 
            request(endpoint, { ...options, method: 'GET' }),
            
        post: (endpoint, data, options = {}) => 
            request(endpoint, { ...options, method: 'POST', body: data }),
            
        put: (endpoint, data, options = {}) => 
            request(endpoint, { ...options, method: 'PUT', body: data }),
            
        delete: (endpoint, options = {}) => 
            request(endpoint, { ...options, method: 'DELETE' }),
            
        patch: (endpoint, data, options = {}) => 
            request(endpoint, { ...options, method: 'PATCH', body: data }),
        
        // Specific API calls
        dashboard: {
            getData: () => request('/api/dashboard'),
            getStatus: () => request('/api/status'),
            getHistory: (hours = 24) => request(`/api/history/parameters?hours=${hours}`),
            getTurbidityHistory: (hours = 24) => request(`/api/history/turbidity?hours=${hours}`),
            getEvents: (hours = 24, type = null) => {
                let url = `/api/history/events?hours=${hours}`;
                if (type) url += `&type=${type}`;
                return request(url);
            }
        },
        
        pumps: {
            controlPH: (command, duration) => 
                request('/api/pumps/ph', { method: 'POST', body: { command, duration } }),
            controlChlorine: (command, duration) => 
                request('/api/pumps/chlorine', { method: 'POST', body: { command, duration } }),
            controlPAC: (command, duration, flowRate) => 
                request('/api/pumps/pac', { method: 'POST', body: { command, duration, flow_rate: flowRate } })
        },
        
        dosing: {
            getStatus: () => request('/api/dosing/status'),
            setMode: (mode) => request('/api/dosing/mode', { method: 'POST', body: { mode } }),
            manualDose: (duration, flowRate) => 
                request('/api/dosing/manual', { method: 'POST', body: { duration, flow_rate: flowRate } }),
            resetPID: () => request('/api/dosing/reset-pid', { method: 'POST' }),
            schedule: (timestamp, duration, flowRate) => 
                request('/api/dosing/schedule', { method: 'POST', body: { timestamp, duration, flow_rate: flowRate } }),
            getScheduled: () => request('/api/dosing/scheduled')
        },
        
        settings: {
            updateNotifications: (settings) => 
                request('/api/notifications/settings', { method: 'POST', body: settings }),
            testNotification: (email) => 
                request('/api/notifications/test', { method: 'POST', body: { email } })
        },
        
        simulator: {
            control: (command, parameter, value) => 
                request('/api/simulator/control', { method: 'POST', body: { command, parameter, value } }),
            getEvents: () => request('/api/simulator/events'),
            triggerEvent: (type) => 
                request('/api/simulator/trigger-event', { method: 'POST', body: { type } })
        },
        
        // Utility methods
        isOnline: () => isOnline,
        getQueueSize: () => requestQueue.length,
        clearQueue: () => {
            requestQueue.length = 0;
            localStorage.removeItem('requestQueue');
        }
    };
})();

// Make API globally available
window.DashboardAPI = DashboardAPI;