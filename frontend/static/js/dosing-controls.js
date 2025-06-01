/**
 * Dosing Controls module for Pool Automation Dashboard
 * Handles manual dosing operations and PAC system control
 */

const DosingControls = (function() {
    'use strict';
    
    // Dosing state
    const state = {
        dosing: {
            ph: { active: false, startTime: null, duration: 0 },
            chlorine: { active: false, startTime: null, duration: 0 },
            pac: { active: false, mode: 'automatic', flowRate: 75 }
        },
        timers: {}
    };
    
    /**
     * Initialize dosing controls
     */
    function initialize() {
        setupEventListeners();
        loadDosingState();
        updateDosingUI();
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // pH Pump controls
        const phStartBtn = document.getElementById('phPumpStart');
        const phStopBtn = document.getElementById('phPumpStop');
        
        if (phStartBtn) phStartBtn.addEventListener('click', () => showDosingDialog('ph'));
        if (phStopBtn) phStopBtn.addEventListener('click', () => stopDosing('ph'));
        
        // Chlorine Pump controls
        const chlorineStartBtn = document.getElementById('chlorinePumpStart');
        const chlorineStopBtn = document.getElementById('chlorinePumpStop');
        
        if (chlorineStartBtn) chlorineStartBtn.addEventListener('click', () => showDosingDialog('chlorine'));
        if (chlorineStopBtn) chlorineStopBtn.addEventListener('click', () => stopDosing('chlorine'));
        
        // PAC controls
        const pacAutoBtn = document.getElementById('pacAutoMode');
        const pacManualBtn = document.getElementById('pacManualMode');
        const manualDoseBtn = document.getElementById('manualDoseBtn');
        const scheduleDoseBtn = document.getElementById('scheduleDoseBtn');
        const resetPIDBtn = document.getElementById('resetPIDBtn');
        
        if (pacAutoBtn) pacAutoBtn.addEventListener('click', () => setPACMode('automatic'));
        if (pacManualBtn) pacManualBtn.addEventListener('click', () => setPACMode('manual'));
        if (manualDoseBtn) manualDoseBtn.addEventListener('click', showManualDoseDialog);
        if (scheduleDoseBtn) scheduleDoseBtn.addEventListener('click', showScheduleDoseDialog);
        if (resetPIDBtn) resetPIDBtn.addEventListener('click', resetPIDController);
        
        // Listen for WebSocket dosing updates
        if (window.WebSocketManager) {
            WebSocketManager.on('dosing_update', handleDosingUpdate);
            WebSocketManager.on('pump_status', handlePumpStatusUpdate);
        }
    }
    
    /**
     * Show dosing dialog for pH or Chlorine
     * @param {string} pumpType - 'ph' or 'chlorine'
     */
    function showDosingDialog(pumpType) {
        const pumpConfig = DashboardConfig.pumps[pumpType];
        const defaultDuration = pumpConfig?.defaultDuration || 30;
        
        const modal = createDosingModal(pumpType, defaultDuration);
        document.body.appendChild(modal);
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Clean up modal after hiding
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }
    
    /**
     * Create dosing modal dialog
     * @param {string} pumpType - Pump type
     * @param {number} defaultDuration - Default duration
     * @returns {HTMLElement} - Modal element
     */
    function createDosingModal(pumpType, defaultDuration) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Start ${pumpType.toUpperCase()} Dosing</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="dosingForm">
                            <div class="mb-3">
                                <label class="form-label">Duration (seconds)</label>
                                <input type="number" class="form-control" id="dosingDuration" 
                                       value="${defaultDuration}" min="1" max="300" required>
                                <div class="form-text">Enter duration between 1 and 300 seconds</div>
                            </div>
                            <div class="alert alert-info">
                                <strong>Safety Notice:</strong> Manual dosing will override automatic controls. 
                                Monitor water parameters closely after dosing.
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirmDosingBtn">Start Dosing</button>
                    </div>
                </div>
            </div>
        `;
        
        // Set up form validation
        const form = modal.querySelector('#dosingForm');
        const confirmBtn = modal.querySelector('#confirmDosingBtn');
        
        ValidationManager.addRealtimeValidation(form, {
            dosingDuration: ValidationManager.rules.pumpControl.duration
        });
        
        confirmBtn.addEventListener('click', async () => {
            const duration = parseInt(modal.querySelector('#dosingDuration').value);
            const validation = ValidationManager.validateDuration(duration, { minDuration: 1, maxDuration: 300 });
            
            if (!validation.valid) {
                UIManager.showToast(validation.error, 'danger');
                return;
            }
            
            bootstrap.Modal.getInstance(modal).hide();
            await startDosing(pumpType, duration);
        });
        
        return modal;
    }
    
    /**
     * Start dosing operation
     * @param {string} pumpType - Pump type
     * @param {number} duration - Duration in seconds
     */
    async function startDosing(pumpType, duration) {
        try {
            UIManager.showLoading(`Starting ${pumpType} dosing...`);
            
            // Call API
            let response;
            if (pumpType === 'ph') {
                response = await DashboardAPI.pumps.controlPH('start', duration);
            } else if (pumpType === 'chlorine') {
                response = await DashboardAPI.pumps.controlChlorine('start', duration);
            }
            
            // Update local state
            state.dosing[pumpType] = {
                active: true,
                startTime: Date.now(),
                duration: duration
            };
            
            // Start local timer
            startDosingTimer(pumpType, duration);
            
            // Update UI
            updateDosingUI();
            
            UIManager.hideLoading();
            UIManager.showToast(`${pumpType.toUpperCase()} dosing started for ${duration}s`, 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to start ${pumpType} dosing: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Stop dosing operation
     * @param {string} pumpType - Pump type
     */
    async function stopDosing(pumpType) {
        try {
            UIManager.showLoading(`Stopping ${pumpType} dosing...`);
            
            // Call API
            let response;
            if (pumpType === 'ph') {
                response = await DashboardAPI.pumps.controlPH('stop');
            } else if (pumpType === 'chlorine') {
                response = await DashboardAPI.pumps.controlChlorine('stop');
            }
            
            // Update local state
            state.dosing[pumpType].active = false;
            
            // Clear timer
            if (state.timers[pumpType]) {
                clearInterval(state.timers[pumpType]);
                delete state.timers[pumpType];
            }
            
            // Update UI
            updateDosingUI();
            
            UIManager.hideLoading();
            UIManager.showToast(`${pumpType.toUpperCase()} dosing stopped`, 'info');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to stop ${pumpType} dosing: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Set PAC dosing mode
     * @param {string} mode - 'automatic' or 'manual'
     */
    async function setPACMode(mode) {
        try {
            const response = await DashboardAPI.dosing.setMode(mode);
            
            state.dosing.pac.mode = mode;
            updatePACModeUI(mode);
            
            UIManager.showToast(`PAC dosing mode set to ${mode}`, 'success');
            
        } catch (error) {
            UIManager.showToast(`Failed to set PAC mode: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Show manual PAC dose dialog
     */
    function showManualDoseDialog() {
        const modal = createManualDoseModal();
        document.body.appendChild(modal);
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }
    
    /**
     * Create manual PAC dose modal
     * @returns {HTMLElement} - Modal element
     */
    function createManualDoseModal() {
        const pacConfig = DashboardConfig.pumps.pac;
        const defaultDuration = pacConfig?.defaultDuration || 30;
        const defaultFlowRate = pacConfig?.defaultFlowRate || 75;
        
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Manual PAC Dosing</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="manualDoseForm">
                            <div class="mb-3">
                                <label class="form-label">Duration (seconds)</label>
                                <input type="number" class="form-control" id="manualDoseDuration" 
                                       value="${defaultDuration}" min="1" max="600" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Flow Rate (ml/h)</label>
                                <input type="number" class="form-control" id="manualDoseFlowRate" 
                                       value="${defaultFlowRate}" min="60" max="150" required>
                            </div>
                            <div class="alert alert-warning">
                                <strong>Manual Override:</strong> This will temporarily override automatic PAC dosing. 
                                Automatic mode will resume after the manual dose completes.
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-warning" id="confirmManualDoseBtn">Start Manual Dose</button>
                    </div>
                </div>
            </div>
        `;
        
        // Set up validation
        const form = modal.querySelector('#manualDoseForm');
        ValidationManager.addRealtimeValidation(form, ValidationManager.rules.pacDosing);
        
        const confirmBtn = modal.querySelector('#confirmManualDoseBtn');
        confirmBtn.addEventListener('click', async () => {
            const duration = parseInt(modal.querySelector('#manualDoseDuration').value);
            const flowRate = parseInt(modal.querySelector('#manualDoseFlowRate').value);
            
            const validation = ValidationManager.validateForm({
                duration,
                flow_rate: flowRate
            }, ValidationManager.rules.pacDosing);
            
            if (!validation.valid) {
                ValidationManager.displayFormErrors(form, validation.errors);
                return;
            }
            
            bootstrap.Modal.getInstance(modal).hide();
            await startManualPACDose(duration, flowRate);
        });
        
        return modal;
    }
    
    /**
     * Start manual PAC dose
     * @param {number} duration - Duration in seconds
     * @param {number} flowRate - Flow rate in ml/h
     */
    async function startManualPACDose(duration, flowRate) {
        try {
            UIManager.showLoading('Starting manual PAC dose...');
            
            const response = await DashboardAPI.dosing.manualDose(duration, flowRate);
            
            UIManager.hideLoading();
            UIManager.showToast(`Manual PAC dose started: ${duration}s at ${flowRate}ml/h`, 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to start manual PAC dose: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Show schedule dose dialog
     */
    function showScheduleDoseDialog() {
        const modal = createScheduleDoseModal();
        document.body.appendChild(modal);
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }
    
    /**
     * Create schedule dose modal
     * @returns {HTMLElement} - Modal element
     */
    function createScheduleDoseModal() {
        // Get current time + 1 hour as default
        const defaultTime = new Date();
        defaultTime.setHours(defaultTime.getHours() + 1);
        const timeString = defaultTime.toISOString().slice(0, 16);
        
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Schedule PAC Dose</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="scheduleDoseForm">
                            <div class="mb-3">
                                <label class="form-label">Scheduled Time</label>
                                <input type="datetime-local" class="form-control" id="scheduleDateTime" 
                                       value="${timeString}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Duration (seconds)</label>
                                <input type="number" class="form-control" id="scheduleDuration" 
                                       value="30" min="1" max="600" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Flow Rate (ml/h)</label>
                                <input type="number" class="form-control" id="scheduleFlowRate" 
                                       value="75" min="60" max="150" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirmScheduleBtn">Schedule Dose</button>
                    </div>
                </div>
            </div>
        `;
        
        const confirmBtn = modal.querySelector('#confirmScheduleBtn');
        confirmBtn.addEventListener('click', async () => {
            const datetime = modal.querySelector('#scheduleDateTime').value;
            const duration = parseInt(modal.querySelector('#scheduleDuration').value);
            const flowRate = parseInt(modal.querySelector('#scheduleFlowRate').value);
            
            if (!datetime || !duration || !flowRate) {
                UIManager.showToast('Please fill in all fields', 'warning');
                return;
            }
            
            bootstrap.Modal.getInstance(modal).hide();
            await scheduleDosingOperation(datetime, duration, flowRate);
        });
        
        return modal;
    }
    
    /**
     * Schedule dosing operation
     * @param {string} datetime - ISO datetime string
     * @param {number} duration - Duration in seconds
     * @param {number} flowRate - Flow rate in ml/h
     */
    async function scheduleDosingOperation(datetime, duration, flowRate) {
        try {
            UIManager.showLoading('Scheduling PAC dose...');
            
            const timestamp = new Date(datetime).getTime();
            const response = await DashboardAPI.dosing.schedule(timestamp, duration, flowRate);
            
            UIManager.hideLoading();
            UIManager.showToast(`PAC dose scheduled for ${new Date(datetime).toLocaleString()}`, 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to schedule dose: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Reset PID controller
     */
    async function resetPIDController() {
        const confirmed = confirm('Reset PID controller? This will clear the integral and derivative terms.');
        
        if (!confirmed) return;
        
        try {
            UIManager.showLoading('Resetting PID controller...');
            
            const response = await DashboardAPI.dosing.resetPID();
            
            UIManager.hideLoading();
            UIManager.showToast('PID controller reset successfully', 'success');
            
        } catch (error) {
            UIManager.hideLoading();
            UIManager.showToast(`Failed to reset PID: ${error.message}`, 'danger');
        }
    }
    
    /**
     * Start dosing timer
     * @param {string} pumpType - Pump type
     * @param {number} duration - Duration in seconds
     */
    function startDosingTimer(pumpType, duration) {
        let remaining = duration;
        
        state.timers[pumpType] = setInterval(() => {
            remaining--;
            
            // Update UI with remaining time
            const timeElement = document.getElementById(`${pumpType}DosingTime`);
            if (timeElement) {
                timeElement.textContent = `${remaining}s remaining`;
            }
            
            if (remaining <= 0) {
                // Dosing complete
                state.dosing[pumpType].active = false;
                clearInterval(state.timers[pumpType]);
                delete state.timers[pumpType];
                updateDosingUI();
                
                UIManager.showToast(`${pumpType.toUpperCase()} dosing completed`, 'info');
            }
        }, 1000);
    }
    
    /**
     * Handle dosing update from WebSocket
     * @param {Object} data - Dosing update data
     */
    function handleDosingUpdate(data) {
        if (data.pump && data.status) {
            const pumpType = data.pump;
            const isActive = data.status.running;
            
            state.dosing[pumpType].active = isActive;
            
            if (!isActive && state.timers[pumpType]) {
                clearInterval(state.timers[pumpType]);
                delete state.timers[pumpType];
            }
            
            updateDosingUI();
        }
        
        if (data.pac) {
            state.dosing.pac.mode = data.pac.mode;
            updatePACModeUI(data.pac.mode);
        }
    }
    
    /**
     * Handle pump status update from WebSocket
     * @param {Object} data - Pump status data
     */
    function handlePumpStatusUpdate(data) {
        if (data.pump && (data.pump === 'ph' || data.pump === 'chlorine')) {
            UIManager.updatePumpStatus(data.pump, data.status);
        }
    }
    
    /**
     * Update dosing UI
     */
    function updateDosingUI() {
        // Update pH dosing UI
        updatePumpDosingUI('ph');
        updatePumpDosingUI('chlorine');
    }
    
    /**
     * Update pump dosing UI
     * @param {string} pumpType - Pump type
     */
    function updatePumpDosingUI(pumpType) {
        const isActive = state.dosing[pumpType].active;
        
        const startBtn = document.getElementById(`${pumpType}PumpStart`);
        const stopBtn = document.getElementById(`${pumpType}PumpStop`);
        const statusElement = document.getElementById(`${pumpType}DosingStatus`);
        
        if (startBtn) startBtn.disabled = isActive;
        if (stopBtn) stopBtn.disabled = !isActive;
        
        if (statusElement) {
            statusElement.textContent = isActive ? 'Running' : 'Stopped';
            statusElement.className = `badge ${isActive ? 'bg-success' : 'bg-secondary'}`;
        }
    }
    
    /**
     * Update PAC mode UI
     * @param {string} mode - PAC mode
     */
    function updatePACModeUI(mode) {
        const autoBtn = document.getElementById('pacAutoMode');
        const manualBtn = document.getElementById('pacManualMode');
        
        if (autoBtn && manualBtn) {
            if (mode === 'automatic') {
                autoBtn.classList.add('active');
                manualBtn.classList.remove('active');
            } else {
                autoBtn.classList.remove('active');
                manualBtn.classList.add('active');
            }
        }
        
        // Enable/disable manual controls based on mode
        const manualDoseBtn = document.getElementById('manualDoseBtn');
        if (manualDoseBtn) {
            manualDoseBtn.disabled = mode === 'automatic';
        }
    }
    
    /**
     * Load dosing state from storage
     */
    function loadDosingState() {
        const saved = localStorage.getItem(DashboardConfig.getStorageKey('dosingState'));
        if (saved) {
            try {
                const savedState = JSON.parse(saved);
                Object.assign(state.dosing, savedState);
            } catch (error) {
                console.error('Error loading dosing state:', error);
            }
        }
    }
    
    /**
     * Save dosing state to storage
     */
    function saveDosingState() {
        localStorage.setItem(
            DashboardConfig.getStorageKey('dosingState'),
            JSON.stringify(state.dosing)
        );
    }
    
    // Save state on changes
    window.addEventListener('beforeunload', saveDosingState);
    
    // Public API
    return {
        initialize,
        startDosing,
        stopDosing,
        setPACMode,
        resetPIDController,
        getState: () => ({ ...state })
    };
})();

// Make DosingControls globally available
window.DosingControls = DosingControls;