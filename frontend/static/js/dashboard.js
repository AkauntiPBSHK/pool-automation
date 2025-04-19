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
    // Update turbidity detail panel
    document.getElementById('turbidityDetailValue').textContent = mockData.turbidity.toFixed(2);
    
    // Update turbidity marker position
    const turbidityPercentage = ((mockData.turbidity - 0.05) / (0.5 - 0.05)) * 100;
    document.querySelector('.turbidity-marker').style.left = `${turbidityPercentage}%`;
    
    // Update PAC panel
    document.getElementById('pacDosingRate').textContent = mockData.pacDosingRate;
    document.getElementById('pacPumpDetailStatus').innerHTML = mockData.pacPumpRunning ? 
        '<i class="bi bi-droplet-fill me-1 text-primary"></i> Running' : 
        '<i class="bi bi-droplet me-1"></i> Idle';
    
    if (mockData.pacPumpRunning) {
        document.getElementById('pacPumpDetailStatus').className = 'text-primary pump-active';
    } else {
        document.getElementById('pacPumpDetailStatus').className = 'text-secondary';
    }
    
    // Update filter efficiency calculation (simplified simulation)
    const efficiency = Math.round(85 - mockData.turbidity * 100);
    document.getElementById('filterEfficiency').textContent = `${efficiency}%`;
    
    // Update filter load progress 
    const filterLoad = Math.round(mockData.turbidity * 100) + 10;
    document.getElementById('filterLoadProgress').style.width = `${filterLoad}%`;
    document.getElementById('filterLoadProgress').textContent = `${filterLoad}%`;
    document.getElementById('filterLoadProgress').setAttribute('aria-valuenow', filterLoad);
    
    // Update filter load color based on value
    if (filterLoad < 40) {
        document.getElementById('filterLoadProgress').className = 'progress-bar bg-success';
    } else if (filterLoad < 70) {
        document.getElementById('filterLoadProgress').className = 'progress-bar bg-warning';
    } else {
        document.getElementById('filterLoadProgress').className = 'progress-bar bg-danger';
    }
    
    // Update PAC level indicator randomly for simulation
    if (Math.random() > 0.95) {
        const pacLevel = Math.round(Math.random() * 30) + 40; // 40-70%
        document.getElementById('pacLevelIndicator').style.height = `${pacLevel}%`;
        document.getElementById('pacLevelIndicator').setAttribute('aria-valuenow', pacLevel);
        document.querySelector('#pacLevelIndicator').nextElementSibling.textContent = `${pacLevel}%`;
    }
    
    // Update trends randomly for simulation
    if (Math.random() > 0.7) {
        const turbidityTrend = Math.random() > 0.5 ? 
            '<i class="bi bi-arrow-up-short trend-up"></i> +0.02 in 1h' : 
            '<i class="bi bi-arrow-down-short trend-down"></i> -0.02 in 1h';
        document.getElementById('turbidityTrend').innerHTML = turbidityTrend;
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