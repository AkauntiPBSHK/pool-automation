/**
 * Improved API call function with better error handling and timeout options
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options (method, headers, etc.)
 * @param {Function} onSuccess - Success callback function
 * @param {Function} onError - Error callback function
 * @param {Object} retryOptions - Retry configuration {maxRetries, delay, timeout}
 * @returns {Promise} - The fetch promise
 */
function apiCall(url, options = {}, onSuccess, onError, retryOptions = { maxRetries: 2, delay: 1000, timeout: 10000 }) {
    // Set default headers if not provided
    if (!options.headers) {
        options.headers = {
            'Content-Type': 'application/json'
        };
    }
    
    // Add abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), retryOptions.timeout);
    
    if (!options.signal) {
        options.signal = controller.signal;
    }
    
    // Update status bar with loading message
    updateStatusBar('Loading data...', 'info');
    
    // Show loading state on relevant containers
    showLoading('.card, .chart-container');
    
    // Create a function for retry logic
    const fetchWithRetry = (retriesLeft) => {
        return fetch(url, options)
            .then(response => {
                clearTimeout(timeoutId);
                
                // Check response status and categorize errors
                if (!response.ok) {
                    const errorType = categorizeHttpError(response.status);
                    throw new Error(`${errorType} error: ${response.status} - ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Hide loading states
                hideLoading('.card, .chart-container');
                updateStatusBar('Data loaded successfully', 'success');
                
                // Call success callback if provided
                if (typeof onSuccess === 'function') {
                    onSuccess(data);
                }
                return data;
            })
            .catch(error => {
                clearTimeout(timeoutId);
                
                // Handle specific abort error (timeout)
                if (error.name === 'AbortError') {
                    console.error(`Request timeout after ${retryOptions.timeout}ms`);
                    updateStatusBar('Request timed out. Retrying...', 'warning');
                } else {
                    console.error(`API Error (${url}):`, error);
                }
                
                // Retry logic
                if (retriesLeft > 0) {
                    console.log(`Retrying... (${retriesLeft} retries left)`);
                    updateStatusBar(`Connection issue. Retrying... (${retriesLeft})`, 'warning');
                    
                    // Wait before retrying
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(fetchWithRetry(retriesLeft - 1));
                        }, retryOptions.delay);
                    });
                } else {
                    // Hide loading states
                    hideLoading('.card, .chart-container');
                    updateStatusBar('Error connecting to server. Using simulation mode.', 'danger');
                    
                    // Call error callback if provided
                    if (typeof onError === 'function') {
                        onError(error);
                    }
                    
                    // Fall back to simulation mode
                    simulateDataChanges();
                    throw error;
                }
            });
    };
    
    // Start the fetch with retry logic
    return fetchWithRetry(retryOptions.maxRetries);
}

/**
 * Show loading state for specified elements
 * @param {string|Element} selector - CSS selector or DOM element
 */
function showLoading(selector) {
    if (!selector) return;
    
    let elements = [];
    
    if (typeof selector === 'string') {
        // It's a CSS selector string
        elements = document.querySelectorAll(selector);
    } else if (selector instanceof Element) {
        // It's a DOM element
        elements = [selector];
    } else if (selector.length) {
        // It might be a NodeList or array of elements
        elements = selector;
    }
    
    // Add loading class to all elements
    Array.from(elements).forEach(element => {
        element.classList.add('loading');
    });
}

/**
 * Hide loading state for specified elements
 * @param {string|Element} selector - CSS selector or DOM element
 */
function hideLoading(selector) {
    if (!selector) return;
    
    let elements = [];
    
    if (typeof selector === 'string') {
        // It's a CSS selector string
        elements = document.querySelectorAll(selector);
    } else if (selector instanceof Element) {
        // It's a DOM element
        elements = [selector];
    } else if (selector.length) {
        // It might be a NodeList or array of elements
        elements = selector;
    }
    
    // Remove loading class from all elements
    Array.from(elements).forEach(element => {
        element.classList.remove('loading');
    });
}

/**
 * Enhance keyboard navigation for the sidebar tabs
 */
function enhanceSidebarAccessibility() {
    const navLinks = document.querySelectorAll('#sidebar .nav-link');
    
    // Make the sidebar tabs operate like a tablist for keyboard users
    navLinks.forEach((link, index) => {
        // Add role and aria attributes
        link.setAttribute('role', 'tab');
        link.setAttribute('aria-selected', link.classList.contains('active') ? 'true' : 'false');
        link.setAttribute('tabindex', link.classList.contains('active') ? '0' : '-1');
        link.setAttribute('id', `sidebar-tab-${index}`);
        
        // Get the target content area
        const targetId = link.getAttribute('href');
        const targetPanel = document.querySelector(targetId);
        
        if (targetPanel) {
            // Set the panel's accessibility attributes
            targetPanel.setAttribute('role', 'tabpanel');
            targetPanel.setAttribute('aria-labelledby', `sidebar-tab-${index}`);
            targetPanel.setAttribute('tabindex', '0');
        }
        
        // Add keyboard event handling
        link.addEventListener('keydown', (e) => {
            // Arrow keys for navigation
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevLink = index > 0 ? navLinks[index - 1] : navLinks[navLinks.length - 1];
                prevLink.click();
                prevLink.focus();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                const nextLink = index < navLinks.length - 1 ? navLinks[index + 1] : navLinks[0];
                nextLink.click();
                nextLink.focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                navLinks[0].click();
                navLinks[0].focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                navLinks[navLinks.length - 1].click();
                navLinks[navLinks.length - 1].focus();
            }
        });
    });
}

/**
 * Add ARIA attributes to all parameter cards
 */
function enhanceParameterCardsAccessibility() {
    // Add descriptive labels to parameter cards
    const parameterDescriptions = {
        'ph': 'pH measures the acidity or alkalinity of the water. The optimal range for pool water is typically between 7.2 and 7.6.',
        'orp': 'ORP (Oxidation-Reduction Potential) measures the sanitizing power of the water. Higher values indicate better sanitization.',
        'freeChlorine': 'Free chlorine is the active sanitizing form of chlorine in the water. The optimal range is typically between 1.0 and 3.0 mg/L.',
        'turbidity': 'Turbidity measures water clarity. Lower values indicate clearer water.',
        'temp': 'Water temperature affects swimmer comfort and chemical reactions in the pool.'
    };
    
    // Add descriptions to each parameter card
    Object.keys(parameterDescriptions).forEach(param => {
        const valueElement = document.getElementById(`${param}Value`);
        if (valueElement) {
            const card = valueElement.closest('.card');
            if (card) {
                card.setAttribute('aria-label', parameterDescriptions[param]);
                card.setAttribute('tabindex', '0');
            }
        }
    });
    
    // Make parameter cards focusable and add keyboard events
    document.querySelectorAll('.card').forEach(card => {
        if (!card.getAttribute('tabindex')) {
            card.setAttribute('tabindex', '0');
        }
        
        // Add descriptive help text that's visually hidden but accessible to screen readers
        if (!card.querySelector('.sr-only-description')) {
            const paramType = card.querySelector('.card-title')?.textContent.toLowerCase();
            if (paramType && parameterDescriptions[paramType]) {
                const description = document.createElement('div');
                description.className = 'sr-only';
                description.textContent = parameterDescriptions[paramType];
                card.appendChild(description);
            }
        }
    });
}

/**
 * Enhance accessibility for control buttons and forms
 */
function enhanceControlsAccessibility() {
    // Add descriptive labels to buttons
    document.querySelectorAll('button').forEach(button => {
        if (!button.getAttribute('aria-label') && !button.textContent.trim()) {
            // For icon-only buttons, add aria-label
            const icon = button.querySelector('.bi');
            if (icon) {
                const iconClass = Array.from(icon.classList)
                    .find(cls => cls.startsWith('bi-'));
                
                if (iconClass) {
                    // Generate a descriptive label from the icon class
                    const iconName = iconClass.replace('bi-', '').replace(/-/g, ' ');
                    button.setAttribute('aria-label', iconName);
                }
            }
        }
    });
    
    // Add aria-controls attributes to buttons that control specific panels
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(button => {
        const targetId = button.getAttribute('href') || button.getAttribute('data-bs-target');
        if (targetId) {
            button.setAttribute('aria-controls', targetId.replace('#', ''));
        }
    });
    
    // Enhance form controls with better labels and descriptions
    document.querySelectorAll('form').forEach(form => {
        form.querySelectorAll('input, select, textarea').forEach(input => {
            // Ensure form controls have associated labels
            const id = input.getAttribute('id');
            if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                if (!label) {
                    // Create a label if missing
                    const newLabel = document.createElement('label');
                    newLabel.setAttribute('for', id);
                    newLabel.textContent = id.replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase());
                    
                    input.parentNode.insertBefore(newLabel, input);
                }
            }
            
            // Add aria-describedby for inputs with help text
            const helpText = input.nextElementSibling;
            if (helpText && helpText.classList.contains('form-text')) {
                const helpId = `${id}-help`;
                helpText.setAttribute('id', helpId);
                input.setAttribute('aria-describedby', helpId);
            }
        });
    });
}

/**
 * Categorize HTTP errors for better error handling
 * @param {number} status - HTTP status code
 * @returns {string} - Error category
 */
function categorizeHttpError(status) {
    if (status >= 400 && status < 500) {
        return "Client";
    } else if (status >= 500) {
        return "Server";
    } else {
        return "Unknown";
    }
}

// Add to utility.js
function enhanceMobileResponsiveness() {
    // Get device type
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 992;
    
    // Apply mobile optimizations
    if (isMobile) {
        // Simplify charts for better performance
        document.querySelectorAll('canvas').forEach(canvas => {
            const chartInstance = Chart.getChart(canvas);
            if (chartInstance) {
                // Reduce data points for performance
                if (chartInstance.data && chartInstance.data.datasets) {
                    chartInstance.data.datasets.forEach(dataset => {
                        if (dataset.pointRadius) dataset.pointRadius = 1;
                        if (dataset.borderWidth) dataset.borderWidth = 1;
                    });
                }
                
                // Reduce font sizes
                if (chartInstance.options && chartInstance.options.plugins && 
                    chartInstance.options.plugins.legend) {
                    chartInstance.options.plugins.legend.labels.font.size = 10;
                }
                
                // Limit axis ticks
                if (chartInstance.options && chartInstance.options.scales && 
                    chartInstance.options.scales.x) {
                    chartInstance.options.scales.x.ticks.maxTicksLimit = 5;
                }
                
                chartInstance.update();
            }
        });
        
        // Make cards simpler
        document.querySelectorAll('.card').forEach(card => {
            // Remove some padding
            card.querySelectorAll('.card-body').forEach(body => {
                body.classList.add('p-2');
                body.classList.remove('p-3', 'p-4');
            });
            
            // Collapse some sections that aren't critical
            card.querySelectorAll('.card-body > div:not(:first-child)').forEach(div => {
                if (!div.classList.contains('essential')) {
                    div.classList.add('collapse-mobile');
                }
            });
        });
        
        // Add a mobile menu toggle
        if (!document.getElementById('mobile-menu-toggle')) {
            const toggle = document.createElement('button');
            toggle.id = 'mobile-menu-toggle';
            toggle.className = 'btn btn-primary position-fixed';
            toggle.style.cssText = 'bottom: 20px; right: 20px; z-index: 1000; border-radius: 50%; width: 50px; height: 50px;';
            toggle.innerHTML = '<i class="bi bi-list"></i>';
            toggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('show-mobile');
                }
            });
            document.body.appendChild(toggle);
        }
    } else {
        // Remove mobile-specific elements if window was resized
        const toggle = document.getElementById('mobile-menu-toggle');
        if (toggle) toggle.remove();
        
        // Remove collapse classes
        document.querySelectorAll('.collapse-mobile').forEach(el => {
            el.classList.remove('collapse-mobile');
        });
    }
}

// Call on load and resize
window.addEventListener('load', enhanceMobileResponsiveness);
window.addEventListener('resize', enhanceMobileResponsiveness);

// Missing loading functions that dashboard.js calls
function showLoading(message = 'Loading...') {
    console.log('showLoading:', message);
    // Create or update loading overlay
    let loadingOverlay = document.getElementById('loading-overlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="loading-message mt-2">${message}</div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        const messageEl = loadingOverlay.querySelector('.loading-message');
        if (messageEl) messageEl.textContent = message;
    }
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    console.log('hideLoading');
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Make them available globally
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// Global date formatting function to avoid duplication
function formatDate(date) {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}
window.formatDate = formatDate;

// Note: The following enhancement functions are implemented in dashboard.js:
// - updateAllRangeAriaAttributes
// - enhanceInitializeHistoryChart
// - enhanceChartInitialization
// - setupDosingEventsToggle
// - enhanceSyncParameterSelection
// - enhanceHistoryChartInit
// - fixDosingEventsToggle
// They are called from dashboard.js after it loads, so they don't need to be defined here.