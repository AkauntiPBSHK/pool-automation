/**
 * Utility functions for the Pool Automation Dashboard
 */

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} unsafe - Unsafe string to escape
 * @returns {string} - Escaped HTML string
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Debounce function to limit how often a function can fire
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @param {boolean} immediate - Trigger on leading edge instead of trailing
 * @returns {Function} - Debounced function
 */
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction() {
        const context = this;
        const args = arguments;
        
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(context, args);
    };
}

/**
 * Throttle function to limit function execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between executions
 * @returns {Function} - Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Deep clone an object (simple implementation)
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const clonedObj = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Safe JSON parse with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} - Parsed object or fallback
 */
function safeJsonParse(jsonString, fallback = null) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('JSON parse error:', e);
        return fallback;
    }
}

/**
 * Format a number with specified decimal places
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted number
 */
function formatNumber(value, decimals = 2) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '---';
    }
    return value.toFixed(decimals);
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Check if user is authenticated
 * @returns {boolean} - True if authenticated
 */
function isAuthenticated() {
    // Check for authentication cookie or token
    // This is a placeholder - implement based on your auth system
    return document.cookie.includes('session') || 
           localStorage.getItem('authToken') !== null;
}

/**
 * Get environment-aware API URL
 * @param {string} endpoint - API endpoint
 * @returns {string} - Full API URL
 */
function getApiUrl(endpoint) {
    const baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000'
        : `${window.location.protocol}//${window.location.host}`;
    return `${baseUrl}${endpoint}`;
}

/**
 * Get Socket.IO connection URL
 * @returns {string} - Socket.IO URL
 */
function getSocketUrl() {
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return `${window.location.protocol}//${window.location.host}`;
}

/**
 * Batch DOM updates using requestAnimationFrame
 * @param {Function[]} updates - Array of update functions
 */
function batchDOMUpdates(updates) {
    requestAnimationFrame(() => {
        updates.forEach(update => {
            try {
                update();
            } catch (error) {
                console.error('DOM update error:', error);
            }
        });
    });
}

/**
 * Safe element query with null check
 * @param {string} selector - CSS selector
 * @returns {Element|null} - Element or null
 */
function safeQuerySelector(selector) {
    try {
        return document.querySelector(selector);
    } catch (e) {
        console.error('Invalid selector:', selector);
        return null;
    }
}

/**
 * Add event listener with automatic cleanup
 * @param {Element} element - DOM element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} - Cleanup function
 */
function addCleanupListener(element, event, handler) {
    if (!element) return () => {};
    
    element.addEventListener(event, handler);
    
    return () => {
        element.removeEventListener(event, handler);
    };
}

/**
 * Create a safe wrapper for functions that might throw
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} - Wrapped function
 */
function safeExecute(fn, context = 'Unknown') {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            console.error(`Error in ${context}:`, error);
            // Optionally show user-friendly error
            if (window.showToast) {
                window.showToast('An error occurred. Please refresh the page.', 'warning');
            }
        }
    };
}

// Make utilities globally available
window.escapeHtml = escapeHtml;
window.debounce = debounce;
window.throttle = throttle;
window.deepClone = deepClone;
window.safeJsonParse = safeJsonParse;
window.formatNumber = formatNumber;
window.clamp = clamp;
window.isAuthenticated = isAuthenticated;
window.getApiUrl = getApiUrl;
window.getSocketUrl = getSocketUrl;
window.batchDOMUpdates = batchDOMUpdates;
window.safeQuerySelector = safeQuerySelector;
window.addCleanupListener = addCleanupListener;
window.safeExecute = safeExecute;

// Export utilities if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        debounce,
        throttle,
        deepClone,
        safeJsonParse,
        formatNumber,
        clamp,
        isAuthenticated,
        getApiUrl,
        getSocketUrl,
        batchDOMUpdates,
        safeQuerySelector,
        addCleanupListener,
        safeExecute
    };
}