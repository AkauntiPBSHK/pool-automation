/**
 * UI Updates module for Pool Automation Dashboard
 * Manages DOM updates, animations, and UI state efficiently
 */

const UIManager = (function() {
    'use strict';
    
    // UI state
    const state = {
        updateQueue: [],
        isUpdating: false,
        animations: new Map(),
        observers: new Map()
    };
    
    // Configuration
    const config = {
        batchDelay: 16, // ~60fps
        animationDuration: 300,
        updateThreshold: 0.01, // Minimum change to trigger update
        maxQueueSize: 100
    };
    
    /**
     * Queue a DOM update for batch processing
     * @param {Function} updateFn - Update function to execute
     * @param {string} key - Optional key for deduplication
     */
    function queueUpdate(updateFn, key = null) {
        if (key) {
            // Remove any existing update with same key
            state.updateQueue = state.updateQueue.filter(item => item.key !== key);
        }
        
        state.updateQueue.push({ fn: updateFn, key });
        
        // Limit queue size
        if (state.updateQueue.length > config.maxQueueSize) {
            state.updateQueue.shift();
        }
        
        scheduleUpdate();
    }
    
    /**
     * Schedule batch update
     */
    function scheduleUpdate() {
        if (state.isUpdating) return;
        
        state.isUpdating = true;
        requestAnimationFrame(processBatch);
    }
    
    /**
     * Process queued updates
     */
    function processBatch() {
        const updates = [...state.updateQueue];
        state.updateQueue = [];
        state.isUpdating = false;
        
        // Execute all updates in a single frame
        updates.forEach(({ fn }) => {
            try {
                fn();
            } catch (error) {
                console.error('UI update error:', error);
            }
        });
    }
    
    /**
     * Update parameter display with animation
     * @param {string} elementId - Element ID
     * @param {number} value - New value
     * @param {number} decimals - Decimal places
     * @param {string} unit - Unit suffix
     */
    function updateParameter(elementId, value, decimals = 2, unit = '') {
        queueUpdate(() => {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const currentValue = parseFloat(element.textContent) || 0;
            const newValue = parseFloat(value) || 0;
            
            // Skip if change is too small
            if (Math.abs(newValue - currentValue) < config.updateThreshold) {
                return;
            }
            
            // Animate value change
            animateValue(element, currentValue, newValue, decimals, unit);
            
            // Update status class based on thresholds
            updateStatusClass(element, elementId.replace('-value', ''), newValue);
        }, elementId);
    }
    
    /**
     * Animate numeric value change
     * @param {HTMLElement} element - Target element
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} decimals - Decimal places
     * @param {string} unit - Unit suffix
     */
    function animateValue(element, start, end, decimals = 2, unit = '') {
        const duration = config.animationDuration;
        const startTime = performance.now();
        
        // Cancel any existing animation
        const animationId = element.dataset.animationId;
        if (animationId) {
            cancelAnimationFrame(parseInt(animationId));
        }
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const current = start + (end - start) * easeProgress;
            element.textContent = formatNumber(current, decimals) + unit;
            
            if (progress < 1) {
                const id = requestAnimationFrame(animate);
                element.dataset.animationId = id;
            } else {
                delete element.dataset.animationId;
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Update element status class based on value
     * @param {HTMLElement} element - Element to update
     * @param {string} parameter - Parameter name
     * @param {number} value - Current value
     */
    function updateStatusClass(element, parameter, value) {
        const parent = element.closest('.parameter-card, .stat-card, .metric-card');
        if (!parent) return;
        
        // Get thresholds from config
        const threshold = DashboardConfig?.thresholds?.[parameter];
        if (!threshold) return;
        
        // Remove existing status classes
        parent.classList.remove('status-normal', 'status-warning', 'status-danger');
        
        // Determine status
        let status = 'normal';
        
        if (value < threshold.min || value > threshold.max) {
            status = 'danger';
        } else if (threshold.targetMin && threshold.targetMax) {
            if (value < threshold.targetMin || value > threshold.targetMax) {
                status = 'warning';
            }
        }
        
        // Add new status class
        parent.classList.add(`status-${status}`);
        
        // Update icon if present
        const icon = parent.querySelector('.status-icon');
        if (icon) {
            updateStatusIcon(icon, status);
        }
    }
    
    /**
     * Update status icon
     * @param {HTMLElement} icon - Icon element
     * @param {string} status - Status type
     */
    function updateStatusIcon(icon, status) {
        const icons = {
            normal: 'bi-check-circle-fill text-success',
            warning: 'bi-exclamation-triangle-fill text-warning',
            danger: 'bi-x-circle-fill text-danger'
        };
        
        icon.className = `status-icon bi ${icons[status] || icons.normal}`;
    }
    
    /**
     * Update pump status display
     * @param {string} pumpId - Pump identifier
     * @param {Object} status - Pump status data
     */
    function updatePumpStatus(pumpId, status) {
        queueUpdate(() => {
            const card = document.getElementById(`${pumpId}-pump-card`);
            if (!card) return;
            
            // Update status text
            const statusElement = card.querySelector('.pump-status');
            if (statusElement) {
                statusElement.textContent = status.running ? 'Running' : 'Stopped';
                statusElement.className = `pump-status badge ${status.running ? 'bg-success' : 'bg-secondary'}`;
            }
            
            // Update flow rate
            const flowRateElement = card.querySelector('.flow-rate');
            if (flowRateElement && status.flowRate !== undefined) {
                flowRateElement.textContent = `${status.flowRate} ml/h`;
            }
            
            // Update runtime
            const runtimeElement = card.querySelector('.runtime');
            if (runtimeElement && status.runtime !== undefined) {
                runtimeElement.textContent = formatDuration(status.runtime);
            }
            
            // Update button states
            updatePumpButtons(card, status.running);
            
            // Add animation for running state
            if (status.running) {
                card.classList.add('pump-running');
            } else {
                card.classList.remove('pump-running');
            }
        }, `pump-${pumpId}`);
    }
    
    /**
     * Update pump control buttons
     * @param {HTMLElement} card - Pump card element
     * @param {boolean} isRunning - Pump running state
     */
    function updatePumpButtons(card, isRunning) {
        const startBtn = card.querySelector('.btn-start');
        const stopBtn = card.querySelector('.btn-stop');
        
        if (startBtn) {
            startBtn.disabled = isRunning;
            startBtn.classList.toggle('btn-outline-success', !isRunning);
            startBtn.classList.toggle('btn-secondary', isRunning);
        }
        
        if (stopBtn) {
            stopBtn.disabled = !isRunning;
            stopBtn.classList.toggle('btn-outline-danger', isRunning);
            stopBtn.classList.toggle('btn-secondary', !isRunning);
        }
    }
    
    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, warning, danger, info)
     * @param {number} duration - Display duration in milliseconds
     */
    function showToast(message, type = 'info', duration = 3000) {
        const container = getOrCreateToastContainer();
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Initialize Bootstrap toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: duration
        });
        
        // Show toast
        bsToast.show();
        
        // Remove from DOM after hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    /**
     * Get or create toast container
     * @returns {HTMLElement} - Toast container
     */
    function getOrCreateToastContainer() {
        let container = document.getElementById('toast-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    /**
     * Update connection indicator
     * @param {boolean} connected - Connection status
     */
    function updateConnectionStatus(connected) {
        queueUpdate(() => {
            const indicator = document.getElementById('connection-indicator');
            if (!indicator) return;
            
            const icon = indicator.querySelector('i');
            const text = indicator.querySelector('span');
            
            if (connected) {
                indicator.className = 'connection-status connected';
                if (icon) icon.className = 'bi bi-wifi';
                if (text) text.textContent = 'Connected';
            } else {
                indicator.className = 'connection-status disconnected';
                if (icon) icon.className = 'bi bi-wifi-off';
                if (text) text.textContent = 'Disconnected';
            }
        }, 'connection-status');
    }
    
    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    function showLoading(message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <div class="loading-message mt-3"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        
        const messageElement = overlay.querySelector('.loading-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        overlay.classList.add('show');
    }
    
    /**
     * Hide loading overlay
     */
    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
    
    /**
     * Create progress bar
     * @param {string} containerId - Container element ID
     * @param {number} value - Progress value (0-100)
     * @param {string} label - Progress label
     */
    function updateProgress(containerId, value, label = '') {
        queueUpdate(() => {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            let progressBar = container.querySelector('.progress-bar');
            
            if (!progressBar) {
                const progress = document.createElement('div');
                progress.className = 'progress';
                progress.innerHTML = '<div class="progress-bar" role="progressbar"></div>';
                container.appendChild(progress);
                progressBar = progress.querySelector('.progress-bar');
            }
            
            progressBar.style.width = `${Math.min(100, Math.max(0, value))}%`;
            progressBar.setAttribute('aria-valuenow', value);
            progressBar.textContent = label || `${value}%`;
            
            // Update color based on value
            progressBar.className = 'progress-bar';
            if (value < 30) {
                progressBar.classList.add('bg-danger');
            } else if (value < 70) {
                progressBar.classList.add('bg-warning');
            } else {
                progressBar.classList.add('bg-success');
            }
        }, `progress-${containerId}`);
    }
    
    /**
     * Observe element for visibility changes
     * @param {string} elementId - Element ID to observe
     * @param {Function} callback - Callback when visibility changes
     */
    function observeVisibility(elementId, callback) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Check if already observing
        if (state.observers.has(elementId)) {
            state.observers.get(elementId).disconnect();
        }
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                callback(entry.isIntersecting);
            });
        }, {
            threshold: 0.1
        });
        
        observer.observe(element);
        state.observers.set(elementId, observer);
    }
    
    /**
     * Format number for display
     * @param {number} value - Number to format
     * @param {number} decimals - Decimal places
     * @returns {string} - Formatted number
     */
    function formatNumber(value, decimals = 2) {
        if (typeof value !== 'number' || isNaN(value)) {
            return '---';
        }
        return value.toFixed(decimals);
    }
    
    /**
     * Format duration in seconds to readable string
     * @param {number} seconds - Duration in seconds
     * @returns {string} - Formatted duration
     */
    function formatDuration(seconds) {
        if (!seconds || seconds < 0) return '0s';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
    
    /**
     * Clean up observers and animations
     */
    function cleanup() {
        // Clear update queue
        state.updateQueue = [];
        
        // Disconnect observers
        state.observers.forEach(observer => observer.disconnect());
        state.observers.clear();
        
        // Cancel animations
        state.animations.forEach(id => cancelAnimationFrame(id));
        state.animations.clear();
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Public API
    return {
        // Core update functions
        queueUpdate,
        updateParameter,
        updatePumpStatus,
        updateConnectionStatus,
        
        // UI feedback
        showToast,
        showLoading,
        hideLoading,
        updateProgress,
        
        // Utilities
        observeVisibility,
        formatNumber,
        formatDuration,
        
        // Cleanup
        cleanup
    };
})();

// Make UIManager globally available
window.UIManager = UIManager;

// Alias for showToast for backward compatibility
window.showToast = UIManager.showToast;