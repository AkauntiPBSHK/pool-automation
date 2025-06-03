/**
 * Settings management module for Pool Automation Dashboard
 * Handles all configuration forms and settings persistence
 */

const SettingsManager = (function() {
    'use strict';
    
    // Settings state
    const state = {
        settings: {},
        isDirty: false,
        formHandlers: new Map()
    };
    
    /**
     * Initialize settings module
     */
    function initialize() {
        setupFormHandlers();
        loadSavedSettings();
        updateUIFromSettings();
        setupAutoSave();
    }
    
    /**
     * Set up form event handlers
     */
    function setupFormHandlers() {
        // Chemistry targets form
        const chemistryForm = document.getElementById('chemistryTargetsForm');
        if (chemistryForm) {
            ValidationManager.addRealtimeValidation(chemistryForm, ValidationManager.rules.chemistryTargets);
            chemistryForm.addEventListener('submit', handleChemistryTargetsSubmit);
        }
        
        // Notification settings form
        const notificationForm = document.getElementById('notificationSettingsForm');
        if (notificationForm) {
            ValidationManager.addRealtimeValidation(notificationForm, ValidationManager.rules.notificationSettings);
            notificationForm.addEventListener('submit', handleNotificationSettingsSubmit);
        }
        
        // System config form
        const systemForm = document.getElementById('systemConfigForm');
        if (systemForm) {
            systemForm.addEventListener('submit', handleSystemConfigSubmit);
        }
        
        // Pump config form
        const pumpForm = document.getElementById('pumpConfigForm');
        if (pumpForm) {
            pumpForm.addEventListener('submit', handlePumpConfigSubmit);
        }
        
        // Turbidity settings form
        const turbidityForm = document.getElementById('turbiditySettingsForm');
        if (turbidityForm) {
            turbidityForm.addEventListener('submit', handleTurbiditySettingsSubmit);
        }
        
        // Data retention form
        const retentionForm = document.getElementById('retentionSettingsForm');
        if (retentionForm) {
            retentionForm.addEventListener('submit', handleRetentionSettingsSubmit);
        }
        
        // Import/Export buttons
        const exportBtn = document.getElementById('exportSettingsBtn');
        const importBtn = document.getElementById('importSettingsBtn');
        const importFile = document.getElementById('importSettingsFile');
        
        if (exportBtn) exportBtn.addEventListener('click', exportSettings);
        if (importBtn) importBtn.addEventListener('click', () => importFile?.click());
        if (importFile) importFile.addEventListener('change', handleImportFile);
        
        // Reset/Clear buttons
        const resetBtn = document.getElementById('resetSettingsBtn');
        const clearBtn = document.getElementById('clearDataBtn');
        
        if (resetBtn) resetBtn.addEventListener('click', confirmResetSettings);
        if (clearBtn) clearBtn.addEventListener('click', confirmClearData);
        
        // Test notification button
        const testNotificationBtn = document.getElementById('testNotificationBtn');
        if (testNotificationBtn) {
            testNotificationBtn.addEventListener('click', testNotificationSettings);
        }
    }
    
    /**
     * Handle chemistry targets form submission
     * @param {Event} event - Submit event
     */
    async function handleChemistryTargetsSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const validation = ValidationManager.validateForm(formData, ValidationManager.rules.chemistryTargets);
        
        if (!validation.valid) {
            ValidationManager.displayFormErrors(event.target, validation.errors);
            return;
        }
        
        try {
            UIManager.showLoading('Saving chemistry targets...');
            
            const settings = {
                ph: {
                    min: validation.values.ph_min,
                    max: validation.values.ph_max
                },
                chlorine: {
                    min: validation.values.chlorine_min,
                    max: validation.values.chlorine_max
                },
                orp: {
                    min: validation.values.orp_min || 650,
                    max: validation.values.orp_max || 750
                },
                turbidity: {
                    target: validation.values.turbidity_target || 0.15
                }
            };
            
            // Save to backend
            const response = await DashboardAPI.request('/api/settings/chemistry-targets', {
                method: 'POST',
                body: settings
            });
            
            // Update local storage
            saveSettingLocal('chemistryTargets', settings);
            
            // Update config thresholds
            DashboardConfig.updateConfig({
                thresholds: {
                    ph: settings.ph,
                    freeChlorine: settings.chlorine,
                    combinedChlorine: settings.chlorine,
                    orp: settings.orp,
                    turbidity: { ...DashboardConfig.thresholds.turbidity, targetMin: settings.turbidity.target }
                }
            });
            
            UIManager.hideLoading();
            UIManager.showToast('Chemistry targets saved successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to save chemistry targets: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Handle notification settings form submission
     * @param {Event} event - Submit event
     */
    async function handleNotificationSettingsSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const validation = ValidationManager.validateForm(formData, ValidationManager.rules.notificationSettings);
        
        if (!validation.valid) {
            ValidationManager.displayFormErrors(event.target, validation.errors);
            return;
        }
        
        try {
            UIManager.showLoading('Saving notification settings...');
            
            const settings = {
                email: validation.values.email,
                emailEnabled: formData.get('emailEnabled') === 'on',
                alertThreshold: validation.values.alert_threshold,
                alertTypes: {
                    parameterOutOfRange: formData.get('alertParameterOutOfRange') === 'on',
                    pumpFailure: formData.get('alertPumpFailure') === 'on',
                    connectionLoss: formData.get('alertConnectionLoss') === 'on',
                    systemError: formData.get('alertSystemError') === 'on'
                }
            };
            
            // Save to backend
            await DashboardAPI.settings.updateNotifications(settings);
            
            // Save locally
            saveSettingLocal('notificationSettings', settings);
            
            UIManager.hideLoading();
            UIManager.showToast('Notification settings saved successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to save notification settings: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Handle system config form submission
     * @param {Event} event - Submit event
     */
    async function handleSystemConfigSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        try {
            UIManager.showLoading('Saving system configuration...');
            
            const settings = {
                systemName: formData.get('systemName'),
                location: formData.get('location'),
                poolVolume: parseFloat(formData.get('poolVolume')),
                pumpCycleInterval: parseInt(formData.get('pumpCycleInterval')),
                sensorReadingInterval: parseInt(formData.get('sensorReadingInterval')),
                maintenanceMode: formData.get('maintenanceMode') === 'on',
                debugMode: formData.get('debugMode') === 'on'
            };
            
            // Save to backend
            const response = await DashboardAPI.request('/api/settings/system-config', {
                method: 'POST',
                body: settings
            });
            
            // Save locally
            saveSettingLocal('systemConfig', settings);
            
            // Update intervals if changed
            if (settings.sensorReadingInterval !== DashboardConfig.intervals.parameterUpdate) {
                DashboardConfig.updateConfig({
                    intervals: {
                        ...DashboardConfig.intervals,
                        parameterUpdate: settings.sensorReadingInterval * 1000
                    }
                });
            }
            
            UIManager.hideLoading();
            UIManager.showToast('System configuration saved successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to save system configuration: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Handle pump config form submission
     * @param {Event} event - Submit event
     */
    async function handlePumpConfigSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        try {
            UIManager.showLoading('Saving pump configuration...');
            
            const settings = {
                ph: {
                    defaultFlowRate: parseInt(formData.get('phFlowRate')),
                    defaultDuration: parseInt(formData.get('phDuration')),
                    maxDailyRuntime: parseInt(formData.get('phMaxRuntime'))
                },
                chlorine: {
                    defaultFlowRate: parseInt(formData.get('chlorineFlowRate')),
                    defaultDuration: parseInt(formData.get('chlorineDuration')),
                    maxDailyRuntime: parseInt(formData.get('chlorineMaxRuntime'))
                },
                pac: {
                    defaultFlowRate: parseInt(formData.get('pacFlowRate')),
                    defaultDuration: parseInt(formData.get('pacDuration')),
                    maxDailyRuntime: parseInt(formData.get('pacMaxRuntime')),
                    autoMode: formData.get('pacAutoMode') === 'on'
                }
            };
            
            // Save to backend
            const response = await DashboardAPI.request('/api/settings/pump-config', {
                method: 'POST',
                body: settings
            });
            
            // Save locally
            saveSettingLocal('pumpConfig', settings);
            
            // Update config
            DashboardConfig.updateConfig({ pumps: settings });
            
            UIManager.hideLoading();
            UIManager.showToast('Pump configuration saved successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to save pump configuration: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Handle turbidity settings form submission
     * @param {Event} event - Submit event
     */
    async function handleTurbiditySettingsSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        try {
            UIManager.showLoading('Saving turbidity settings...');
            
            const settings = {
                targetTurbidity: parseFloat(formData.get('targetTurbidity')),
                highThreshold: parseFloat(formData.get('highThreshold')),
                lowThreshold: parseFloat(formData.get('lowThreshold')),
                dosingSensitivity: parseFloat(formData.get('dosingSensitivity')),
                pidSettings: {
                    kp: parseFloat(formData.get('pidKp')),
                    ki: parseFloat(formData.get('pidKi')),
                    kd: parseFloat(formData.get('pidKd'))
                }
            };
            
            // Save to backend
            const response = await DashboardAPI.request('/api/settings/turbidity', {
                method: 'POST',
                body: settings
            });
            
            // Save locally
            saveSettingLocal('turbiditySettings', settings);
            
            UIManager.hideLoading();
            UIManager.showToast('Turbidity settings saved successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to save turbidity settings: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Handle retention settings form submission
     * @param {Event} event - Submit event
     */
    async function handleRetentionSettingsSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        try {
            UIManager.showLoading('Saving retention settings...');
            
            const settings = {
                dataRetentionDays: parseInt(formData.get('dataRetention')),
                eventRetentionDays: parseInt(formData.get('eventRetention')),
                autoCleanup: formData.get('autoCleanup') === 'on',
                compressionEnabled: formData.get('compressionEnabled') === 'on'
            };
            
            // Save to backend
            const response = await DashboardAPI.request('/api/settings/retention', {
                method: 'POST',
                body: settings
            });
            
            // Save locally
            saveSettingLocal('retentionSettings', settings);
            
            UIManager.hideLoading();
            UIManager.showToast('Retention settings saved successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to save retention settings: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Test notification settings
     */
    async function testNotificationSettings() {
        const email = document.getElementById('notificationEmail')?.value;
        
        if (!email) {
            UIManager.showToast('Please enter an email address first', 'warning');
            return;
        }
        
        try {
            UIManager.showLoading('Sending test notification...');
            
            await DashboardAPI.settings.testNotification(email);
            
            UIManager.hideLoading();
            UIManager.showToast('Test notification sent successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to send test notification: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Export all settings to JSON file
     */
    async function exportSettings() {
        try {
            const allSettings = {
                ...state.settings,
                exportDate: new Date().toISOString(),
                systemInfo: {
                    version: '1.0.0',
                    environment: DashboardConfig.environment
                }
            };
            
            const blob = new Blob([JSON.stringify(allSettings, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pool-automation-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            UIManager.showToast('Settings exported successfully', 'success');
            
        } catch (error) {
            UIManager.showToast(`Failed to export settings: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Handle settings import file
     * @param {Event} event - File input change event
     */
    async function handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const settings = JSON.parse(text);
            
            // Validate settings structure
            if (!validateImportedSettings(settings)) {
                throw new Error('Invalid settings file format');
            }
            
            // Confirm import
            const confirmed = confirm(
                'This will replace all current settings. Are you sure you want to continue?'
            );
            
            if (!confirmed) return;
            
            UIManager.showLoading('Importing settings...');
            
            // Apply settings
            await applyImportedSettings(settings);
            
            UIManager.hideLoading();
            UIManager.showToast('Settings imported successfully', 'success');
            
            // Reload page to apply changes
            setTimeout(() => window.location.reload(), 1000);
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to import settings: ${error.message}`, 'danger');
        }
        
        // Clear file input
        event.target.value = '';
    }
    
    /**
     * Confirm and reset all settings
     */
    async function confirmResetSettings() {
        const confirmed = confirm(
            'This will reset all settings to their default values. This action cannot be undone. Are you sure?'
        );
        
        if (!confirmed) return;
        
        try {
            UIManager.showLoading('Resetting settings...');
            
            // Clear local storage
            Object.keys(DashboardConfig.storage.keys).forEach(key => {
                localStorage.removeItem(DashboardConfig.getStorageKey(key));
            });
            
            // Reset backend settings
            await DashboardAPI.request('/api/settings/reset', { method: 'POST' });
            
            UIManager.hideLoading();
            UIManager.showToast('Settings reset successfully', 'success');
            
            // Reload page
            setTimeout(() => window.location.reload(), 1000);
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to reset settings: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Confirm and clear historical data
     */
    async function confirmClearData() {
        const confirmed = confirm(
            'This will permanently delete all historical sensor data and events. This action cannot be undone. Are you sure?'
        );
        
        if (!confirmed) return;
        
        try {
            UIManager.showLoading('Clearing historical data...');
            
            // Clear backend data
            await DashboardAPI.request('/api/data/clear', { method: 'POST' });
            
            UIManager.hideLoading();
            UIManager.showToast('Historical data cleared successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to clear data: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Load saved settings from storage
     */
    function loadSavedSettings() {
        // Get config from the config module
        const config = window.DashboardConfig.get();
        if (config && config.storage && config.storage.keys) {
            Object.keys(config.storage.keys).forEach(key => {
                const stored = localStorage.getItem(window.DashboardConfig.getStorageKey(key));
                if (stored) {
                    try {
                        state.settings[key] = JSON.parse(stored);
                    } catch (error) {
                        console.error(`Error loading setting ${key}:`, error);
                    }
                }
            });
        }
    }
    
    /**
     * Update UI elements from saved settings
     */
    function updateUIFromSettings() {
        // Update chemistry targets
        if (state.settings.chemistryTargets) {
            const settings = state.settings.chemistryTargets;
            updateFormField('ph_min', settings.ph?.min);
            updateFormField('ph_max', settings.ph?.max);
            updateFormField('chlorine_min', settings.chlorine?.min);
            updateFormField('chlorine_max', settings.chlorine?.max);
        }
        
        // Update notification settings
        if (state.settings.notificationSettings) {
            const settings = state.settings.notificationSettings;
            updateFormField('notificationEmail', settings.email);
            updateFormField('emailEnabled', settings.emailEnabled);
            updateFormField('alert_threshold', settings.alertThreshold);
        }
        
        // Update other settings...
        updateOtherSettingsUI();
    }
    
    /**
     * Update form field value
     * @param {string} fieldId - Field ID
     * @param {*} value - Field value
     */
    function updateFormField(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (!field || value === undefined) return;
        
        if (field.type === 'checkbox') {
            field.checked = !!value;
        } else {
            field.value = value;
        }
    }
    
    /**
     * Save setting to local storage
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    function saveSettingLocal(key, value) {
        state.settings[key] = value;
        localStorage.setItem(DashboardConfig.getStorageKey(key), JSON.stringify(value));
    }
    
    /**
     * Set up auto-save for form changes
     */
    function setupAutoSave() {
        // Auto-save on form input changes
        document.addEventListener('input', debounce((event) => {
            if (event.target.form && event.target.form.dataset.autoSave) {
                state.isDirty = true;
                // Auto-save logic here if needed
            }
        }, 1000));
    }
    
    /**
     * Validate imported settings structure
     * @param {Object} settings - Imported settings
     * @returns {boolean} - Valid or not
     */
    function validateImportedSettings(settings) {
        // Basic validation of settings structure
        return settings && typeof settings === 'object';
    }
    
    /**
     * Apply imported settings
     * @param {Object} settings - Settings to apply
     */
    async function applyImportedSettings(settings) {
        // Apply each setting category
        for (const [key, value] of Object.entries(settings)) {
            if (key === 'exportDate' || key === 'systemInfo') continue;
            
            saveSettingLocal(key, value);
            
            // Also send to backend
            try {
                await DashboardAPI.request(`/api/settings/${key}`, {
                    method: 'POST',
                    body: value
                });
            } catch (error) {
                console.error(`Failed to save ${key} to backend:`, error);
            }
        }
    }
    
    /**
     * Update other settings UI elements
     */
    function updateOtherSettingsUI() {
        // System config
        if (state.settings.systemConfig) {
            const settings = state.settings.systemConfig;
            updateFormField('systemName', settings.systemName);
            updateFormField('location', settings.location);
            updateFormField('poolVolume', settings.poolVolume);
        }
        
        // Pump config
        if (state.settings.pumpConfig) {
            const settings = state.settings.pumpConfig;
            updateFormField('phFlowRate', settings.ph?.defaultFlowRate);
            updateFormField('phDuration', settings.ph?.defaultDuration);
            updateFormField('chlorineFlowRate', settings.chlorine?.defaultFlowRate);
        }
        
        // Add other setting updates as needed
    }
    
    // Public API
    return {
        initialize,
        loadSavedSettings,
        exportSettings,
        getSetting: (key) => state.settings[key],
        setSetting: saveSettingLocal,
        isDirty: () => state.isDirty
    };
})();

// Make SettingsManager globally available
window.SettingsManager = SettingsManager;