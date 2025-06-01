/**
 * WebSocket management module for Pool Automation Dashboard
 * Handles all Socket.IO communications with proper authentication and error handling
 */

const WebSocketManager = (function() {
    'use strict';
    
    // Configuration
    const config = window.DashboardConfig || {
        socket: {
            url: window.location.protocol + '//' + window.location.host,
            options: {}
        }
    };
    
    // State management
    let socket = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const eventHandlers = new Map();
    const roomSubscriptions = new Set();
    
    // Event queue for offline handling
    const eventQueue = [];
    const maxQueueSize = 50;
    
    /**
     * Initialize Socket.IO connection
     * @returns {boolean} - Success status
     */
    function initialize() {
        if (socket && socket.connected) {
            console.warn('WebSocket already initialized');
            return true;
        }
        
        try {
            // Create socket with configuration
            socket = io(config.socket.url, {
                ...config.socket.options,
                auth: getAuthData(),
                query: getQueryParams()
            });
            
            // Set up core event handlers
            setupCoreHandlers();
            
            // Connect
            socket.connect();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            return false;
        }
    }
    
    /**
     * Get authentication data for socket connection
     * @returns {Object} - Auth data
     */
    function getAuthData() {
        const authToken = localStorage.getItem('authToken');
        const sessionId = getCookie('session_id');
        
        return {
            token: authToken,
            sessionId: sessionId
        };
    }
    
    /**
     * Get query parameters for socket connection
     * @returns {Object} - Query parameters
     */
    function getQueryParams() {
        return {
            clientVersion: '1.0.0',
            clientType: 'web',
            timestamp: Date.now()
        };
    }
    
    /**
     * Set up core socket event handlers
     */
    function setupCoreHandlers() {
        if (!socket) return;
        
        // Connection events
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);
        
        // Authentication events
        socket.on('authenticated', handleAuthenticated);
        socket.on('unauthorized', handleUnauthorized);
        
        // System events
        socket.on('error', handleError);
        socket.on('ping', handlePing);
        socket.on('server_restart', handleServerRestart);
        
        // Pool data events
        socket.on('sensor_update', handleSensorUpdate);
        socket.on('pump_status', handlePumpStatus);
        socket.on('dosing_update', handleDosingUpdate);
        socket.on('alert', handleAlert);
        socket.on('system_status', handleSystemStatus);
    }
    
    /**
     * Handle successful connection
     */
    function handleConnect() {
        console.log('WebSocket connected');
        isConnected = true;
        reconnectAttempts = 0;
        
        // Re-join rooms
        roomSubscriptions.forEach(room => {
            socket.emit('join_room', room);
        });
        
        // Process queued events
        processEventQueue();
        
        // Notify handlers
        triggerHandlers('connection', { status: 'connected' });
        
        // Update UI
        updateConnectionStatus(true);
    }
    
    /**
     * Handle disconnection
     * @param {string} reason - Disconnect reason
     */
    function handleDisconnect(reason) {
        console.log('WebSocket disconnected:', reason);
        isConnected = false;
        
        // Notify handlers
        triggerHandlers('connection', { status: 'disconnected', reason });
        
        // Update UI
        updateConnectionStatus(false);
        
        // Handle specific disconnect reasons
        if (reason === 'io server disconnect') {
            // Server disconnected, attempt reconnect
            attemptReconnect();
        }
    }
    
    /**
     * Handle connection errors
     * @param {Error} error - Connection error
     */
    function handleConnectError(error) {
        console.error('WebSocket connection error:', error);
        
        if (error.type === 'TransportError' || error.message.includes('xhr poll error')) {
            // Network issue, try different transport
            if (socket.io.opts.transports.includes('websocket')) {
                socket.io.opts.transports = ['polling'];
            }
        }
        
        reconnectAttempts++;
        
        if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            setTimeout(() => {
                console.log(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                socket.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            triggerHandlers('connection', { 
                status: 'failed', 
                error: 'Max reconnection attempts reached' 
            });
        }
    }
    
    /**
     * Handle successful authentication
     * @param {Object} data - Auth response data
     */
    function handleAuthenticated(data) {
        console.log('WebSocket authenticated');
        
        // Store auth data if provided
        if (data.token) {
            localStorage.setItem('authToken', data.token);
        }
        
        // Request initial data
        emit('request_dashboard_data');
        
        triggerHandlers('authenticated', data);
    }
    
    /**
     * Handle unauthorized access
     * @param {Object} data - Error data
     */
    function handleUnauthorized(data) {
        console.error('WebSocket unauthorized:', data);
        
        // Clear auth data
        localStorage.removeItem('authToken');
        
        // Disconnect socket
        disconnect();
        
        // Redirect to login
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login?error=unauthorized';
        }
        
        triggerHandlers('unauthorized', data);
    }
    
    /**
     * Handle generic errors
     * @param {Object} error - Error data
     */
    function handleError(error) {
        console.error('WebSocket error:', error);
        triggerHandlers('error', error);
        
        // Show user-friendly error if available
        if (window.showToast && error.message) {
            window.showToast(escapeHtml(error.message), 'danger');
        }
    }
    
    /**
     * Handle ping for connection health check
     */
    function handlePing() {
        socket.emit('pong', { timestamp: Date.now() });
    }
    
    /**
     * Handle server restart notification
     * @param {Object} data - Restart data
     */
    function handleServerRestart(data) {
        console.log('Server restart notification:', data);
        
        if (window.showToast) {
            const message = data.message || 'Server is restarting. Please wait...';
            const duration = data.estimatedDowntime || 10000;
            window.showToast(escapeHtml(message), 'warning', duration);
        }
        
        // Schedule reconnect after estimated downtime
        if (data.estimatedDowntime) {
            setTimeout(() => {
                attemptReconnect();
            }, data.estimatedDowntime + 1000);
        }
    }
    
    /**
     * Handle sensor update
     * @param {Object} data - Sensor data
     */
    function handleSensorUpdate(data) {
        if (!data || typeof data !== 'object') return;
        
        // Sanitize data
        const sanitized = sanitizeEventData(data);
        
        // Trigger handlers
        triggerHandlers('sensor_update', sanitized);
    }
    
    /**
     * Handle pump status update
     * @param {Object} data - Pump status data
     */
    function handlePumpStatus(data) {
        if (!data || typeof data !== 'object') return;
        
        const sanitized = sanitizeEventData(data);
        triggerHandlers('pump_status', sanitized);
    }
    
    /**
     * Handle dosing update
     * @param {Object} data - Dosing data
     */
    function handleDosingUpdate(data) {
        if (!data || typeof data !== 'object') return;
        
        const sanitized = sanitizeEventData(data);
        triggerHandlers('dosing_update', sanitized);
    }
    
    /**
     * Handle alerts
     * @param {Object} data - Alert data
     */
    function handleAlert(data) {
        if (!data || typeof data !== 'object') return;
        
        const sanitized = sanitizeEventData(data);
        
        // Show toast notification for alerts
        if (window.showToast && sanitized.message) {
            const type = sanitized.severity || 'warning';
            window.showToast(escapeHtml(sanitized.message), type);
        }
        
        triggerHandlers('alert', sanitized);
    }
    
    /**
     * Handle system status update
     * @param {Object} data - System status data
     */
    function handleSystemStatus(data) {
        if (!data || typeof data !== 'object') return;
        
        const sanitized = sanitizeEventData(data);
        triggerHandlers('system_status', sanitized);
    }
    
    /**
     * Emit event with offline queue support
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {Function} callback - Optional callback
     */
    function emit(event, data, callback) {
        if (!socket) {
            console.error('Socket not initialized');
            return;
        }
        
        // Sanitize outgoing data
        const sanitizedData = data ? sanitizeEventData(data) : undefined;
        
        if (isConnected) {
            socket.emit(event, sanitizedData, callback);
        } else {
            // Queue event for later
            queueEvent(event, sanitizedData, callback);
        }
    }
    
    /**
     * Subscribe to event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} - Unsubscribe function
     */
    function on(event, handler) {
        if (!eventHandlers.has(event)) {
            eventHandlers.set(event, new Set());
        }
        
        eventHandlers.get(event).add(handler);
        
        // Return unsubscribe function
        return () => off(event, handler);
    }
    
    /**
     * Unsubscribe from event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    function off(event, handler) {
        const handlers = eventHandlers.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                eventHandlers.delete(event);
            }
        }
    }
    
    /**
     * Join a room
     * @param {string} room - Room name
     */
    function joinRoom(room) {
        if (!room) return;
        
        roomSubscriptions.add(room);
        
        if (isConnected && socket) {
            socket.emit('join_room', room);
        }
    }
    
    /**
     * Leave a room
     * @param {string} room - Room name
     */
    function leaveRoom(room) {
        if (!room) return;
        
        roomSubscriptions.delete(room);
        
        if (isConnected && socket) {
            socket.emit('leave_room', room);
        }
    }
    
    /**
     * Disconnect socket
     */
    function disconnect() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        
        isConnected = false;
        roomSubscriptions.clear();
        eventQueue.length = 0;
    }
    
    /**
     * Attempt to reconnect
     */
    function attemptReconnect() {
        if (!socket) {
            initialize();
        } else if (!socket.connected) {
            socket.connect();
        }
    }
    
    /**
     * Queue event for offline processing
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {Function} callback - Callback function
     */
    function queueEvent(event, data, callback) {
        eventQueue.push({
            event,
            data,
            callback,
            timestamp: Date.now()
        });
        
        // Limit queue size
        if (eventQueue.length > maxQueueSize) {
            eventQueue.shift();
        }
    }
    
    /**
     * Process queued events
     */
    function processEventQueue() {
        if (!isConnected || eventQueue.length === 0) return;
        
        const queue = [...eventQueue];
        eventQueue.length = 0;
        
        queue.forEach(item => {
            socket.emit(item.event, item.data, item.callback);
        });
    }
    
    /**
     * Trigger event handlers
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    function triggerHandlers(event, data) {
        const handlers = eventHandlers.get(event);
        if (!handlers) return;
        
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        });
    }
    
    /**
     * Sanitize event data to prevent XSS
     * @param {*} data - Data to sanitize
     * @returns {*} - Sanitized data
     */
    function sanitizeEventData(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        
        const sanitized = Array.isArray(data) ? [] : {};
        
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const value = data[key];
                
                if (typeof value === 'string') {
                    // Don't escape numeric strings or specific fields
                    if (key === 'id' || key === 'timestamp' || /^\d+\.?\d*$/.test(value)) {
                        sanitized[key] = value;
                    } else {
                        sanitized[key] = escapeHtml(value);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = sanitizeEventData(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }
        
        return sanitized;
    }
    
    /**
     * Update connection status in UI
     * @param {boolean} connected - Connection status
     */
    function updateConnectionStatus(connected) {
        const indicator = document.getElementById('connection-status');
        if (!indicator) return;
        
        if (connected) {
            indicator.classList.remove('disconnected');
            indicator.classList.add('connected');
            indicator.title = 'Connected';
        } else {
            indicator.classList.remove('connected');
            indicator.classList.add('disconnected');
            indicator.title = 'Disconnected';
        }
    }
    
    /**
     * Get cookie value
     * @param {string} name - Cookie name
     * @returns {string|null} - Cookie value
     */
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
        return null;
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (socket) {
            socket.disconnect();
        }
    });
    
    // Public API
    return {
        initialize,
        disconnect,
        emit,
        on,
        off,
        joinRoom,
        leaveRoom,
        
        // Status checks
        isConnected: () => isConnected,
        getSocket: () => socket,
        
        // Utility methods
        reconnect: attemptReconnect,
        getQueueSize: () => eventQueue.length,
        clearQueue: () => { eventQueue.length = 0; }
    };
})();

// Make WebSocketManager globally available
window.WebSocketManager = WebSocketManager;