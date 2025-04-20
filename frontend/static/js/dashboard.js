/**
 * Pool Automation Dashboard JavaScript
 */

// Mock data for simulation mode
const mockData = {
    ph: 7.4,
    orp: 720,
    freeChlorine: 1.2,
    combinedChlorine: 0.2,
    turbidity: 0.14,
    temperature: 28.2,
    uvIntensity: 94,
    phPumpRunning: false,
    clPumpRunning: false,
    pacPumpRunning: false,
    pacDosingRate: 75 // Default value in ml/h
};

// Connect to Socket.IO
const socket = io();

// Global variables for charts
let chemistryChart = null;

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    // Initialize navigation
    initializeNavigation();
    
    // Setup mode toggle event listeners
    document.getElementById('autoMode').addEventListener('click', function() {
        console.log('Switching to automatic mode');
        setMode('automatic');
    });
    
    document.getElementById('manualMode').addEventListener('click', function() {
        console.log('Switching to manual mode');
        setMode('manual');
    });
    
    document.getElementById('refreshBtn').addEventListener('click', function() {
        console.log('Refreshing data');
        fetchStatus();
        updateParameterDisplays(mockData);
    });
    
    // Initialize water chemistry section
    initializeWaterChemistryControls();

    // Initialize turbidity & PAC section
    initializeTurbidityPACControls();
    
    // Initialize history tab
    initializeHistoryTab();

    // Initialize settings tab
    initializeSettingsTab();

    // Initial data fetch
    fetchStatus();
    
    // Load initial data
    updateParameterDisplays(mockData);
    
    // Setup socket events
    socket.on('connect', function() {
        console.log('Connected to server');
        updateStatusBar('Connected to server', 'success');
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        updateStatusBar('Disconnected from server', 'danger');
    });
    
    // Set up simulation data updates
    if (getParameterByName('simulate') !== 'false') {
        setInterval(simulateDataChanges, 5000);
    }
});

/**
 * Initialize navigation between tabs
 */
function initializeNavigation() {
    // Add event listeners to nav links
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the target tab ID
            const targetId = this.getAttribute('href');
            console.log('Navigating to:', targetId);
            
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.style.display = 'none';
            });
            
            // Show the target tab
            if (targetId && document.querySelector(targetId)) {
                document.querySelector(targetId).style.display = 'block';
            }
            
            // Update active state in navigation
            document.querySelectorAll('#sidebar .nav-link').forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
}

/**
 * Initialize water chemistry controls
 */
function initializeWaterChemistryControls() {
    // Initialize mode-dependent controls
    updateControlsBasedOnMode();
    
    // Add event listeners to dose buttons
    document.getElementById('phDoseBtn').addEventListener('click', function() {
        const duration = document.getElementById('phDoseDuration').value;
        startPHDosing(duration);
    });
    
    document.getElementById('phStopBtn').addEventListener('click', function() {
        stopPHDosing();
    });
    
    document.getElementById('clDoseBtn').addEventListener('click', function() {
        const duration = document.getElementById('clDoseDuration').value;
        startCLDosing(duration);
    });
    
    document.getElementById('clStopBtn').addEventListener('click', function() {
        stopCLDosing();
    });
    
    // Initialize chart
    initializeChemistryChart();
    
    // Add event listener for time range change
    document.getElementById('chemistryTimeRange').addEventListener('change', function() {
        updateChemistryChart(this.value);
    });
}

/**
 * Update manual controls based on operation mode
 */
function updateControlsBasedOnMode() {
    const isManualMode = document.getElementById('manualMode').classList.contains('active');
    
    // Enable or disable control buttons based on mode
    document.getElementById('phDoseBtn').disabled = !isManualMode;
    document.getElementById('phStopBtn').disabled = !isManualMode;
    document.getElementById('clDoseBtn').disabled = !isManualMode;
    document.getElementById('clStopBtn').disabled = !isManualMode;
    
    // Update help text if needed
    if (isManualMode) {
        // Any manual mode specific UI updates
    } else {
        // Any automatic mode specific UI updates
    }

    // Update Turbidity & PAC controls
    updateTurbidityPACControlsBasedOnMode();
}

/**
 * Simulate starting pH dosing
 */
function startPHDosing(duration) {
    mockData.phPumpRunning = true;
    updatePumpStatus('phPump', true);
    updatePumpStatus('phPumpDetail', true);
    
    // Show toast notification
    showToast(`pH dosing started for ${duration} seconds`);
    
    // Auto-stop after duration
    setTimeout(() => {
        stopPHDosing();
    }, duration * 1000);
}

/**
 * Simulate stopping pH dosing
 */
function stopPHDosing() {
    mockData.phPumpRunning = false;
    updatePumpStatus('phPump', false);
    updatePumpStatus('phPumpDetail', false);
    
    // Show toast notification
    showToast('pH dosing stopped');
}

/**
 * Simulate starting chlorine dosing
 */
function startCLDosing(duration) {
    mockData.clPumpRunning = true;
    updatePumpStatus('clPump', true);
    updatePumpStatus('clPumpDetail', true);
    
    // Show toast notification
    showToast(`Chlorine dosing started for ${duration} seconds`);
    
    // Auto-stop after duration
    setTimeout(() => {
        stopCLDosing();
    }, duration * 1000);
}

/**
 * Simulate stopping chlorine dosing
 */
function stopCLDosing() {
    mockData.clPumpRunning = false;
    updatePumpStatus('clPump', false);
    updatePumpStatus('clPumpDetail', false);
    
    // Show toast notification
    showToast('Chlorine dosing stopped');
}

/**
 * Show a toast notification
 */
function showToast(message) {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
    <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header">
            <strong class="me-auto">Pool Automation</strong>
            <small>Just now</small>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    </div>
    `;
    
    // Add toast to container
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // Initialize and show toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

/**
 * Initialize chemistry chart
 */
function initializeChemistryChart() {
    const ctx = document.getElementById('chemistryChart');
    
    if (!ctx) return;
    
    // Generate sample data
    const hours = 24;
    const labels = Array.from({length: hours}, (_, i) => `${23 - i}h ago`);
    
    // Sample pH data
    const phData = [];
    for (let i = 0; i < hours; i++) {
        phData.push(7.4 + (Math.random() - 0.5) * 0.3);
    }
    
    // Sample chlorine data
    const clData = [];
    for (let i = 0; i < hours; i++) {
        clData.push(1.2 + (Math.random() - 0.5) * 0.4);
    }
    
    // Create chart
    chemistryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.reverse(),
            datasets: [
                {
                    label: 'pH',
                    data: phData.reverse(),
                    borderColor: 'rgba(13, 110, 253, 1)',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y-ph'
                },
                {
                    label: 'Free Chlorine',
                    data: clData.reverse(),
                    borderColor: 'rgba(25, 135, 84, 1)',
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y-cl'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 0
                    }
                },
                'y-ph': {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'pH'
                    },
                    min: 6.8,
                    max: 8.0,
                    grid: {
                        drawOnChartArea: true
                    }
                },
                'y-cl': {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Chlorine (mg/L)'
                    },
                    min: 0,
                    max: 3,
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                                if (context.dataset.label === 'pH') {
                                    label += ' pH';
                                } else if (context.dataset.label === 'Free Chlorine') {
                                    label += ' mg/L';
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update chemistry chart with new data
 */
function updateChemistryChart(hours) {
    if (!chemistryChart) return;
    
    hours = parseInt(hours);
    
    // Generate new labels
    const labels = Array.from({length: hours}, (_, i) => `${hours - 1 - i}h ago`);
    
    // Generate new data
    const phData = [];
    const clData = [];
    
    for (let i = 0; i < hours; i++) {
        phData.push(7.4 + (Math.random() - 0.5) * 0.3);
        clData.push(1.2 + (Math.random() - 0.5) * 0.4);
    }
    
    // Update chart data
    chemistryChart.data.labels = labels;
    chemistryChart.data.datasets[0].data = phData;
    chemistryChart.data.datasets[1].data = clData;
    
    // Update chart
    chemistryChart.update();
}

/**
 * Update detailed water chemistry displays
 */
function updateWaterChemistryDisplays() {
    // Update pH detail panel
    document.getElementById('phDetailValue').textContent = mockData.ph.toFixed(2);
    document.getElementById('phPumpDetailStatus').innerHTML = mockData.phPumpRunning ? 
        '<i class="bi bi-droplet-fill me-1 text-primary"></i> Pump active' : 
        '<i class="bi bi-droplet me-1"></i> Pump inactive';
    
    if (mockData.phPumpRunning) {
        document.getElementById('phPumpDetailStatus').className = 'text-primary pump-active';
    } else {
        document.getElementById('phPumpDetailStatus').className = 'text-secondary';
    }
    
    // Update pH marker position
    const phPercentage = ((mockData.ph - 6.8) / (8.0 - 6.8)) * 100;
    document.querySelector('.ph-marker').style.left = `${phPercentage}%`;
    
    // Update chlorine detail panel
    document.getElementById('freeChlorineDetailValue').textContent = mockData.freeChlorine.toFixed(2);
    document.getElementById('combinedChlorineDetailValue').textContent = mockData.combinedChlorine.toFixed(2);
    document.getElementById('clPumpDetailStatus').innerHTML = mockData.clPumpRunning ? 
        '<i class="bi bi-droplet-fill me-1 text-primary"></i> Pump active' : 
        '<i class="bi bi-droplet me-1"></i> Pump inactive';
    
    if (mockData.clPumpRunning) {
        document.getElementById('clPumpDetailStatus').className = 'text-primary pump-active';
    } else {
        document.getElementById('clPumpDetailStatus').className = 'text-secondary';
    }
    
    // Update chlorine marker position
    const clPercentage = ((mockData.freeChlorine - 0.5) / (5.0 - 0.5)) * 100;
    document.querySelector('.chlorine-marker').style.left = `${clPercentage}%`;
    
    // Update trends randomly for simulation
    if (Math.random() > 0.7) {
        const phTrend = Math.random() > 0.5 ? 
            '<i class="bi bi-arrow-up-short trend-up"></i> +0.1 in 1h' : 
            '<i class="bi bi-arrow-down-short trend-down"></i> -0.1 in 1h';
        document.getElementById('phTrend').innerHTML = phTrend;
        
        const clTrend = Math.random() > 0.5 ? 
            '<i class="bi bi-arrow-up-short trend-up"></i> +0.1 in 1h' : 
            '<i class="bi bi-arrow-down-short trend-down"></i> -0.1 in 1h';
        document.getElementById('chlorineTrend').innerHTML = clTrend;
    }
}

/**
 * Update all parameter displays with current values
 */
function updateParameterDisplays(data) {
    // Update pH
    updateParameter('ph', data.ph, 7.2, 7.6, 6.8, 8.0);
    updatePumpStatus('phPump', data.phPumpRunning);
    
    // Update ORP
    updateParameter('orp', data.orp, 650, 750, 600, 800);
    
    // Update Chlorine
    updateParameter('freeChlorine', data.freeChlorine, 1.0, 2.0, 0.5, 3.0);
    document.getElementById('combinedChlorineValue').textContent = data.combinedChlorine.toFixed(1);
    updateChlorineStatus(data.freeChlorine, data.combinedChlorine);
    updatePumpStatus('clPump', data.clPumpRunning);
    
    // Update Turbidity
    updateParameter('turbidity', data.turbidity, 0.12, 0.25, 0.0, 0.5);
    updatePumpStatus('pacPump', data.pacPumpRunning);
    
    // Update Temperature
    updateParameter('temp', data.temperature, 26, 30, 20, 32);
    
    // Update UV System
    document.getElementById('uvIntensity').textContent = data.uvIntensity;
    const uvMarker = document.querySelector('#uvStatus + div .parameter-marker');
    if (uvMarker) {
        uvMarker.style.left = data.uvIntensity + '%';
    }
}

/**
 * Update a single parameter display
 */
function updateParameter(id, value, lowThreshold, highThreshold, minValue, maxValue) {
    // Update value
    const valueEl = document.getElementById(id + 'Value');
    if (valueEl) {
        if (typeof value === 'number') {
            if (id === 'orp' || id === 'uvIntensity') {
                valueEl.textContent = Math.round(value);
            } else if (value < 10) {
                valueEl.textContent = value.toFixed(2);
            } else {
                valueEl.textContent = value.toFixed(1);
            }
        } else {
            valueEl.textContent = value;
        }
    }
    
    // Update status
    const statusEl = document.getElementById(id + 'Status');
    if (statusEl) {
        if (value >= lowThreshold && value <= highThreshold) {
            statusEl.textContent = 'Good';
            statusEl.className = 'badge bg-success';
        } else if (value >= minValue && value <= maxValue) {
            statusEl.textContent = 'Fair';
            statusEl.className = 'badge bg-warning';
        } else {
            statusEl.textContent = 'Poor';
            statusEl.className = 'badge bg-danger';
        }
    }
    
    // Update marker position
    const markerEl = document.querySelector(`#${id}Value`).closest('.d-flex').querySelector('.parameter-marker');
    if (markerEl) {
        const percentage = ((value - minValue) / (maxValue - minValue)) * 100;
        markerEl.style.left = `${Math.min(100, Math.max(0, percentage))}%`;
    }
}

/**
 * Update chlorine status based on both free and combined values
 */
function updateChlorineStatus(freeChlorine, combinedChlorine) {
    const statusEl = document.getElementById('chlorineStatus');
    if (!statusEl) return;
    
    if (freeChlorine >= 1.0 && freeChlorine <= 2.0 && combinedChlorine <= 0.3) {
        statusEl.textContent = 'Good';
        statusEl.className = 'badge bg-success';
    } else if (freeChlorine >= 0.5 && freeChlorine <= 3.0 && combinedChlorine <= 0.5) {
        statusEl.textContent = 'Fair';
        statusEl.className = 'badge bg-warning';
    } else {
        statusEl.textContent = 'Poor';
        statusEl.className = 'badge bg-danger';
    }
}

/**
 * Update pump status display
 */
function updatePumpStatus(id, running) {
    const statusEl = document.getElementById(id + 'Status');
    if (!statusEl) return;
    
    if (running) {
        statusEl.textContent = id === 'pacPump' ? 'PAC pump active' : 'Pump active';
        statusEl.className = 'text-primary pump-active';
        statusEl.previousElementSibling.className = 'bi bi-droplet-fill me-2 text-primary';
    } else {
        statusEl.textContent = id === 'pacPump' ? 'PAC pump inactive' : 'Pump inactive';
        statusEl.className = 'text-secondary';
        statusEl.previousElementSibling.className = 'bi bi-droplet me-2';
    }
}

/**
 * Fetch current system status
 */
function fetchStatus() {
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            console.log('Status:', data);
            const mode = data.simulation_mode ? 'simulation' : 'production';
            updateStatusBar(`System running in ${mode} mode (v${data.version})`, 'info');
        })
        .catch(error => {
            console.error('Error fetching status:', error);
            updateStatusBar('Error connecting to server', 'danger');
        });
}

/**
 * Update status bar
 */
function updateStatusBar(message, type) {
    const statusBar = document.getElementById('statusBar');
    statusBar.className = `alert alert-${type}`;
    statusBar.textContent = message;
}

/**
 * Set operation mode
 */
function setMode(mode) {
    const autoBtn = document.getElementById('autoMode');
    const manualBtn = document.getElementById('manualMode');
    
    if (mode === 'automatic') {
        autoBtn.classList.add('btn-success', 'active');
        autoBtn.classList.remove('btn-outline-secondary');
        
        manualBtn.classList.add('btn-outline-secondary');
        manualBtn.classList.remove('btn-warning', 'active');
        
        updateStatusBar('Automatic mode activated', 'success');
    } else {
        manualBtn.classList.add('btn-warning', 'active');
        manualBtn.classList.remove('btn-outline-secondary');
        
        autoBtn.classList.add('btn-outline-secondary');
        autoBtn.classList.remove('btn-success', 'active');
        
        updateStatusBar('Manual mode activated', 'warning');
    }

    // Update control availability based on mode
    updateControlsBasedOnMode();
}

/**
 * Simulate data changes for demonstration
 */
function simulateDataChanges() {
    // Add small random variations to mock data
    mockData.ph = clamp(mockData.ph + (Math.random() - 0.5) * 0.1, 6.8, 8.0);
    mockData.orp = clamp(mockData.orp + (Math.random() - 0.5) * 20, 600, 800);
    mockData.freeChlorine = clamp(mockData.freeChlorine + (Math.random() - 0.5) * 0.1, 0.5, 3.0);
    mockData.combinedChlorine = clamp(mockData.combinedChlorine + (Math.random() - 0.5) * 0.05, 0, 0.5);
    mockData.turbidity = clamp(mockData.turbidity + (Math.random() - 0.5) * 0.02, 0.05, 0.5);
    mockData.temperature = clamp(mockData.temperature + (Math.random() - 0.5) * 0.2, 20, 32);
    
    // Occasionally toggle pump states
    if (Math.random() < 0.1) {
        mockData.phPumpRunning = !mockData.phPumpRunning;
    }
    if (Math.random() < 0.1) {
        mockData.clPumpRunning = !mockData.clPumpRunning;
    }
    if (Math.random() < 0.1) {
        mockData.pacPumpRunning = !mockData.pacPumpRunning;
    }
    
    // Update displays
    updateParameterDisplays(mockData);

    // Update Water Chemistry displays
    updateWaterChemistryDisplays();

    // Update Turbidity & PAC displays
    updateTurbidityPACDisplays();
}

/**
 * Helper function to clamp values between min and max
 */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * Helper function to get URL parameters
 */
function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// Global variables for charts
let turbidityChart = null;

/**
 * Initialize turbidity and PAC controls
 */
function initializeTurbidityPACControls() {
    // Initialize auto switch
    document.getElementById('pacAutoSwitch').addEventListener('change', function() {
        togglePACAutoMode(this.checked);
    });
    
    // Initialize threshold input fields
    document.getElementById('pacHighThreshold').addEventListener('change', function() {
        updatePACThresholds();
    });
    
    document.getElementById('pacLowThreshold').addEventListener('change', function() {
        updatePACThresholds();
    });
    
    document.getElementById('pacTargetValue').addEventListener('change', function() {
        updatePACThresholds();
    });
    
    // Initialize manual control buttons
    document.getElementById('pacDoseBtn').addEventListener('click', function() {
        const flowRate = document.getElementById('pacFlowRate').value;
        startPACDosing(flowRate);
    });
    
    document.getElementById('pacStopBtn').addEventListener('click', function() {
        stopPACDosing();
    });
    
    // Initialize chart
    initializeTurbidityChart();
    
    // Add event listener for time range change
    document.getElementById('turbidityTimeRange').addEventListener('change', function() {
        updateTurbidityChart(this.value);
    });
    
    // Initial update of controls based on mode
    updateTurbidityPACControlsBasedOnMode();
}

/**
 * Toggle PAC auto/manual mode
 */
function togglePACAutoMode(isAuto) {
    // Update UI based on mode
    if (isAuto) {
        document.getElementById('pacDosingStatus').textContent = 'Optimized';
        document.getElementById('pacDosingStatus').className = 'badge bg-success';
        
        // Disable manual controls
        document.getElementById('pacDoseBtn').disabled = true;
        document.getElementById('pacStopBtn').disabled = true;
        document.getElementById('pacFlowRate').disabled = true;
        
        // Disable threshold inputs
        document.getElementById('pacHighThreshold').disabled = false;
        document.getElementById('pacLowThreshold').disabled = false;
        document.getElementById('pacTargetValue').disabled = false;
        
        showToast('PAC dosing switched to automatic mode');
    } else {
        document.getElementById('pacDosingStatus').textContent = 'Manual';
        document.getElementById('pacDosingStatus').className = 'badge bg-warning';
        
        // Enable manual controls if in manual mode
        const isManualMode = document.getElementById('manualMode').classList.contains('active');
        document.getElementById('pacDoseBtn').disabled = !isManualMode;
        document.getElementById('pacStopBtn').disabled = !isManualMode;
        document.getElementById('pacFlowRate').disabled = !isManualMode;
        
        // Disable threshold inputs in manual mode
        document.getElementById('pacHighThreshold').disabled = true;
        document.getElementById('pacLowThreshold').disabled = true;
        document.getElementById('pacTargetValue').disabled = true;
        
        showToast('PAC dosing switched to manual mode');
    }
}

/**
 * Update PAC control thresholds
 */
function updatePACThresholds() {
    const highThreshold = parseFloat(document.getElementById('pacHighThreshold').value);
    const lowThreshold = parseFloat(document.getElementById('pacLowThreshold').value);
    const targetValue = parseFloat(document.getElementById('pacTargetValue').value);
    
    // Validate thresholds
    if (lowThreshold >= highThreshold) {
        document.getElementById('pacLowThreshold').value = (highThreshold - 0.05).toFixed(2);
        showToast('Low threshold must be less than high threshold', 'warning');
    }
    
    if (targetValue >= highThreshold) {
        document.getElementById('pacTargetValue').value = (highThreshold - 0.03).toFixed(2);
        showToast('Target value must be less than high threshold', 'warning');
    }
    
    if (targetValue <= lowThreshold) {
        document.getElementById('pacTargetValue').value = (lowThreshold + 0.03).toFixed(2);
        showToast('Target value must be greater than low threshold', 'warning');
    }
    
    showToast('PAC dosing thresholds updated');
}

/**
 * Update controls based on operation mode
 */
function updateTurbidityPACControlsBasedOnMode() {
    const isManualMode = document.getElementById('manualMode').classList.contains('active');
    const isAutoMode = document.getElementById('pacAutoSwitch').checked;
    
    // Enable or disable control buttons based on mode
    if (!isAutoMode) {
        document.getElementById('pacDoseBtn').disabled = !isManualMode;
        document.getElementById('pacStopBtn').disabled = !isManualMode;
        document.getElementById('pacFlowRate').disabled = !isManualMode;
    } else {
        document.getElementById('pacDoseBtn').disabled = true;
        document.getElementById('pacStopBtn').disabled = true;
        document.getElementById('pacFlowRate').disabled = true;
    }
}

/**
 * Simulate starting PAC dosing
 */
function startPACDosing(flowRate) {
    mockData.pacPumpRunning = true;
    mockData.pacDosingRate = parseInt(flowRate);
    updatePumpStatus('pacPump', true);
    updatePumpStatus('pacPumpDetail', true);
    
    // Show toast notification
    showToast(`PAC dosing started at ${flowRate} ml/h`);
}

/**
 * Simulate stopping PAC dosing
 */
function stopPACDosing() {
    mockData.pacPumpRunning = false;
    updatePumpStatus('pacPump', false);
    updatePumpStatus('pacPumpDetail', false);
    
    // Show toast notification
    showToast('PAC dosing stopped');
}

/**
 * Update detailed turbidity and PAC displays
 */
function updateTurbidityPACDisplays() {
    
    // Null checks for all DOM operations
    const turbidityDetailValue = document.getElementById('turbidityDetailValue');
    if (turbidityDetailValue) {
        turbidityDetailValue.textContent = mockData.turbidity.toFixed(2);
    }
    
    // Update turbidity marker position
    const turbidityMarker = document.querySelector('.turbidity-marker');
    if (turbidityMarker) {
        const turbidityPercentage = ((mockData.turbidity - 0.05) / (0.5 - 0.05)) * 100;
        turbidityMarker.style.left = `${turbidityPercentage}%`;
    }
    
    // Update PAC panel
    const pacDosingRate = document.getElementById('pacDosingRate');
    if (pacDosingRate) {
        pacDosingRate.textContent = mockData.pacDosingRate;
    }
    
    const pacPumpDetailStatus = document.getElementById('pacPumpDetailStatus');
    if (pacPumpDetailStatus) {
        pacPumpDetailStatus.innerHTML = mockData.pacPumpRunning ? 
            '<i class="bi bi-droplet-fill me-1 text-primary"></i> Running' : 
            '<i class="bi bi-droplet me-1"></i> Idle';
        
        pacPumpDetailStatus.className = mockData.pacPumpRunning ? 
            'text-primary pump-active' : 'text-secondary';
    }
    
    // Update filter efficiency calculation (simplified simulation)
    const filterEfficiency = document.getElementById('filterEfficiency');
    if (filterEfficiency) {
        const efficiency = Math.round(85 - mockData.turbidity * 100);
        filterEfficiency.textContent = `${efficiency}%`;
    }
    
    // Update filter load progress
    const filterLoadProgress = document.getElementById('filterLoadProgress');
    if (filterLoadProgress) {
        const filterLoad = Math.round(mockData.turbidity * 100) + 10;
        filterLoadProgress.style.width = `${filterLoad}%`;
        filterLoadProgress.textContent = `${filterLoad}%`;
        filterLoadProgress.setAttribute('aria-valuenow', filterLoad);
        
        // Update filter load color based on value
        if (filterLoad < 40) {
            filterLoadProgress.className = 'progress-bar bg-success';
        } else if (filterLoad < 70) {
            filterLoadProgress.className = 'progress-bar bg-warning';
        } else {
            filterLoadProgress.className = 'progress-bar bg-danger';
        }
    }
    
    // Update PAC level indicator randomly for simulation
    const pacLevelIndicator = document.getElementById('pacLevelIndicator');
    if (pacLevelIndicator && Math.random() > 0.95) {
        const pacLevel = Math.round(Math.random() * 30) + 40; // 40-70%
        pacLevelIndicator.style.height = `${pacLevel}%`;
        pacLevelIndicator.setAttribute('aria-valuenow', pacLevel);
        
        const pacLevelText = pacLevelIndicator.nextElementSibling;
        if (pacLevelText) {
            pacLevelText.textContent = `${pacLevel}%`;
        }
    }
    
    // Update trends randomly for simulation
    const turbidityTrend = document.getElementById('turbidityTrend');
    if (turbidityTrend && Math.random() > 0.7) {
        const trendHtml = Math.random() > 0.5 ? 
            '<i class="bi bi-arrow-up-short trend-up"></i> +0.02 in 1h' : 
            '<i class="bi bi-arrow-down-short trend-down"></i> -0.02 in 1h';
        turbidityTrend.innerHTML = trendHtml;
    }
}

/**
 * Initialize turbidity chart
 */
function initializeTurbidityChart() {
    const ctx = document.getElementById('turbidityChart');
    
    if (!ctx) return;
    
    // Generate sample data
    const hours = 24;
    const labels = Array.from({length: hours}, (_, i) => `${23 - i}h ago`);
    
    // Sample turbidity data
    const turbidityData = [];
    for (let i = 0; i < hours; i++) {
        turbidityData.push(0.15 + (Math.random() - 0.5) * 0.1);
    }
    
    // Sample dosing events data
    const dosingEvents = [];
    for (let i = 0; i < hours; i++) {
        if (Math.random() > 0.7) {
            dosingEvents.push({
                x: `${23 - i}h ago`,
                y: 0.4 // Top of the chart
            });
        } else {
            dosingEvents.push(null);
        }
    }
    
    // Create chart
    turbidityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Turbidity (NTU)',
                    data: turbidityData,
                    borderColor: 'rgba(13, 110, 253, 1)',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'PAC Dosing',
                    data: dosingEvents,
                    borderColor: 'rgba(220, 53, 69, 0.8)',
                    backgroundColor: 'rgba(220, 53, 69, 0.8)',
                    borderWidth: 1,
                    pointRadius: 6,
                    pointStyle: 'triangle',
                    pointRotation: 180,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 0
                    }
                },
                y: {
                    type: 'linear',
                    min: 0,
                    max: 0.5,
                    title: {
                        display: true,
                        text: 'Turbidity (NTU)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'PAC Dosing' && context.raw !== null) {
                                return 'PAC Dosing Event';
                            }
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + ' NTU';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update turbidity chart with new data
 */
function updateTurbidityChart(hours) {
    if (!turbidityChart) return;
    
    hours = parseInt(hours);
    
    // Generate new labels
    const labels = Array.from({length: hours}, (_, i) => `${hours - 1 - i}h ago`);
    
    // Generate new data
    const turbidityData = [];
    const dosingEvents = [];
    
    for (let i = 0; i < hours; i++) {
        turbidityData.push(0.15 + (Math.random() - 0.5) * 0.1);
        
        if (Math.random() > 0.7) {
            dosingEvents.push({
                x: `${hours - 1 - i}h ago`,
                y: 0.4 // Top of the chart
            });
        } else {
            dosingEvents.push(null);
        }
    }
    
    // Update chart data
    turbidityChart.data.labels = labels;
    turbidityChart.data.datasets[0].data = turbidityData;
    turbidityChart.data.datasets[1].data = dosingEvents;
    
    // Update chart
    turbidityChart.update();
}

// Global variables for history charts
let historyChart = null;

/**
 * Initialize history tab functionality
 */
function initializeHistoryTab() {
    console.log('Initializing History Tab');
    
    // Initialize time range controls
    document.getElementById('historyPresetRange').addEventListener('change', function() {
        const value = this.value;
        if (value === 'custom') {
            document.getElementById('customDateRange').style.display = 'block';
            // Set default date range (last 7 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            
            document.getElementById('historyStartDate').value = formatDateTimeForInput(startDate);
            document.getElementById('historyEndDate').value = formatDateTimeForInput(endDate);
        } else {
            document.getElementById('customDateRange').style.display = 'none';
            // Update chart with selected preset
            updateHistoryChart(parseInt(value));
        }
    });
    
    // Initialize apply custom range button
    document.getElementById('applyCustomRange').addEventListener('click', function() {
        const startDate = new Date(document.getElementById('historyStartDate').value);
        const endDate = new Date(document.getElementById('historyEndDate').value);
        
        if (startDate && endDate) {
            if (startDate > endDate) {
                showToast('Start date must be before end date', 'warning');
                return;
            }
            updateHistoryChartCustomRange(startDate, endDate);
        } else {
            showToast('Please select valid date range', 'warning');
        }
    });
    
    // Initialize refresh button
    document.getElementById('refreshHistoryBtn').addEventListener('click', function() {
        const rangeSelect = document.getElementById('historyPresetRange');
        const value = rangeSelect.value;
        
        if (value === 'custom') {
            document.getElementById('applyCustomRange').click();
        } else {
            updateHistoryChart(parseInt(value));
        }
        
        showToast('Historical data refreshed');
    });
    
    // Initialize parameter checkboxes
    document.querySelectorAll('#history-tab input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateHistoryChartVisibility();
        });
    });
    
    // Initialize visualization type
    document.getElementById('visualizationType').addEventListener('change', function() {
        updateHistoryChartType(this.value);
    });
    
    // Initialize resolution selection
    document.getElementById('dataResolution').addEventListener('change', function() {
        // This would typically re-fetch data with different resolution
        // For demo, we'll just show a toast
        showToast(`Data resolution changed to ${this.options[this.selectedIndex].text}`);
        // Simulate chart update
        updateHistoryChart(parseInt(document.getElementById('historyPresetRange').value));
    });
    
    // Initialize export buttons
    document.getElementById('downloadChartBtn').addEventListener('click', function() {
        // This would typically generate a download
        // For demo, we'll just show a toast
        showToast('Chart data export started');
    });
    
    document.getElementById('exportCsvBtn').addEventListener('click', function() {
        // This would typically generate a CSV download
        // For demo, we'll just show a toast
        showToast('CSV export started');
    });
    
    document.getElementById('exportJsonBtn').addEventListener('click', function() {
        // This would typically generate a JSON download
        // For demo, we'll just show a toast
        showToast('JSON export started');
    });
    
    // Initialize event type filter
    document.getElementById('eventTypeFilter').addEventListener('change', function() {
        filterEventsByType(this.value);
    });
    
    // Initialize tables with consistent data
    initializeTableData();
    
    // Create initial history chart
    initializeHistoryChart();
    
    // Initialize pagination controls
    initializePagination();

    // Load initial data based on default selections
    updateHistoryChart(168); // Default: 7 days
}

/**
 * Initialize history chart with better defaults
 */
function initializeHistoryChart() {
    const ctx = document.getElementById('historyChart');
    
    if (!ctx) {
        console.error('Chart canvas element not found!');
        return;
    }
    
    console.log('Initializing history chart...');
    
    // Generate sample data
    const hours = 168; // 7 days
    const labels = [];
    const now = new Date();
    
    // Generate labels with less density (every 6 hours instead of hourly)
    for (let i = hours - 1; i >= 0; i -= 6) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        labels.push(formatDateTime(date));
    }
    
    // Sample data sets with smoothing
    const phData = smoothData(generateSampleData(7.4, 0.2, Math.ceil(hours/6)));
    const orpData = smoothData(generateSampleData(720, 30, Math.ceil(hours/6)));
    const freeChlorineData = smoothData(generateSampleData(1.2, 0.3, Math.ceil(hours/6)));
    const combinedChlorineData = smoothData(generateSampleData(0.2, 0.1, Math.ceil(hours/6)));
    const turbidityData = smoothData(generateSampleData(0.15, 0.05, Math.ceil(hours/6)));
    const temperatureData = smoothData(generateSampleData(28, 1, Math.ceil(hours/6)));
    
    // Create a cleaner chart
    try {
        historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'pH',
                        data: phData,
                        borderColor: 'rgba(13, 110, 253, 1)',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-ph'
                    },
                    {
                        label: 'ORP',
                        data: orpData,
                        borderColor: 'rgba(108, 117, 125, 1)',
                        backgroundColor: 'rgba(108, 117, 125, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        hidden: true, // Initially hidden
                        yAxisID: 'y-orp'
                    },
                    {
                        label: 'Free Chlorine',
                        data: freeChlorineData,
                        borderColor: 'rgba(25, 135, 84, 1)',
                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-chlorine'
                    },
                    {
                        label: 'Combined Chlorine',
                        data: combinedChlorineData,
                        borderColor: 'rgba(25, 135, 84, 0.6)',
                        backgroundColor: 'rgba(25, 135, 84, 0.05)',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false,
                        hidden: true, // Initially hidden
                        yAxisID: 'y-chlorine'
                    },
                    {
                        label: 'Turbidity',
                        data: turbidityData,
                        borderColor: 'rgba(220, 53, 69, 1)',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        hidden: true, // Initially hidden
                        yAxisID: 'y-turbidity'
                    },
                    {
                        label: 'Temperature',
                        data: temperatureData,
                        borderColor: 'rgba(255, 193, 7, 1)',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        hidden: true, // Initially hidden
                        yAxisID: 'y-temp'
                    },
                    {
                        label: 'Dosing Events',
                        data: generateSimplifiedDosingEvents(Math.ceil(hours/6)),
                        borderColor: 'rgba(13, 202, 240, 1)',
                        backgroundColor: 'rgba(13, 202, 240, 1)',
                        borderWidth: 2,
                        pointRadius: 12,
                        pointStyle: 'triangle',
                        pointRotation: 0,
                        showLine: false,
                        yAxisID: 'y-ph' // Positioned on pH axis for visibility
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    'y-ph': {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'pH'
                        },
                        min: 6.8,
                        max: 8.0,
                        grid: {
                            drawOnChartArea: true
                        }
                    },
                    'y-chlorine': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Chlorine (mg/L)'
                        },
                        min: 0,
                        max: 3,
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    'y-orp': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: false, // Hide by default
                            text: 'ORP (mV)'
                        },
                        min: 600,
                        max: 800,
                        display: false // Initially hidden
                    },
                    'y-turbidity': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: false, // Hide by default
                            text: 'Turbidity (NTU)'
                        },
                        min: 0,
                        max: 0.5,
                        display: false // Initially hidden
                    },
                    'y-temp': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: false, // Hide by default
                            text: 'Temperature (°C)'
                        },
                        min: 22,
                        max: 32,
                        display: false // Initially hidden
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true
                        },
                        // Make legend display-only by providing an empty click handler
                        onClick: function(e, legendItem, legend) {
                            // Do nothing - legend is display only
                            return;
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.label === 'Dosing Events' && context.raw !== null) {
                                    return 'Dosing Event';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                    if (context.dataset.label === 'pH') {
                                        label += ' pH';
                                    } else if (context.dataset.label.includes('Chlorine')) {
                                        label += ' mg/L';
                                    } else if (context.dataset.label === 'ORP') {
                                        label += ' mV';
                                    } else if (context.dataset.label === 'Turbidity') {
                                        label += ' NTU';
                                    } else if (context.dataset.label === 'Temperature') {
                                        label += ' °C';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Chart initialized successfully');
        
        // Link parameter checkboxes to chart visibility
        linkCheckboxesToChart();
        syncCheckboxesWithChart();
        
        // Initialize parameter buttons
        initializeParameterButtons();
        
    } catch (error) {
        console.error('Error initializing chart:', error);
    }
}

/**
 * Initialize parameter button states based on chart visibility
 */
function initializeParameterButtons() {
    if (!historyChart) return;
    
    // Map parameters to their dataset indices
    const paramMap = {
        'pH': 0,
        'ORP': 1,
        'Free Chlorine': 2,
        'Combined Cl': 3,
        'Turbidity': 4,
        'Temperature': 5
    };
    
    // Set up click handlers for all parameter buttons
    document.querySelectorAll('.parameters button').forEach(button => {
        // Remove existing click handlers by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add our new handler
        newButton.addEventListener('click', function() {
            // Get parameter name and dataset index
            const paramName = this.textContent.trim();
            const datasetIndex = paramMap[paramName];
            
            if (datasetIndex !== undefined) {
                // Toggle visibility in the chart
                const currentVisibility = historyChart.isDatasetVisible(datasetIndex);
                const newVisibility = !currentVisibility;
                
                // Update chart visibility
                historyChart.setDatasetVisibility(datasetIndex, newVisibility);
                
                // Update button appearance
                this.classList.toggle('active', newVisibility);
                this.classList.toggle('btn-primary', newVisibility);
                this.classList.toggle('btn-outline-secondary', !newVisibility);
                
                // Update corresponding checkbox
                const checkboxMap = {
                    'pH': 'showPh',
                    'ORP': 'showOrp',
                    'Free Chlorine': 'showFreeChlorine',
                    'Combined Cl': 'showCombinedChlorine', 
                    'Turbidity': 'showTurbidity',
                    'Temperature': 'showTemp'
                };
                
                const checkbox = document.getElementById(checkboxMap[paramName]);
                if (checkbox) {
                    checkbox.checked = newVisibility;
                }
                
                // Update axis visibility
                updateAllAxisVisibility();
                
                // Update chart
                historyChart.update();
            }
        });
        
        // Set initial state
        const paramName = newButton.textContent.trim();
        const datasetIndex = paramMap[paramName];
        if (datasetIndex !== undefined) {
            const isVisible = historyChart.isDatasetVisible(datasetIndex);
            newButton.classList.toggle('active', isVisible);
            newButton.classList.toggle('btn-primary', isVisible);
            newButton.classList.toggle('btn-outline-secondary', !isVisible);
        }
    });
    
    // Set up dosing events checkbox
    const dosingEventsCheckbox = document.getElementById('showDosingEvents');
    if (dosingEventsCheckbox) {
        dosingEventsCheckbox.addEventListener('change', function() {
            historyChart.setDatasetVisibility(6, this.checked);
            updateAllAxisVisibility();
            historyChart.update();
        });
    }
}

/**
 * Simplified dosing events generator
 */
function generateSimplifiedDosingEvents(count) {
    const events = Array(count).fill(null);
    
    // Add 5-8 random dosing events
    const numEvents = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numEvents; i++) {
        const position = Math.floor(Math.random() * count);
        events[position] = 7.8; // Position near the top of pH scale
    }
    
    return events;
}

/**
 * Apply smoothing to data
 */
function smoothData(data) {
    // Simple moving average smoothing
    const smoothed = [];
    const windowSize = 3;
    
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        
        for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
            sum += data[j];
            count++;
        }
        
        smoothed.push(sum / count);
    }
    
    return smoothed;
}

/**
 * Link parameter checkboxes to chart visibility
 */
function linkCheckboxesToChart() {
    if (!historyChart) return;
    
    // Map checkboxes to dataset indices
    const checkboxMap = {
        'showPh': 0,
        'showOrp': 1,
        'showFreeChlorine': 2,
        'showCombinedChlorine': 3,
        'showTurbidity': 4,
        'showTemp': 5
    };
    
    // Link checkbox change events
    Object.keys(checkboxMap).forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                const datasetIndex = checkboxMap[this.id];
                
                // Update dataset visibility
                historyChart.setDatasetVisibility(datasetIndex, this.checked);
                
                // Update parameter button state
                const buttonMap = {
                    'showPh': 'pH',
                    'showOrp': 'ORP',
                    'showFreeChlorine': 'Free Chlorine',
                    'showCombinedChlorine': 'Combined Cl',
                    'showTurbidity': 'Turbidity',
                    'showTemp': 'Temperature'
                };
                
                const paramName = buttonMap[this.id];
                document.querySelectorAll('.parameters button').forEach(button => {
                    if (button.textContent.trim() === paramName) {
                        button.classList.toggle('active', this.checked);
                        button.classList.toggle('btn-primary', this.checked);
                        button.classList.toggle('btn-outline-secondary', !this.checked);
                    }
                });
                
                // Update all axes visibility
                updateAllAxisVisibility();
                
                // Update chart
                historyChart.update();
            });
        }
    });
    
    // Link dosing events checkbox
    const dosingEventsCheckbox = document.getElementById('showDosingEvents');
    if (dosingEventsCheckbox) {
        dosingEventsCheckbox.addEventListener('change', function() {
            historyChart.setDatasetVisibility(6, this.checked);
            updateAllAxisVisibility();
            historyChart.update();
        });
    }
}

/**
 * Update history chart with new data for a time period
 */
function updateHistoryChart(hours) {
    if (!historyChart) return;
    
    // Generate sample data
    const labels = [];
    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        labels.push(formatDateTime(date));
    }
    
    // Sample data sets
    const phData = generateSampleData(7.4, 0.2, hours);
    const orpData = generateSampleData(720, 30, hours);
    const freeChlorineData = generateSampleData(1.2, 0.3, hours);
    const combinedChlorineData = generateSampleData(0.2, 0.1, hours);
    const turbidityData = generateSampleData(0.15, 0.05, hours);
    const temperatureData = generateSampleData(28, 1, hours);
    
    // Generate dosing events
    const dosingEvents = generateSampleEvents(hours, Math.max(5, Math.floor(hours / 12)));
    
    // Update chart data
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = phData;
    historyChart.data.datasets[1].data = orpData;
    historyChart.data.datasets[2].data = freeChlorineData;
    historyChart.data.datasets[3].data = combinedChlorineData;
    historyChart.data.datasets[4].data = turbidityData;
    historyChart.data.datasets[5].data = temperatureData;
    historyChart.data.datasets[6].data = dosingEvents;
    
    // Update axis options for better display with different time ranges
    if (hours <= 48) {
        historyChart.options.scales.x.ticks.maxTicksLimit = 24;
    } else if (hours <= 168) {
        historyChart.options.scales.x.ticks.maxTicksLimit = 14;
    } else {
        historyChart.options.scales.x.ticks.maxTicksLimit = 10;
    }
    
    // Update chart
    historyChart.update();
    
    updateTableDataForPage('historyDataTable', 1);
}

/**
 * Update history chart with custom date range
 */
function updateHistoryChartCustomRange(startDate, endDate) {
    if (!historyChart) return;
    
    // Calculate hours between dates
    const diffMs = endDate - startDate;
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    // Generate new labels for custom range
    const labels = [];
    const currentDate = new Date(startDate);
    
    // Generate labels based on range duration
    let interval = 1; // hours
    if (diffHours > 168) interval = 6;
    if (diffHours > 720) interval = 24;
    
    const steps = Math.ceil(diffHours / interval);
    
    for (let i = 0; i < steps; i++) {
        labels.push(formatDateTime(currentDate));
        currentDate.setHours(currentDate.getHours() + interval);
    }
    
    // Sample data sets
    const phData = generateSampleData(7.4, 0.2, steps);
    const orpData = generateSampleData(720, 30, steps);
    const freeChlorineData = generateSampleData(1.2, 0.3, steps);
    const combinedChlorineData = generateSampleData(0.2, 0.1, steps);
    const turbidityData = generateSampleData(0.15, 0.05, steps);
    const temperatureData = generateSampleData(28, 1, steps);
    
    // Generate dosing events
    const dosingEvents = generateSampleEvents(steps, Math.max(5, Math.floor(steps / 12)));
    
    // Update chart data
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = phData;
    historyChart.data.datasets[1].data = orpData;
    historyChart.data.datasets[2].data = freeChlorineData;
    historyChart.data.datasets[3].data = combinedChlorineData;
    historyChart.data.datasets[4].data = turbidityData;
    historyChart.data.datasets[5].data = temperatureData;
    historyChart.data.datasets[6].data = dosingEvents;
    
    // Update axis options for better display with different time ranges
    if (steps <= 48) {
        historyChart.options.scales.x.ticks.maxTicksLimit = 24;
    } else if (steps <= 168) {
        historyChart.options.scales.x.ticks.maxTicksLimit = 14;
    } else {
        historyChart.options.scales.x.ticks.maxTicksLimit = 10;
    }
    
    // Update chart
    historyChart.update();
    
    updateTableDataForPage('historyDataTable', 1);
}

/**
 * Update chart visibility based on parameter checkboxes
 */
function updateHistoryChartVisibility() {
    if (!historyChart) return;
    
    // pH
    historyChart.data.datasets[0].hidden = !document.getElementById('showPh').checked;
    
    // ORP
    historyChart.data.datasets[1].hidden = !document.getElementById('showOrp').checked;
    
    // Free Chlorine
    historyChart.data.datasets[2].hidden = !document.getElementById('showFreeChlorine').checked;
    
    // Combined Chlorine
    historyChart.data.datasets[3].hidden = !document.getElementById('showCombinedChlorine').checked;
    
    // Turbidity
    historyChart.data.datasets[4].hidden = !document.getElementById('showTurbidity').checked;
    
    // Temperature
    historyChart.data.datasets[5].hidden = !document.getElementById('showTemp').checked;
    
    // Dosing Events
    historyChart.data.datasets[6].hidden = !document.getElementById('showDosingEvents').checked;
    
    // Update axis visibility
    updateAxisVisibility();

    // Update chart
    historyChart.update();
}

/**
 * Update axis visibility based on dataset visibility
 */
function updateAxisVisibility() {
    if (!historyChart) return;
    
    // pH axis
    historyChart.options.scales['y-ph'].display = document.getElementById('showPh').checked;
    
    // Chlorine axis - show if either chlorine dataset is visible
    const freeChlorineVisible = document.getElementById('showFreeChlorine').checked;
    const combinedChlorineVisible = document.getElementById('showCombinedChlorine').checked;
    historyChart.options.scales['y-chlorine'].display = freeChlorineVisible || combinedChlorineVisible;
    
    // ORP axis
    historyChart.options.scales['y-orp'].display = document.getElementById('showOrp').checked;
    
    // Turbidity axis
    historyChart.options.scales['y-turbidity'].display = document.getElementById('showTurbidity').checked;
    
    // Temperature axis
    historyChart.options.scales['y-temp'].display = document.getElementById('showTemp').checked;
}

/**
 * Update chart type
 */
function updateHistoryChartType(type) {
    if (!historyChart) return;
    
    // Change chart type
    historyChart.config.type = type;
    
    // Adjust point sizes for different chart types
    if (type === 'scatter') {
        historyChart.data.datasets.forEach(dataset => {
            if (dataset.label !== 'Dosing Events') {
                dataset.pointRadius = 3;
            }
        });
    } else {
        historyChart.data.datasets.forEach(dataset => {
            if (dataset.label !== 'Dosing Events') {
                dataset.pointRadius = type === 'line' ? undefined : 0;
            }
        });
    }
    
    // Update chart
    historyChart.update();
}

/**
 * Update history data table
 */
function updateHistoryTable(hours) {
    const tbody = document.getElementById('historyDataTable').querySelector('tbody');
    tbody.innerHTML = '';
    
    // Generate sample data for table (most recent first)
    const now = new Date();
    let rows = Math.min(hours, 25); // Limit to 25 rows for demo
    
    for (let i = 0; i < rows; i++) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(date)}</td>
            <td>${(7.4 + (Math.random() - 0.5) * 0.2).toFixed(2)}</td>
            <td>${Math.round(720 + (Math.random() - 0.5) * 30)}</td>
            <td>${(1.2 + (Math.random() - 0.5) * 0.3).toFixed(2)}</td>
            <td>${(0.2 + (Math.random() - 0.5) * 0.1).toFixed(2)}</td>
            <td>${(0.15 + (Math.random() - 0.5) * 0.05).toFixed(3)}</td>
            <td>${(28 + (Math.random() - 0.5) * 1).toFixed(1)}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Update row count
    const rowCountElem = document.getElementById('historyDataTable').parentNode.nextElementSibling.firstElementChild;
    if (rowCountElem) {
        rowCountElem.textContent = `Showing ${rows} of ${hours} records`;
    }
}

/**
 * Filter events by type
 */
function filterEventsByType(type) {
    const rows = document.getElementById('eventsTable').querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const eventType = row.querySelector('td:nth-child(2) .badge').textContent.toLowerCase();
        
        if (type === 'all' || eventType.includes(type.toLowerCase())) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

/**
 * Generate sample data with variation around a base value
 */
function generateSampleData(baseValue, variation, count) {
    const data = [];
    let currentValue = baseValue;
    
    for (let i = 0; i < count; i++) {
        // Add some randomness and trend
        const trend = Math.sin(i / 20) * variation * 0.5;
        const random = (Math.random() - 0.5) * variation;
        
        currentValue = baseValue + trend + random;
        data.push(currentValue);
    }
    
    return data;
}

/**
 * Generate sample dosing events
 */
function generateSampleEvents(hours, count) {
    const events = [];
    
    // Initialize with null values for all hours
    for (let i = 0; i < hours; i++) {
        events.push(null);
    }
    
    // Add random events
    for (let i = 0; i < count; i++) {
        const position = Math.floor(Math.random() * hours);
        events[position] = 7.8; // Position dosing events at the top of the chart
    }
    
    return events;
}

/**
 * Format date for display
 */
function formatDateTime(date) {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Format date for datetime-local input
 */
function formatDateTimeForInput(date) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Initialize pagination for both tables
 */
function initializePagination() {
    // Initialize data table pagination
    initializeTablePagination('historyDataTable', 'historyDataPagination');
    
    // Initialize events table pagination
    initializeTablePagination('eventsTable', 'eventsPagination');
}

/**
 * Initialize pagination for a specific table
 */
function initializeTablePagination(tableId, paginationId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // Find pagination container - select the closest pagination element to the table
    const paginationContainer = table.closest('.card').querySelector('.pagination');
    if (!paginationContainer) return;
    
    // Add active class to first page
    const firstPageItem = paginationContainer.querySelector('.page-item:nth-child(2)');
    if (firstPageItem) {
        firstPageItem.classList.add('active');
        updateActivePageNumberStyle(paginationContainer);
    }

    // Update the disabled state of prev/next buttons
    updatePaginationArrows(paginationContainer, 1);
    
    // Add click handlers to pagination links
    paginationContainer.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const pageText = this.textContent;
            let currentPage = 1;

            if (pageText === '«') {
                // Previous page
                const activePage = paginationContainer.querySelector('.page-item.active');
                if (!activePage) return;
                
                // Find the page number of the active page
                const activePageNum = activePage.querySelector('.page-link').textContent;
                currentPage = parseInt(activePageNum) - 1;
                
                if (currentPage < 1) return; // Don't go below page 1
                
                // Update page data and UI
                updatePaginationPage(paginationContainer, currentPage, tableId);
            } 
            else if (pageText === '»') {
                // Next page
                const activePage = paginationContainer.querySelector('.page-item.active');
                if (!activePage) return;
                
                // Find the page number of the active page
                const activePageNum = activePage.querySelector('.page-link').textContent;
                currentPage = parseInt(activePageNum) + 1;
                
                // Determine max pages (we have 3 page links in our pagination)
                const maxPage = 3; // Assuming 3 pages in the pagination
                if (currentPage > maxPage) return; // Don't go beyond available pages
                
                // Update page data and UI
                updatePaginationPage(paginationContainer, currentPage, tableId);
            }
            else {
                // Direct page click
                currentPage = parseInt(pageText);
                updatePaginationPage(paginationContainer, currentPage, tableId);
            }
        });
    });
}

/**
 * Update pagination page - handles both UI updates and data updates
 */
function updatePaginationPage(paginationContainer, pageNumber, tableId) {
    // Update active page
    paginationContainer.querySelectorAll('.page-item').forEach(item => {
        if (item.classList.contains('active')) {
            item.classList.remove('active');
        }
    });
    
    // Find the page item with the target page number and make it active
    paginationContainer.querySelectorAll('.page-item').forEach(item => {
        const link = item.querySelector('.page-link');
        if (link && link.textContent === pageNumber.toString()) {
            item.classList.add('active');
        }
    });
    
    // Update previous/next button states
    updatePaginationArrows(paginationContainer, pageNumber);

    // Ensure page numbers are visible
    updateActivePageNumberStyle(paginationContainer);
    
    // Update table data based on the page number
    if (tableId === 'historyDataTable') {
        updateTableDataForPage(tableId, pageNumber);
    } else if (tableId === 'eventsTable') {
        updateEventsDataForPage(tableId, pageNumber);
    }
}

/**
 * Update the disabled state of pagination arrows based on current page
 */
function updatePaginationArrows(paginationContainer, currentPage) {
    // Get previous and next buttons
    const prevButton = paginationContainer.querySelector('.page-item:first-child');
    const nextButton = paginationContainer.querySelector('.page-item:last-child');
    
    if (prevButton) {
        if (currentPage <= 1) {
            prevButton.classList.add('disabled');
        } else {
            prevButton.classList.remove('disabled');
        }
    }
    
    if (nextButton) {
        // Assuming we have 3 page links
        if (currentPage >= 3) {
            nextButton.classList.add('disabled');
        } else {
            nextButton.classList.remove('disabled');
        }
    }
}

/**
 * Sync checkbox states with initial chart visibility
 */
function syncCheckboxesWithChart() {
    if (!historyChart) return;
    
    // Match checkbox states to chart visibility
    document.getElementById('showPh').checked = !historyChart.data.datasets[0].hidden;
    document.getElementById('showOrp').checked = !historyChart.data.datasets[1].hidden;
    document.getElementById('showFreeChlorine').checked = !historyChart.data.datasets[2].hidden;
    document.getElementById('showCombinedChlorine').checked = !historyChart.data.datasets[3].hidden;
    document.getElementById('showTurbidity').checked = !historyChart.data.datasets[4].hidden;
    document.getElementById('showTemp').checked = !historyChart.data.datasets[5].hidden;

    // Update all axes visibility
    updateAllAxisVisibility();
}

/**
 * Update table data for a specific page
 */
function updateTableDataForPage(tableId, pageNumber) {
    const tbody = document.getElementById(tableId).querySelector('tbody');
    if (!tbody) return;
    
    const recordsPerPage = 5; // 5 records per page
    const offset = (pageNumber - 1) * recordsPerPage;
    const now = new Date();
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Generate new rows for this page
    for (let i = 0; i < recordsPerPage; i++) {
        const date = new Date(now);
        date.setHours(date.getHours() - (offset + i));
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(date)}</td>
            <td>${(7.4 + (Math.random() - 0.5) * 0.2).toFixed(2)}</td>
            <td>${Math.round(720 + (Math.random() - 0.5) * 30)}</td>
            <td>${(1.2 + (Math.random() - 0.5) * 0.3).toFixed(2)}</td>
            <td>${(0.2 + (Math.random() - 0.5) * 0.1).toFixed(2)}</td>
            <td>${(0.15 + (Math.random() - 0.5) * 0.05).toFixed(3)}</td>
            <td>${(28 + (Math.random() - 0.5) * 1).toFixed(1)}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Update the count display
    const countDisplay = document.querySelector(`#${tableId}`).closest('.card-body').querySelector('.d-flex div');
    if (countDisplay) {
        countDisplay.textContent = `Showing ${recordsPerPage} of 15 records`;
    }
}

/**
 * Update events data for a specific page
 */
function updateEventsDataForPage(tableId, pageNumber) {
    const tbody = document.getElementById(tableId).querySelector('tbody');
    if (!tbody) return;
    
    const recordsPerPage = 5; // 5 records per page
    const offset = (pageNumber - 1) * recordsPerPage;
    const now = new Date();
    
    // Event types
    const eventTypes = [
        { type: 'System', class: 'bg-info' },
        { type: 'Dosing', class: 'bg-success' },
        { type: 'Alert', class: 'bg-warning' },
        { type: 'User', class: 'bg-primary' }
    ];
    
    // Event descriptions
    const descriptions = [
        { text: 'System started in automatic mode', param: '-', value: '-' },
        { text: 'Automatic chlorine dosing', param: 'Free Cl', value: '0.9 mg/L' },
        { text: 'Low chlorine level detected', param: 'Free Cl', value: '0.7 mg/L' },
        { text: 'Automatic PAC dosing', param: 'Turbidity', value: '0.22 NTU' },
        { text: 'User changed target pH range', param: 'pH', value: '7.2-7.6' }
    ];
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Generate new rows for this page
    for (let i = 0; i < recordsPerPage; i++) {
        const date = new Date(now);
        date.setHours(date.getHours() - (offset + i));
        
        // Pick random event type and description
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(date)}</td>
            <td><span class="badge ${eventType.class}">${eventType.type}</span></td>
            <td>${description.text}</td>
            <td>${description.param}</td>
            <td>${description.value}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Update the count display
    const countDisplay = document.querySelector(`#${tableId}`).closest('.card-body').querySelector('.d-flex div');
    if (countDisplay) {
        countDisplay.textContent = `Showing ${recordsPerPage} of 15 events`;
    }
}

/**
 * Initialize table data with 5 records per page
 */
function initializeTableData() {
    // Get both tables
    const historyTable = document.getElementById('historyDataTable');
    const eventsTable = document.getElementById('eventsTable');
    
    if (historyTable) {
        const tbody = historyTable.querySelector('tbody');
        if (tbody) {
            // Clear any existing data first
            tbody.innerHTML = '';
            
            // Add exactly 5 rows
            const now = new Date();
            for (let i = 0; i < 5; i++) {
                const date = new Date(now);
                date.setHours(date.getHours() - i);
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDateTime(date)}</td>
                    <td>${(7.4 + (Math.random() - 0.5) * 0.2).toFixed(2)}</td>
                    <td>${Math.round(720 + (Math.random() - 0.5) * 30)}</td>
                    <td>${(1.2 + (Math.random() - 0.5) * 0.3).toFixed(2)}</td>
                    <td>${(0.2 + (Math.random() - 0.5) * 0.1).toFixed(2)}</td>
                    <td>${(0.15 + (Math.random() - 0.5) * 0.05).toFixed(3)}</td>
                    <td>${(28 + (Math.random() - 0.5) * 1).toFixed(1)}</td>
                `;
                tbody.appendChild(tr);
            }
            
            // Update the count display
            const countDisplay = historyTable.closest('.card-body').querySelector('.d-flex div');
            if (countDisplay) {
                countDisplay.textContent = 'Showing 5 of 15 records';
            }
        }
    }
    
    if (eventsTable) {
        const tbody = eventsTable.querySelector('tbody');
        if (tbody) {
            // Clear any existing data
            tbody.innerHTML = '';
            
            // Event types and descriptions are the same as in updateEventsDataForPage
            const eventTypes = [
                { type: 'System', class: 'bg-info' },
                { type: 'Dosing', class: 'bg-success' },
                { type: 'Alert', class: 'bg-warning' },
                { type: 'User', class: 'bg-primary' }
            ];
            
            const descriptions = [
                { text: 'System started in automatic mode', param: '-', value: '-' },
                { text: 'Automatic chlorine dosing', param: 'Free Cl', value: '0.9 mg/L' },
                { text: 'Low chlorine level detected', param: 'Free Cl', value: '0.7 mg/L' },
                { text: 'Automatic PAC dosing', param: 'Turbidity', value: '0.22 NTU' },
                { text: 'User changed target pH range', param: 'pH', value: '7.2-7.6' }
            ];
            
            // Add exactly 5 rows
            const now = new Date();
            for (let i = 0; i < 5; i++) {
                const date = new Date(now);
                date.setHours(date.getHours() - i);
                
                // Pick specific event for consistency
                const eventType = eventTypes[i % eventTypes.length];
                const description = descriptions[i % descriptions.length];
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDateTime(date)}</td>
                    <td><span class="badge ${eventType.class}">${eventType.type}</span></td>
                    <td>${description.text}</td>
                    <td>${description.param}</td>
                    <td>${description.value}</td>
                `;
                tbody.appendChild(tr);
            }
            
            // Update the count display
            const countDisplay = eventsTable.closest('.card-body').querySelector('.d-flex div');
            if (countDisplay) {
                countDisplay.textContent = 'Showing 5 of 15 events';
            }
        }
    }
}

/**
 * Ensure page numbers are visible when active
 */
function updateActivePageNumberStyle(paginationContainer) {
    paginationContainer.querySelectorAll('.page-item').forEach(item => {
        const link = item.querySelector('.page-link');
        if (link) {
            if (item.classList.contains('active')) {
                // Add white text color for active page
                link.style.color = 'white';
                // Add the page number to make it more visible
                if (!isNaN(parseInt(link.textContent))) {
                    link.setAttribute('data-page', link.textContent);
                }
            } else {
                link.style.color = '';
            }
        }
    });
}

/**
 * Update all axis visibility based on dataset visibility
 */
function updateAllAxisVisibility() {
    if (!historyChart) return;
    
    // First, set all axes to hidden
    historyChart.options.scales['y-ph'].display = false;
    historyChart.options.scales['y-orp'].display = false;
    historyChart.options.scales['y-chlorine'].display = false; 
    historyChart.options.scales['y-turbidity'].display = false;
    historyChart.options.scales['y-temp'].display = false;
    
    // Now check each dataset and show the axis if the dataset is visible
    const datasetToAxisMap = {
        0: 'y-ph',          // pH
        1: 'y-orp',         // ORP
        2: 'y-chlorine',    // Free Chlorine
        3: 'y-chlorine',    // Combined Chlorine (shares axis with Free Chlorine)
        4: 'y-turbidity',   // Turbidity
        5: 'y-temp',        // Temperature
        6: 'y-ph'           // Dosing Events (shown on pH axis)
    };
    
    // For each dataset, check if it's visible and update its axis
    for (let i = 0; i < historyChart.data.datasets.length; i++) {
        if (historyChart.isDatasetVisible(i)) {
            const axisId = datasetToAxisMap[i];
            if (axisId) {
                historyChart.options.scales[axisId].display = true;
                
                // Also ensure axis title is visible
                historyChart.options.scales[axisId].title.display = true;
            }
        }
    }
    
    // Special case: If dosing events is the only visible dataset on y-ph axis
    const phDatasetVisible = historyChart.isDatasetVisible(0); // pH
    const dosingEventsVisible = historyChart.isDatasetVisible(6); // Dosing Events
    
    if (!phDatasetVisible && dosingEventsVisible) {
        // If only dosing events are visible, show pH axis for reference but with muted styling
        historyChart.options.scales['y-ph'].display = true;
        historyChart.options.scales['y-ph'].grid.color = 'rgba(0, 0, 0, 0.1)'; // Muted grid
    } else if (phDatasetVisible) {
        // Reset grid color when pH dataset is visible
        historyChart.options.scales['y-ph'].grid.color = undefined; // Use default
    }
}

function initializeSettingsTab() {
    console.log('Initializing Settings Tab');
    
    // Make the tab content container visible
    const tabContent = document.getElementById('settingsTabContent');
    if (tabContent) {
        tabContent.style.display = 'block';
    }
    
    // Set up click handlers for tabs
    document.querySelectorAll('#settingsTabs .nav-link').forEach(function(tabButton) {
        tabButton.addEventListener('click', function() {
            // Remove active class from all tab buttons
            document.querySelectorAll('#settingsTabs .nav-link').forEach(function(btn) {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Hide all tab panes
            document.querySelectorAll('.tab-pane').forEach(function(pane) {
                pane.style.display = 'none';
            });
            
            // Show the target tab pane
            const targetId = this.getAttribute('data-bs-target');
            const targetPane = document.querySelector(targetId);
            if (targetPane) {
                targetPane.style.display = 'block';
            }
        });
    });
    
    // Activate System tab by default
    const systemTab = document.querySelector('#system-tab');
    if (systemTab) {
        systemTab.click();
    }
}

/**
 * Load saved settings from localStorage or use defaults
 */
function loadSavedSettings() {
    // System settings
    if (localStorage.getItem('systemSettings')) {
        const systemSettings = JSON.parse(localStorage.getItem('systemSettings'));
        
        document.getElementById('systemName').value = systemSettings.name || 'Pool Automation System';
        document.getElementById('defaultMode').value = systemSettings.defaultMode || 'automatic';
        document.getElementById('tempUnit').value = systemSettings.tempUnit || 'celsius';
        document.getElementById('timeFormat').value = systemSettings.timeFormat || '24h';
        document.getElementById('dataSamplingRate').value = systemSettings.dataSamplingRate || '300';
        document.getElementById('dataRetention').value = systemSettings.dataRetention || '30';
        document.getElementById('enableSimulation').checked = systemSettings.enableSimulation !== false;
    }
    
    // Parameter settings
    if (localStorage.getItem('parameterSettings')) {
        const parameterSettings = JSON.parse(localStorage.getItem('parameterSettings'));
        
        // pH settings
        if (parameterSettings.ph) {
            document.getElementById('phTargetMin').value = parameterSettings.ph.targetMin || 7.2;
            document.getElementById('phTargetMax').value = parameterSettings.ph.targetMax || 7.6;
            document.getElementById('phAlertLow').value = parameterSettings.ph.alertLow || 7.0;
            document.getElementById('phAlertHigh').value = parameterSettings.ph.alertHigh || 7.8;
            document.getElementById('phDoseRate').value = parameterSettings.ph.doseRate || 100;
            document.getElementById('phDosingDelay').value = parameterSettings.ph.dosingDelay || 5;
            document.getElementById('phAutoDosing').checked = parameterSettings.ph.autoDosing !== false;
        }
        
        // Other parameters would follow the same pattern
    }
    
    // Device settings
    if (localStorage.getItem('deviceSettings')) {
        const deviceSettings = JSON.parse(localStorage.getItem('deviceSettings'));
        
        // Pump settings
        if (deviceSettings.pumps) {
            document.getElementById('phPumpType').value = deviceSettings.pumps.phPumpType || 'NOVA NSE155-E1504';
            document.getElementById('phPumpMaxFlow').value = deviceSettings.pumps.phPumpMaxFlow || 15.3;
            document.getElementById('clPumpType').value = deviceSettings.pumps.clPumpType || 'NOVA NSE155-E1504';
            document.getElementById('clPumpMaxFlow').value = deviceSettings.pumps.clPumpMaxFlow || 15.3;
            document.getElementById('pacPumpType').value = deviceSettings.pumps.pacPumpType || 'Chonry WP110';
            document.getElementById('pacPumpMaxFlow').value = deviceSettings.pumps.pacPumpMaxFlow || 150;
            document.getElementById('pacTubeSize').value = deviceSettings.pumps.pacTubeSize || '2x1';
        }
        
        // Sensor settings
        if (deviceSettings.sensors) {
            document.getElementById('turbidityModel').value = deviceSettings.sensors.turbidityModel || 'Chemitec S461S LT';
            document.getElementById('turbidityRange').value = deviceSettings.sensors.turbidityRange || '0-100';
            document.getElementById('steielPort').value = deviceSettings.sensors.steielPort || '/dev/ttyUSB0';
            document.getElementById('steielAddress').value = deviceSettings.sensors.steielAddress || 1;
            document.getElementById('turbidityPort').value = deviceSettings.sensors.turbidityPort || '/dev/ttyUSB1';
            document.getElementById('turbidityAddress').value = deviceSettings.sensors.turbidityAddress || 1;
        }
    }
    
    // Notification settings
    if (localStorage.getItem('notificationSettings')) {
        const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings'));
        
        document.getElementById('enableNotifications').checked = notificationSettings.enabled !== false;
        document.getElementById('enableEmailNotifications').checked = notificationSettings.emailEnabled !== false;
        document.getElementById('emailServer').value = notificationSettings.emailServer || 'smtp.gmail.com';
        document.getElementById('emailPort').value = notificationSettings.emailPort || 587;
        document.getElementById('emailSecurity').value = notificationSettings.emailSecurity || 'tls';
        document.getElementById('emailUsername').value = notificationSettings.emailUsername || '';
        document.getElementById('emailPassword').value = notificationSettings.emailPassword || '';
        document.getElementById('emailFrom').value = notificationSettings.emailFrom || '';
        document.getElementById('emailTo').value = notificationSettings.emailTo || '';
        
        document.getElementById('notifyParameterAlerts').checked = notificationSettings.notifyParameterAlerts !== false;
        document.getElementById('notifyDosingEvents').checked = notificationSettings.notifyDosingEvents !== false;
        document.getElementById('notifySystemEvents').checked = notificationSettings.notifySystemEvents !== false;
        document.getElementById('notifyMaintenanceReminders').checked = notificationSettings.notifyMaintenanceReminders !== false;
        document.getElementById('notifyChemicalLevels').checked = notificationSettings.notifyChemicalLevels === true;
    }
    
    // Maintenance settings
    if (localStorage.getItem('maintenanceSettings')) {
        const maintenanceSettings = JSON.parse(localStorage.getItem('maintenanceSettings'));
        
        document.getElementById('backwashFrequency').value = maintenanceSettings.backwashFrequency || 'weekly';
        document.getElementById('backwashDay').value = maintenanceSettings.backwashDay || '3';
        document.getElementById('backwashTime').value = maintenanceSettings.backwashTime || '06:00';
        document.getElementById('enableAutoBackwash').checked = maintenanceSettings.enableAutoBackwash === true;
        document.getElementById('chemicalCheckFrequency').value = maintenanceSettings.chemicalCheckFrequency || 'weekly';
        document.getElementById('pacReorderLevel').value = maintenanceSettings.pacReorderLevel || 20;
        document.getElementById('phCalibrationInterval').value = maintenanceSettings.phCalibrationInterval || 'monthly';
        document.getElementById('turbidityCalibrationInterval').value = maintenanceSettings.turbidityCalibrationInterval || 'monthly';
    }
}

/**
 * Save system settings
 */
function saveSystemSettings(e) {
    e.preventDefault();
    
    const settings = {
        name: document.getElementById('systemName').value,
        defaultMode: document.getElementById('defaultMode').value,
        tempUnit: document.getElementById('tempUnit').value,
        timeFormat: document.getElementById('timeFormat').value,
        dataSamplingRate: document.getElementById('dataSamplingRate').value,
        dataRetention: document.getElementById('dataRetention').value,
        enableSimulation: document.getElementById('enableSimulation').checked
    };
    
    localStorage.setItem('systemSettings', JSON.stringify(settings));
    showToast('System settings saved successfully');
}

/**
 * Save parameter settings
 */
function saveParameterSettings(e) {
    e.preventDefault();
    
    // Get existing settings or initialize new object
    const parameterSettings = localStorage.getItem('parameterSettings') 
        ? JSON.parse(localStorage.getItem('parameterSettings')) 
        : {};
    
    // Update pH settings
    parameterSettings.ph = {
        targetMin: parseFloat(document.getElementById('phTargetMin').value),
        targetMax: parseFloat(document.getElementById('phTargetMax').value),
        alertLow: parseFloat(document.getElementById('phAlertLow').value),
        alertHigh: parseFloat(document.getElementById('phAlertHigh').value),
        doseRate: parseInt(document.getElementById('phDoseRate').value),
        dosingDelay: parseInt(document.getElementById('phDosingDelay').value),
        autoDosing: document.getElementById('phAutoDosing').checked
    };
    
    // Add validation for target ranges
    if (parameterSettings.ph.targetMin >= parameterSettings.ph.targetMax) {
        showToast('Target minimum must be less than target maximum', 'warning');
        return;
    }
    
    if (parameterSettings.ph.alertLow >= parameterSettings.ph.targetMin) {
        showToast('Alert low must be less than target minimum', 'warning');
        return;
    }
    
    if (parameterSettings.ph.alertHigh <= parameterSettings.ph.targetMax) {
        showToast('Alert high must be greater than target maximum', 'warning');
        return;
    }
    
    // Save settings
    localStorage.setItem('parameterSettings', JSON.stringify(parameterSettings));
    
    // Update dashboard with new values
    updateDashboardWithSettings();
    
    showToast('Parameter settings saved successfully');
}

/**
 * Save device settings
 */
function saveDeviceSettings(e) {
    e.preventDefault();
    
    // Determine which form was submitted
    const formId = e.target.id;
    
    // Get existing settings or initialize new object
    const deviceSettings = localStorage.getItem('deviceSettings') 
        ? JSON.parse(localStorage.getItem('deviceSettings')) 
        : {};
    
    if (formId === 'pumpsSettingsForm') {
        // Save pump settings
        deviceSettings.pumps = {
            phPumpType: document.getElementById('phPumpType').value,
            phPumpMaxFlow: parseFloat(document.getElementById('phPumpMaxFlow').value),
            clPumpType: document.getElementById('clPumpType').value,
            clPumpMaxFlow: parseFloat(document.getElementById('clPumpMaxFlow').value),
            pacPumpType: document.getElementById('pacPumpType').value,
            pacPumpMaxFlow: parseFloat(document.getElementById('pacPumpMaxFlow').value),
            pacTubeSize: document.getElementById('pacTubeSize').value
        };
        
        showToast('Pump settings saved successfully');
    }
    else if (formId === 'sensorsSettingsForm') {
        // Save sensor settings
        deviceSettings.sensors = {
            turbidityModel: document.getElementById('turbidityModel').value,
            turbidityRange: document.getElementById('turbidityRange').value,
            steielPort: document.getElementById('steielPort').value,
            steielAddress: parseInt(document.getElementById('steielAddress').value),
            turbidityPort: document.getElementById('turbidityPort').value,
            turbidityAddress: parseInt(document.getElementById('turbidityAddress').value)
        };
        
        showToast('Sensor settings saved successfully');
    }
    
    // Save settings
    localStorage.setItem('deviceSettings', JSON.stringify(deviceSettings));
}

/**
 * Save notification settings
 */
function saveNotificationSettings(e) {
    e.preventDefault();
    
    const settings = {
        enabled: document.getElementById('enableNotifications').checked,
        emailEnabled: document.getElementById('enableEmailNotifications').checked,
        emailServer: document.getElementById('emailServer').value,
        emailPort: parseInt(document.getElementById('emailPort').value),
        emailSecurity: document.getElementById('emailSecurity').value,
        emailUsername: document.getElementById('emailUsername').value,
        emailPassword: document.getElementById('emailPassword').value,
        emailFrom: document.getElementById('emailFrom').value,
        emailTo: document.getElementById('emailTo').value,
        notifyParameterAlerts: document.getElementById('notifyParameterAlerts').checked,
        notifyDosingEvents: document.getElementById('notifyDosingEvents').checked,
        notifySystemEvents: document.getElementById('notifySystemEvents').checked,
        notifyMaintenanceReminders: document.getElementById('notifyMaintenanceReminders').checked,
        notifyChemicalLevels: document.getElementById('notifyChemicalLevels').checked
    };
    
    // Basic validation
    if (settings.emailEnabled) {
        if (!settings.emailServer || !settings.emailUsername || !settings.emailPassword || !settings.emailTo) {
            showToast('Please fill in all email settings', 'warning');
            return;
        }
    }
    
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    showToast('Notification settings saved successfully');
}

/**
 * Save maintenance settings
 */
function saveMaintenanceSettings(e) {
    e.preventDefault();
    
    const settings = {
        backwashFrequency: document.getElementById('backwashFrequency').value,
        backwashDay: document.getElementById('backwashDay').value,
        backwashTime: document.getElementById('backwashTime').value,
        enableAutoBackwash: document.getElementById('enableAutoBackwash').checked,
        chemicalCheckFrequency: document.getElementById('chemicalCheckFrequency').value,
        pacReorderLevel: parseInt(document.getElementById('pacReorderLevel').value),
        phCalibrationInterval: document.getElementById('phCalibrationInterval').value,
        turbidityCalibrationInterval: document.getElementById('turbidityCalibrationInterval').value
    };
    
    localStorage.setItem('maintenanceSettings', JSON.stringify(settings));
    showToast('Maintenance settings saved successfully');
    
    // Update next maintenance dates
    updateMaintenanceSchedule();
}

/**
 * Setup form dependencies (show/hide fields based on other selections)
 */
function setupFormDependencies() {
    // Email notifications dependency
    const enableEmailNotifications = document.getElementById('enableEmailNotifications');
    if (enableEmailNotifications) {
        enableEmailNotifications.addEventListener('change', function() {
            const emailFields = document.querySelectorAll('#notificationSettingsForm input:not(#enableEmailNotifications):not([type="checkbox"]), #notificationSettingsForm select');
            emailFields.forEach(field => {
                field.disabled = !this.checked;
            });
        });
        
        // Initial state
        const emailFields = document.querySelectorAll('#notificationSettingsForm input:not(#enableEmailNotifications):not([type="checkbox"]), #notificationSettingsForm select');
        emailFields.forEach(field => {
            field.disabled = !enableEmailNotifications.checked;
        });
    }
    
    // Enable/disable backwash day/time based on frequency
    const backwashFrequency = document.getElementById('backwashFrequency');
    if (backwashFrequency) {
        backwashFrequency.addEventListener('change', function() {
            const backwashDay = document.getElementById('backwashDay');
            if (backwashDay) {
                backwashDay.disabled = this.value === 'daily';
            }
        });
        
        // Initial state
        const backwashDay = document.getElementById('backwashDay');
        if (backwashDay) {
            backwashDay.disabled = backwashFrequency.value === 'daily';
        }
    }
}

/**
 * Test email notification
 */
function testEmailNotification() {
    // In a real application, this would send a test email
    // For this demo, we'll just show a toast
    showToast('Test email sent successfully');
}

/**
 * Update dashboard with new settings
 */
function updateDashboardWithSettings() {
    // This function would update the dashboard based on saved settings
    // For example, updating parameter target ranges, pump status displays, etc.
    
    // For now, we'll just log a message
    console.log('Updating dashboard with new settings');
}

/**
 * Update maintenance schedule
 */
function updateMaintenanceSchedule() {
    // This function would calculate and display the next maintenance dates
    // based on the configured settings
    
    // For now, we'll just log a message
    console.log('Updating maintenance schedule');
}

function fixSettingsTab() {
    console.log('Fixing Settings Tab with direct DOM manipulation');
    
    // First, let's find the parent container
    const settingsTab = document.getElementById('settings-tab');
    if (!settingsTab) {
        console.error('Settings tab not found');
        return;
    }
    
    // Make the tab fully visible with !important
    settingsTab.setAttribute('style', 'display: block !important; visibility: visible !important;');
    
    // Find each tab pane and make it directly visible
    const allPanes = settingsTab.querySelectorAll('.tab-pane');
    console.log(`Found ${allPanes.length} tab panes`);
    
    // Completely replace the tab system with a simpler one
    // First, create a new container for our content
    const newContainer = document.createElement('div');
    newContainer.className = 'settings-content-fix';
    
    // Create direct links for switching content
    const linksBar = document.createElement('div');
    linksBar.className = 'btn-group mb-4';
    linksBar.setAttribute('role', 'group');
    
    const tabNames = ['System', 'Parameters', 'Devices', 'Notifications', 'Maintenance'];
    const tabIds = ['system-settings', 'parameter-settings', 'device-settings', 'notification-settings', 'maintenance-settings'];
    
    // Create buttons
    tabNames.forEach((name, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-primary';
        btn.textContent = name;
        btn.onclick = function() {
            // Hide all content divs
            document.querySelectorAll('.settings-content-fix > div.content-panel').forEach(div => {
                div.style.display = 'none';
            });
            
            // Show the selected one
            const contentDiv = document.getElementById('fixed-' + tabIds[index]);
            if (contentDiv) {
                contentDiv.style.display = 'block';
            }
            
            // Update button states
            document.querySelectorAll('.settings-content-fix .btn-group button').forEach(b => {
                b.className = 'btn btn-outline-primary';
            });
            this.className = 'btn btn-primary';
        };
        linksBar.appendChild(btn);
    });
    
    newContainer.appendChild(linksBar);
    
    // For each tab pane, create a new content panel
    tabIds.forEach((id, index) => {
        const pane = document.getElementById(id);
        if (pane) {
            // Create a new content div
            const contentDiv = document.createElement('div');
            contentDiv.id = 'fixed-' + id;
            contentDiv.className = 'content-panel';
            contentDiv.style.display = index === 0 ? 'block' : 'none'; // Show first tab by default
            
            // Copy content from original pane
            contentDiv.innerHTML = pane.innerHTML;
            
            // Add to container
            newContainer.appendChild(contentDiv);
        }
    });
    
    // Replace original content with our fixed version
    settingsTab.innerHTML = '';
    settingsTab.appendChild(newContainer);
    
    // Trigger click on first button to initialize
    const firstButton = document.querySelector('.settings-content-fix .btn-group button');
    if (firstButton) {
        firstButton.click();
    }
}

// Call this function
fixSettingsTab();