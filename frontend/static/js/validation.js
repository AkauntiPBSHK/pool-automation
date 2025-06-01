/**
 * Validation module for Pool Automation Dashboard
 * Provides input validation, form handling, and data validation utilities
 */

const ValidationManager = (function() {
    'use strict';
    
    // Configuration
    const config = window.DashboardConfig || {
        validation: {
            email: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
            number: /^-?\d+\.?\d*$/,
            positiveNumber: /^\d+\.?\d*$/,
            password: {
                minLength: 8,
                requireUppercase: true,
                requireLowercase: true,
                requireNumber: true,
                requireSpecial: false
            }
        },
        thresholds: {}
    };
    
    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {Object} - Validation result
     */
    function validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return { valid: false, error: 'Email is required' };
        }
        
        const trimmed = email.trim();
        if (!config.validation.email.test(trimmed)) {
            return { valid: false, error: 'Invalid email format' };
        }
        
        return { valid: true, value: trimmed };
    }
    
    /**
     * Validate password
     * @param {string} password - Password to validate
     * @returns {Object} - Validation result
     */
    function validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: 'Password is required' };
        }
        
        const rules = config.validation.password;
        const errors = [];
        
        if (password.length < rules.minLength) {
            errors.push(`Password must be at least ${rules.minLength} characters`);
        }
        
        if (rules.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        
        if (rules.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        
        if (rules.requireNumber && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        
        if (rules.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        
        if (errors.length > 0) {
            return { valid: false, error: errors.join('. ') };
        }
        
        return { valid: true };
    }
    
    /**
     * Validate numeric value
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @returns {Object} - Validation result
     */
    function validateNumber(value, options = {}) {
        const {
            min = -Infinity,
            max = Infinity,
            positive = false,
            integer = false,
            required = true
        } = options;
        
        // Handle empty values
        if (value === '' || value === null || value === undefined) {
            if (required) {
                return { valid: false, error: 'Value is required' };
            }
            return { valid: true, value: null };
        }
        
        // Convert to number
        const num = parseFloat(value);
        
        if (isNaN(num)) {
            return { valid: false, error: 'Must be a valid number' };
        }
        
        if (positive && num < 0) {
            return { valid: false, error: 'Must be a positive number' };
        }
        
        if (integer && !Number.isInteger(num)) {
            return { valid: false, error: 'Must be a whole number' };
        }
        
        if (num < min) {
            return { valid: false, error: `Must be at least ${min}` };
        }
        
        if (num > max) {
            return { valid: false, error: `Must be at most ${max}` };
        }
        
        return { valid: true, value: num };
    }
    
    /**
     * Validate parameter value against thresholds
     * @param {string} parameter - Parameter name
     * @param {number} value - Value to validate
     * @returns {Object} - Validation result with status
     */
    function validateParameter(parameter, value) {
        const result = validateNumber(value);
        if (!result.valid) return result;
        
        const threshold = config.thresholds[parameter];
        if (!threshold) {
            return { ...result, status: 'unknown' };
        }
        
        const num = result.value;
        let status = 'normal';
        let warning = null;
        
        // Check against absolute limits
        if (num < threshold.min || num > threshold.max) {
            status = 'danger';
            warning = `${parameter} is outside safe range (${threshold.min}-${threshold.max})`;
        }
        // Check against target range
        else if (threshold.targetMin && threshold.targetMax) {
            if (num < threshold.targetMin || num > threshold.targetMax) {
                status = 'warning';
                warning = `${parameter} is outside optimal range (${threshold.targetMin}-${threshold.targetMax})`;
            }
        }
        
        return {
            valid: true,
            value: num,
            status,
            warning,
            inRange: status === 'normal',
            threshold
        };
    }
    
    /**
     * Validate pump flow rate
     * @param {string} pumpType - Type of pump (ph, chlorine, pac)
     * @param {number} flowRate - Flow rate to validate
     * @returns {Object} - Validation result
     */
    function validateFlowRate(pumpType, flowRate) {
        const pumpConfig = config.pumps?.[pumpType];
        if (!pumpConfig) {
            return { valid: false, error: 'Invalid pump type' };
        }
        
        return validateNumber(flowRate, {
            min: pumpConfig.minFlowRate,
            max: pumpConfig.maxFlowRate,
            positive: true,
            required: true
        });
    }
    
    /**
     * Validate duration in seconds
     * @param {number} duration - Duration to validate
     * @param {Object} options - Validation options
     * @returns {Object} - Validation result
     */
    function validateDuration(duration, options = {}) {
        const {
            minDuration = 1,
            maxDuration = 3600, // 1 hour default max
            required = true
        } = options;
        
        return validateNumber(duration, {
            min: minDuration,
            max: maxDuration,
            positive: true,
            integer: true,
            required
        });
    }
    
    /**
     * Validate form data
     * @param {HTMLFormElement|Object} formOrData - Form element or data object
     * @param {Object} rules - Validation rules
     * @returns {Object} - Validation result with errors
     */
    function validateForm(formOrData, rules) {
        const data = formOrData instanceof HTMLFormElement
            ? new FormData(formOrData)
            : formOrData;
        
        const errors = {};
        const values = {};
        let isValid = true;
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = data instanceof FormData
                ? data.get(field)
                : data[field];
            
            let result;
            
            // Apply validation based on rule type
            if (typeof rule === 'function') {
                result = rule(value);
            } else if (rule.type === 'email') {
                result = validateEmail(value);
            } else if (rule.type === 'password') {
                result = validatePassword(value);
            } else if (rule.type === 'number') {
                result = validateNumber(value, rule);
            } else if (rule.type === 'parameter') {
                result = validateParameter(rule.parameter, value);
            } else if (rule.type === 'flowRate') {
                result = validateFlowRate(rule.pump, value);
            } else if (rule.type === 'duration') {
                result = validateDuration(value, rule);
            } else if (rule.type === 'custom' && rule.validator) {
                result = rule.validator(value, data);
            } else {
                result = { valid: true, value };
            }
            
            if (!result.valid) {
                errors[field] = result.error;
                isValid = false;
            } else {
                values[field] = result.value;
            }
        }
        
        return {
            valid: isValid,
            errors,
            values
        };
    }
    
    /**
     * Display validation errors on form
     * @param {HTMLFormElement} form - Form element
     * @param {Object} errors - Validation errors
     */
    function displayFormErrors(form, errors) {
        if (!form) return;
        
        // Clear existing errors
        clearFormErrors(form);
        
        // Display new errors
        for (const [field, error] of Object.entries(errors)) {
            const input = form.elements[field];
            if (!input) continue;
            
            // Add error class
            input.classList.add('is-invalid');
            
            // Create or update error message
            let errorElement = input.nextElementSibling;
            if (!errorElement || !errorElement.classList.contains('invalid-feedback')) {
                errorElement = document.createElement('div');
                errorElement.className = 'invalid-feedback';
                input.parentNode.insertBefore(errorElement, input.nextSibling);
            }
            
            errorElement.textContent = error;
            errorElement.style.display = 'block';
        }
    }
    
    /**
     * Clear form validation errors
     * @param {HTMLFormElement} form - Form element
     */
    function clearFormErrors(form) {
        if (!form) return;
        
        // Remove error classes
        form.querySelectorAll('.is-invalid').forEach(element => {
            element.classList.remove('is-invalid');
        });
        
        // Hide error messages
        form.querySelectorAll('.invalid-feedback').forEach(element => {
            element.style.display = 'none';
        });
    }
    
    /**
     * Add real-time validation to form inputs
     * @param {HTMLFormElement} form - Form element
     * @param {Object} rules - Validation rules
     */
    function addRealtimeValidation(form, rules) {
        if (!form) return;
        
        for (const [field, rule] of Object.entries(rules)) {
            const input = form.elements[field];
            if (!input) continue;
            
            // Debounced validation handler
            const validateInput = debounce(() => {
                const result = validateField(field, input.value, rule);
                
                if (result.valid) {
                    input.classList.remove('is-invalid');
                    input.classList.add('is-valid');
                    
                    const feedback = input.nextElementSibling;
                    if (feedback && feedback.classList.contains('invalid-feedback')) {
                        feedback.style.display = 'none';
                    }
                } else {
                    input.classList.remove('is-valid');
                    displayFormErrors(form, { [field]: result.error });
                }
            }, 300);
            
            // Add event listeners
            input.addEventListener('input', validateInput);
            input.addEventListener('blur', validateInput);
        }
    }
    
    /**
     * Validate single field
     * @param {string} field - Field name
     * @param {*} value - Field value
     * @param {Object} rule - Validation rule
     * @returns {Object} - Validation result
     */
    function validateField(field, value, rule) {
        if (typeof rule === 'function') {
            return rule(value);
        }
        
        switch (rule.type) {
            case 'email':
                return validateEmail(value);
            case 'password':
                return validatePassword(value);
            case 'number':
                return validateNumber(value, rule);
            case 'parameter':
                return validateParameter(rule.parameter, value);
            case 'flowRate':
                return validateFlowRate(rule.pump, value);
            case 'duration':
                return validateDuration(value, rule);
            case 'custom':
                return rule.validator ? rule.validator(value) : { valid: true, value };
            default:
                return { valid: true, value };
        }
    }
    
    /**
     * Sanitize form data
     * @param {Object} data - Data to sanitize
     * @returns {Object} - Sanitized data
     */
    function sanitizeFormData(data) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                // Escape HTML for text fields
                sanitized[key] = escapeHtml(value.trim());
            } else if (typeof value === 'number') {
                // Ensure numbers are valid
                sanitized[key] = isNaN(value) ? 0 : value;
            } else if (value === null || value === undefined) {
                sanitized[key] = '';
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    /**
     * Create validation rules for common forms
     */
    const commonRules = {
        login: {
            email: { type: 'email' },
            password: { type: 'password' }
        },
        
        pumpControl: {
            duration: {
                type: 'duration',
                minDuration: 1,
                maxDuration: 300 // 5 minutes max
            }
        },
        
        pacDosing: {
            duration: {
                type: 'duration',
                minDuration: 1,
                maxDuration: 600 // 10 minutes max
            },
            flow_rate: {
                type: 'flowRate',
                pump: 'pac'
            }
        },
        
        chemistryTargets: {
            ph_min: {
                type: 'number',
                min: 6.0,
                max: 8.5,
                required: true
            },
            ph_max: {
                type: 'number',
                min: 6.0,
                max: 8.5,
                required: true,
                validator: (value, data) => {
                    const min = parseFloat(data.ph_min || 0);
                    const max = parseFloat(value);
                    if (max <= min) {
                        return { valid: false, error: 'Max pH must be greater than min pH' };
                    }
                    return { valid: true, value: max };
                }
            },
            chlorine_min: {
                type: 'number',
                min: 0,
                max: 5,
                required: true
            },
            chlorine_max: {
                type: 'number',
                min: 0,
                max: 5,
                required: true,
                validator: (value, data) => {
                    const min = parseFloat(data.chlorine_min || 0);
                    const max = parseFloat(value);
                    if (max <= min) {
                        return { valid: false, error: 'Max chlorine must be greater than min chlorine' };
                    }
                    return { valid: true, value: max };
                }
            }
        },
        
        notificationSettings: {
            email: { type: 'email' },
            alert_threshold: {
                type: 'number',
                min: 1,
                max: 60,
                integer: true,
                required: true
            }
        }
    };
    
    // Public API
    return {
        // Core validation functions
        validateEmail,
        validatePassword,
        validateNumber,
        validateParameter,
        validateFlowRate,
        validateDuration,
        
        // Form validation
        validateForm,
        displayFormErrors,
        clearFormErrors,
        addRealtimeValidation,
        sanitizeFormData,
        
        // Common validation rules
        rules: commonRules,
        
        // Utility functions
        isValid: (result) => result && result.valid === true,
        getError: (result) => result && result.error || null,
        getValue: (result) => result && result.value !== undefined ? result.value : null
    };
})();

// Make ValidationManager globally available
window.ValidationManager = ValidationManager;