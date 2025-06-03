/**
 * Main Dashboard Application for Pool Automation System
 * Integrates all modules and initializes the dashboard
 */

(function() {
    'use strict';
    
    // Application state
    const state = {
        initialized: false,
        activeTab: 'overview-tab',
        charts: {},
        updateIntervals: {},
        selectedPool: null
    };
    
    /**
     * Initialize the dashboard application
     */
    async function initialize() {
        if (state.initialized) return;
        
        try {
            // Show loading
            UIManager.showLoading('Initializing dashboard...');
            
            // Initialize core modules
            SettingsManager.initialize();
            DosingControls.initialize();
            
            // Initialize WebSocket connection
            initializeWebSocket();
            
            // Initialize charts
            initializeCharts();
            
            // Set up event listeners
            setupEventListeners();
            
            // Set up periodic updates
            setupPeriodicUpdates();
            
            // Load initial data
            await loadInitialData();
            
            // Mark as initialized
            state.initialized = true;
            
            // Hide loading
            UIManager.hideLoading();
            
            console.log('Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            UIManager.showToast('Failed to initialize dashboard', 'danger');
            UIManager.hideLoading();
        }
    }
    
    /**
     * Initialize WebSocket connection
     */
    function initializeWebSocket() {
        // Initialize WebSocket manager
        WebSocketManager.initialize();
        
        // Set up WebSocket event handlers
        WebSocketManager.on('sensor_update', handleSensorUpdate);
        WebSocketManager.on('pump_status', handlePumpStatus);
        WebSocketManager.on('dosing_update', handleDosingUpdate);
        WebSocketManager.on('alert', handleAlert);
        WebSocketManager.on('system_status', handleSystemStatus);
        
        // Connection status handlers
        WebSocketManager.on('connection', (data) => {
            UIManager.updateConnectionStatus(data.status === 'connected');
            if (data.status === 'connected') {
                UIManager.showToast('Connected to server', 'success');
                loadDashboardData();
            } else if (data.status === 'disconnected') {
                UIManager.showToast('Disconnected from server', 'warning');
            }
        });
    }
    
    /**
     * Initialize charts
     */
    function initializeCharts() {
        // Create charts based on active tab
        if (document.getElementById('chemistryChart')) {
            state.charts.chemistry = ChartManager.createChemistryChart();
        }
        
        if (document.getElementById('turbidityChart')) {
            state.charts.turbidity = ChartManager.createTurbidityChart();
        }
        
        if (document.getElementById('historyChart')) {
            state.charts.history = ChartManager.createHistoryChart();
        }
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', handleTabChange);
        });
        
        // Mode buttons
        const autoModeBtn = document.getElementById('autoMode');
        const manualModeBtn = document.getElementById('manualMode');
        
        if (autoModeBtn) {
            autoModeBtn.addEventListener('click', () => setSystemMode('automatic'));
        }
        
        if (manualModeBtn) {
            manualModeBtn.addEventListener('click', () => setSystemMode('manual'));
        }
        
        // Pump controls
        setupPumpControls();
        
        // PAC dosing controls
        setupPACDosingControls();
        
        // Settings forms
        setupSettingsForms();
        
        // Chart visibility toggles
        setupChartToggles();
    }
    
    /**
     * Handle tab change
     * @param {Event} event - Click event
     */
    function handleTabChange(event) {
        event.preventDefault();
        
        const targetId = event.target.getAttribute('href').substring(1);
        
        // Update active states
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Show/hide tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        const targetTab = document.getElementById(targetId);
        if (targetTab) {
            targetTab.style.display = 'block';
        }
        
        // Update state
        state.activeTab = targetId;
        
        // Initialize charts for new tab if needed
        if (targetId === 'history-tab' && !state.charts.history) {
            state.charts.history = ChartManager.createHistoryChart();
            loadHistoryData();
        }
    }
    
    /**
     * Set up pump controls
     */
    function setupPumpControls() {
        // pH Pump controls
        const phStartBtn = document.querySelector('#ph-pump-card .btn-start');
        const phStopBtn = document.querySelector('#ph-pump-card .btn-stop');
        
        if (phStartBtn) {
            phStartBtn.addEventListener('click', () => {
                const duration = prompt('Enter duration in seconds (1-300):', '30');
                if (duration && validatePumpDuration(duration)) {
                    controlPump('ph', 'start', parseInt(duration));
                }
            });
        }
        
        if (phStopBtn) {
            phStopBtn.addEventListener('click', () => controlPump('ph', 'stop'));
        }
        
        // Chlorine Pump controls
        const chlorineStartBtn = document.querySelector('#chlorine-pump-card .btn-start');
        const chlorineStopBtn = document.querySelector('#chlorine-pump-card .btn-stop');
        
        if (chlorineStartBtn) {
            chlorineStartBtn.addEventListener('click', () => {
                const duration = prompt('Enter duration in seconds (1-300):', '30');
                if (duration && validatePumpDuration(duration)) {
                    controlPump('chlorine', 'start', parseInt(duration));
                }
            });
        }
        
        if (chlorineStopBtn) {
            chlorineStopBtn.addEventListener('click', () => controlPump('chlorine', 'stop'));
        }
    }
    
    /**
     * Set up PAC dosing controls
     */
    function setupPACDosingControls() {
        // PAC mode buttons
        const pacAutoBtn = document.getElementById('pacAutoMode');
        const pacManualBtn = document.getElementById('pacManualMode');
        
        if (pacAutoBtn) {
            pacAutoBtn.addEventListener('click', () => setPACMode('automatic'));
        }
        
        if (pacManualBtn) {
            pacManualBtn.addEventListener('click', () => setPACMode('manual'));
        }
        
        // Manual dose button
        const manualDoseBtn = document.getElementById('manualDoseBtn');
        if (manualDoseBtn) {
            manualDoseBtn.addEventListener('click', showManualDoseDialog);
        }
        
        // Schedule dose button
        const scheduleDoseBtn = document.getElementById('scheduleDoseBtn');
        if (scheduleDoseBtn) {
            scheduleDoseBtn.addEventListener('click', showScheduleDoseDialog);
        }
        
        // Reset PID button
        const resetPIDBtn = document.getElementById('resetPIDBtn');
        if (resetPIDBtn) {
            resetPIDBtn.addEventListener('click', resetPIDController);
        }
    }
    
    /**
     * Set up settings forms
     */
    function setupSettingsForms() {
        // Chemistry targets form
        const chemistryForm = document.getElementById('chemistryTargetsForm');
        if (chemistryForm) {
            ValidationManager.addRealtimeValidation(chemistryForm, ValidationManager.rules.chemistryTargets);
            
            chemistryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveChemistryTargets(chemistryForm);
            });
        }
        
        // Notification settings form
        const notificationForm = document.getElementById('notificationSettingsForm');
        if (notificationForm) {
            ValidationManager.addRealtimeValidation(notificationForm, ValidationManager.rules.notificationSettings);
            
            notificationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveNotificationSettings(notificationForm);
            });
        }
    }
    
    /**
     * Set up chart visibility toggles
     */
    function setupChartToggles() {
        const toggles = document.querySelectorAll('.chart-series-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const chartId = e.target.dataset.chart;
                const seriesIndex = parseInt(e.target.dataset.series);
                toggleChartSeries(chartId, seriesIndex, e.target.checked);
            });
        });
    }
    
    /**
     * Set up periodic updates
     */
    function setupPeriodicUpdates() {
        // Dashboard data update
        state.updateIntervals.dashboard = setInterval(() => {
            if (WebSocketManager.isConnected()) {
                loadDashboardData();
            }
        }, DashboardConfig.intervals.parameterUpdate);
        
        // Chart update
        state.updateIntervals.charts = setInterval(() => {
            if (WebSocketManager.isConnected()) {
                updateActiveCharts();
            }
        }, DashboardConfig.intervals.chartUpdate);
        
        // Status check
        state.updateIntervals.status = setInterval(() => {
            checkSystemStatus();
        }, DashboardConfig.intervals.statusCheck);
    }
    
    /**
     * Load initial data
     */
    async function loadInitialData() {
        try {
            // Load dashboard data
            await loadDashboardData();
            
            // Load settings
            await loadSettings();
            
            // Load history if on history tab
            if (state.activeTab === 'history-tab') {
                await loadHistoryData();
            }
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            throw error;
        }
    }
    
    /**
     * Load settings from backend
     */
    async function loadSettings() {
        try {
            // Settings are loaded by SettingsManager.initialize()
            console.log('Settings loaded');
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    /**
     * Load history data for charts
     */
    async function loadHistoryData() {
        try {
            const data = await DashboardAPI.dashboard.getHistory(24);
            updateCharts(data);
        } catch (error) {
            console.error('Error loading history data:', error);
        }
    }
    
    /**
     * Update active charts with latest data
     */
    function updateActiveCharts() {
        if (state.activeTab === 'history-tab' && state.charts.history) {
            loadHistoryData();
        }
    }
    
    /**
     * Check system status
     */
    async function checkSystemStatus() {
        try {
            const status = await DashboardAPI.dashboard.getStatus();
            updateSystemStatus(status);
        } catch (error) {
            console.error('Error checking system status:', error);
        }
    }
    
    /**
     * Load dashboard data
     */
    async function loadDashboardData() {
        try {
            const data = await DashboardAPI.dashboard.getData();
            updateDashboard(data);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Use cached data if available
            const cached = localStorage.getItem(DashboardConfig.getStorageKey('lastDashboardData'));
            if (cached) {
                const data = JSON.parse(cached);
                updateDashboard(data);
                UIManager.showToast('Using cached data', 'info');
            }
        }
    }
    
    /**
     * Update dashboard with new data
     * @param {Object} data - Dashboard data
     */
    function updateDashboard(data) {
        if (!data) return;
        
        // Cache data
        localStorage.setItem(
            DashboardConfig.getStorageKey('lastDashboardData'),
            JSON.stringify(data)
        );
        
        // Update parameters
        if (data.parameters) {
            updateParameters(data.parameters);
        }
        
        // Update pump status
        if (data.pumps) {
            updatePumps(data.pumps);
        }
        
        // Update charts
        if (data.history) {
            updateCharts(data.history);
        }
        
        // Update system status
        if (data.status) {
            updateSystemStatus(data.status);
        }
    }
    
    /**
     * Update parameter displays
     * @param {Object} parameters - Parameter values
     */
    function updateParameters(parameters) {
        // Water chemistry parameters
        UIManager.updateParameter('ph-value', parameters.ph, 2);
        UIManager.updateParameter('orp-value', parameters.orp, 0, ' mV');
        UIManager.updateParameter('free-chlorine-value', parameters.freeChlorine, 2, ' mg/L');
        UIManager.updateParameter('combined-chlorine-value', parameters.combinedChlorine, 2, ' mg/L');
        UIManager.updateParameter('temperature-value', parameters.temperature, 1, '�C');
        UIManager.updateParameter('turbidity-value', parameters.turbidity, 3, ' NTU');
    }
    
    /**
     * Update pump status displays
     * @param {Object} pumps - Pump status data
     */
    function updatePumps(pumps) {
        if (pumps.ph) {
            UIManager.updatePumpStatus('ph', pumps.ph);
        }
        
        if (pumps.chlorine) {
            UIManager.updatePumpStatus('chlorine', pumps.chlorine);
        }
        
        if (pumps.pac) {
            UIManager.updatePumpStatus('pac', pumps.pac);
        }
    }
    
    /**
     * Update charts with new data
     * @param {Object} history - Historical data
     */
    function updateCharts(history) {
        // Update chemistry chart
        if (state.charts.chemistry && history.chemistry) {
            ChartManager.update('chemistryChart', {
                labels: history.chemistry.labels,
                datasets: [
                    {
                        label: 'pH',
                        data: history.chemistry.ph
                    },
                    {
                        label: 'Free Chlorine',
                        data: history.chemistry.chlorine
                    }
                ]
            });
        }
        
        // Update turbidity chart
        if (state.charts.turbidity && history.turbidity) {
            ChartManager.update('turbidityChart', {
                labels: history.turbidity.labels,
                datasets: [
                    {
                        label: 'Turbidity (NTU)',
                        data: history.turbidity.values
                    },
                    {
                        label: 'PAC Dosing',
                        data: history.turbidity.dosing
                    }
                ]
            });
        }
    }
    
    /**
     * Update system status display
     * @param {Object} status - System status data
     */
    function updateSystemStatus(status) {
        // Update mode buttons
        const autoBtn = document.getElementById('autoMode');
        const manualBtn = document.getElementById('manualMode');
        
        if (status.mode === 'automatic') {
            autoBtn?.classList.add('active');
            manualBtn?.classList.remove('active');
        } else {
            autoBtn?.classList.remove('active');
            manualBtn?.classList.add('active');
        }
        
        // Update system health indicator
        const healthIndicator = document.getElementById('systemHealth');
        if (healthIndicator && status.health) {
            healthIndicator.textContent = status.health;
            healthIndicator.className = `badge bg-${status.health === 'healthy' ? 'success' : 'warning'}`;
        }
    }
    
    /**
     * Set system mode
     * @param {string} mode - System mode (automatic/manual)
     */
    async function setSystemMode(mode) {
        try {
            // This would call an API to set system mode
            console.log(`Setting system mode to: ${mode}`);
            
            // Update UI immediately for responsiveness
            updateSystemStatus({ mode });
            
            UIManager.showToast(`System mode set to ${mode}`, 'success');
            
        } catch (error) {
            console.error('Error setting system mode:', error);
            UIManager.showToast(`Failed to set mode: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Toggle chart series visibility
     * @param {string} chartId - Chart ID
     * @param {number} seriesIndex - Series index
     * @param {boolean} visible - Visibility state
     */
    function toggleChartSeries(chartId, seriesIndex, visible) {
        const chart = ChartManager.get(chartId);
        if (!chart) return;
        
        const dataset = chart.data.datasets[seriesIndex];
        if (dataset) {
            dataset.hidden = !visible;
            chart.update('none');
            
            // Update axis visibility for history chart
            if (chartId === 'historyChart' && chart.updateAxisVisibility) {
                chart.updateAxisVisibility();
            }
        }
    }
    
    /**
     * Add alert to history (placeholder)
     * @param {Object} alert - Alert data
     */
    function addAlertToHistory(alert) {
        // This could add alerts to a UI list or log
        console.log('Alert received:', alert);
    }
    
    /**
     * Handle sensor update from WebSocket
     * @param {Object} data - Sensor data
     */
    function handleSensorUpdate(data) {
        updateParameters(data);
    }
    
    /**
     * Handle pump status update from WebSocket
     * @param {Object} data - Pump status data
     */
    function handlePumpStatus(data) {
        if (data.pump && data.status) {
            UIManager.updatePumpStatus(data.pump, data.status);
        }
    }
    
    /**
     * Handle dosing update from WebSocket
     * @param {Object} data - Dosing data
     */
    function handleDosingUpdate(data) {
        // Update PAC dosing display
        if (data.mode) {
            const autoBtn = document.getElementById('pacAutoMode');
            const manualBtn = document.getElementById('pacManualMode');
            
            if (data.mode === 'automatic') {
                autoBtn?.classList.add('active');
                manualBtn?.classList.remove('active');
            } else {
                autoBtn?.classList.remove('active');
                manualBtn?.classList.add('active');
            }
        }
        
        // Update dosing status
        if (data.status) {
            const statusElement = document.getElementById('dosingStatus');
            if (statusElement) {
                statusElement.textContent = data.status;
            }
        }
    }
    
    /**
     * Handle alert from WebSocket
     * @param {Object} data - Alert data
     */
    function handleAlert(data) {
        // Alerts are handled by WebSocketManager
        // Add to alert history if needed
        addAlertToHistory(data);
    }
    
    /**
     * Handle system status update
     * @param {Object} data - System status data
     */
    function handleSystemStatus(data) {
        updateSystemStatus(data);
    }
    
    /**
     * Validate pump duration input
     * @param {string} duration - Duration input
     * @returns {boolean} - Valid or not
     */
    function validatePumpDuration(duration) {
        const result = ValidationManager.validateDuration(duration, {
            minDuration: 1,
            maxDuration: 300
        });
        
        if (!result.valid) {
            UIManager.showToast(result.error, 'danger');
            return false;
        }
        
        return true;
    }
    
    /**
     * Control pump
     * @param {string} pump - Pump type
     * @param {string} command - Command (start/stop)
     * @param {number} duration - Duration in seconds
     */
    async function controlPump(pump, command, duration) {
        try {
            UIManager.showLoading(`${command}ing ${pump} pump...`);
            
            const response = await DashboardAPI.pumps[`control${pump.charAt(0).toUpperCase() + pump.slice(1)}`](
                command,
                duration
            );
            
            UIManager.hideLoading();
            UIManager.showToast(`${pump} pump ${command}ed successfully`, 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to ${command} ${pump} pump: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Clean up on page unload
     */
    function cleanup() {
        // Clear intervals
        Object.values(state.updateIntervals).forEach(interval => clearInterval(interval));
        
        // Disconnect WebSocket
        WebSocketManager.disconnect();
        
        // Destroy charts
        ChartManager.destroyAll();
        
        // Clean up UI
        UIManager.cleanup();
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Expose necessary functions for debugging
    window.DashboardApp = {
        state,
        reload: loadDashboardData,
        resetCharts: () => {
            ChartManager.destroyAll();
            initializeCharts();
        }
    };
    
})();