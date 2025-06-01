/**
 * Configuration module for Pool Automation Dashboard
 */

const DashboardConfig = (function() {
    'use strict';
    
    // Environment detection
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    const isDevelopment = isLocalhost || window.location.hostname.includes('dev');
    const isProduction = !isDevelopment;
    
    // Base configuration
    const config = {
        environment: isDevelopment ? 'development' : 'production',
        debug: isDevelopment,
        
        // API Configuration
        api: {
            baseUrl: isLocalhost 
                ? 'http://localhost:5000'
                : `${window.location.protocol}//${window.location.host}`,
            timeout: 30000, // 30 seconds
            retryAttempts: 3,
            retryDelay: 1000 // 1 second
        },
        
        // Socket.IO Configuration
        socket: {
            url: isLocalhost
                ? 'http://localhost:5000'
                : `${window.location.protocol}//${window.location.host}`,
            options: {
                transports: ['polling', 'websocket'],
                forceNew: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                autoConnect: true
            }
        },
        
        // Update intervals (milliseconds)
        intervals: {
            parameterUpdate: 5000,      // 5 seconds
            chartUpdate: 10000,         // 10 seconds
            statusCheck: 30000,         // 30 seconds
            simulationUpdate: 5000      // 5 seconds
        },
        
        // Chart configuration
        charts: {
            maxDataPoints: 100,
            defaultTimeRange: 24, // hours
            animationDuration: isDevelopment ? 750 : 0,
            responsive: true,
            maintainAspectRatio: false
        },
        
        // Parameter thresholds
        thresholds: {
            ph: { min: 6.8, max: 8.0, targetMin: 7.2, targetMax: 7.6 },
            orp: { min: 600, max: 800, targetMin: 650, targetMax: 750 },
            freeChlorine: { min: 0.5, max: 3.0, targetMin: 1.0, targetMax: 2.0 },
            combinedChlorine: { min: 0, max: 0.5, targetMax: 0.3 },
            turbidity: { min: 0.05, max: 0.5, targetMin: 0.12, targetMax: 0.25 },
            temperature: { min: 20, max: 32, targetMin: 26, targetMax: 30 }
        },
        
        // Pump configuration
        pumps: {
            ph: {
                defaultFlowRate: 120, // ml/h
                minFlowRate: 10,
                maxFlowRate: 500,
                defaultDuration: 30 // seconds
            },
            chlorine: {
                defaultFlowRate: 150, // ml/h
                minFlowRate: 10,
                maxFlowRate: 500,
                defaultDuration: 30 // seconds
            },
            pac: {
                defaultFlowRate: 75, // ml/h
                minFlowRate: 60,
                maxFlowRate: 150,
                defaultDuration: 30 // seconds
            }
        },
        
        // UI Configuration
        ui: {
            toastDuration: 3000, // 3 seconds
            toastDurationError: 5000, // 5 seconds for errors
            debounceDelay: 250, // milliseconds
            throttleDelay: 100, // milliseconds
            animationSpeed: 300 // milliseconds
        },
        
        // Storage keys
        storage: {
            prefix: 'poolAutomation_',
            keys: {
                systemConfig: 'systemConfig',
                notificationSettings: 'notificationSettings',
                chemistryTargets: 'chemistryTargets',
                pumpConfig: 'pumpConfig',
                turbiditySettings: 'turbiditySettings',
                retentionSettings: 'retentionSettings',
                lastDashboardData: 'lastDashboardData',
                authToken: 'authToken',
                userPreferences: 'userPreferences'
            }
        },
        
        // Feature flags
        features: {
            enableWebSocket: true,
            enableSimulation: isDevelopment,
            enableNotifications: true,
            enableDataExport: true,
            enableAdvancedSettings: true,
            enableDebugMode: isDevelopment
        },
        
        // Validation rules
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
        }
    };
    
    // Helper functions
    function getStorageKey(key) {
        return config.storage.prefix + (config.storage.keys[key] || key);
    }
    
    function getApiEndpoint(endpoint) {
        return config.api.baseUrl + endpoint;
    }
    
    function isFeatureEnabled(feature) {
        return config.features[feature] === true;
    }
    
    function getThreshold(parameter, type = 'target') {
        const threshold = config.thresholds[parameter];
        if (!threshold) return null;
        
        if (type === 'target') {
            return {
                min: threshold.targetMin || threshold.min,
                max: threshold.targetMax || threshold.max
            };
        }
        return threshold;
    }
    
    function updateConfig(updates) {
        // Deep merge updates into config
        mergeDeep(config, updates);
        
        // Save to localStorage if needed
        if (updates.persist) {
            localStorage.setItem(
                getStorageKey('config'),
                JSON.stringify(config)
            );
        }
    }
    
    function mergeDeep(target, source) {
        const isObject = (obj) => obj && typeof obj === 'object';
        
        if (!isObject(target) || !isObject(source)) {
            return source;
        }
        
        Object.keys(source).forEach(key => {
            const targetValue = target[key];
            const sourceValue = source[key];
            
            if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                target[key] = targetValue.concat(sourceValue);
            } else if (isObject(targetValue) && isObject(sourceValue)) {
                target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
            } else {
                target[key] = sourceValue;
            }
        });
        
        return target;
    }
    
    // Load saved configuration overrides
    function loadSavedConfig() {
        try {
            const savedConfig = localStorage.getItem(getStorageKey('config'));
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                mergeDeep(config, parsed);
            }
        } catch (error) {
            console.error('Error loading saved config:', error);
        }
    }
    
    // Initialize
    loadSavedConfig();
    
    // Public API
    return {
        get: () => deepClone(config),
        getApiEndpoint,
        getStorageKey,
        isFeatureEnabled,
        getThreshold,
        updateConfig,
        
        // Shortcuts
        api: config.api,
        socket: config.socket,
        intervals: config.intervals,
        charts: config.charts,
        thresholds: config.thresholds,
        pumps: config.pumps,
        ui: config.ui,
        features: config.features,
        
        // Environment checks
        isDevelopment,
        isProduction,
        isLocalhost
    };
})();

// Make config globally available
window.DashboardConfig = DashboardConfig;