/**
 * Utility function for making API calls with consistent error handling and retry capability
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options (method, headers, etc.)
 * @param {Function} onSuccess - Success callback function
 * @param {Function} onError - Error callback function
 * @param {Object} retryOptions - Retry configuration {maxRetries, delay}
 * @returns {Promise} - The fetch promise
 */
function apiCall(url, options = {}, onSuccess, onError, retryOptions = { maxRetries: 2, delay: 1000 }) {
    // Set default headers if not provided
    if (!options.headers) {
        options.headers = {
            'Content-Type': 'application/json'
        };
    }
    
    // Show status bar loading message
    updateStatusBar('Loading data...', 'info');
    
    // Apply loading state to relevant containers
    const containers = document.querySelectorAll('.card, .chart-container');
    containers.forEach(container => container.classList.add(container.classList.contains('chart-container') ? 'chart-loading' : 'card-loading'));
    
    // Create a function for retry logic
    const fetchWithRetry = (retriesLeft) => {
        return fetch(url, options)
            .then(response => {
                // Check if response is ok (status in the range 200-299)
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Remove loading states
                containers.forEach(container => container.classList.remove(container.classList.contains('chart-container') ? 'chart-loading' : 'card-loading'));
                updateStatusBar('Data loaded successfully', 'success');
                
                // Call success callback if provided
                if (typeof onSuccess === 'function') {
                    onSuccess(data);
                }
                return data;
            })
            .catch(error => {
                console.error(`API Error (${url}):`, error);
                
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
                    // Remove loading states
                    containers.forEach(container => container.classList.remove(container.classList.contains('chart-container') ? 'chart-loading' : 'card-loading'));
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
 * @param {string} selector - CSS selector for elements to show loading state
 */
function showLoading(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
        // Determine loading class based on element type
        let loadingClass = 'loading';
        if (element.classList.contains('card')) {
            loadingClass = 'card-loading';
        } else if (element.classList.contains('chart-container')) {
            loadingClass = 'chart-loading';
        }
        
        // Add loading class
        element.classList.add(loadingClass);
        
        // For chart containers, add spinner if needed
        if (element.classList.contains('chart-container') && !element.querySelector('.spinner-container')) {
            const spinner = document.createElement('div');
            spinner.className = 'spinner-container';
            spinner.innerHTML = '<div class="spinner"></div>';
            element.appendChild(spinner);
        }
    });
}

/**
 * Hide loading state for specified elements
 * @param {string} selector - CSS selector for elements to hide loading state
 */
function hideLoading(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
        // Remove all possible loading classes
        element.classList.remove('loading', 'card-loading', 'chart-loading');
        
        // Remove spinner if present
        const spinner = element.querySelector('.spinner-container');
        if (spinner) {
            spinner.remove();
        }
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