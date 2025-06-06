/**
 * Pool Automation Dashboard JavaScript
 */

window.activeDosingSessions = {
    ph: false,
    cl: false,
    pac: false
};

const buttonToDataset = {
    'pH': 0,
    'ORP': 1,
    'Free Chlorine': 2,
    'Combined Cl': 3,
    'Turbidity': 4,
    'Temperature': 5
};

const datasetToButton = {
    0: 'pH',
    1: 'ORP',
    2: 'Free Chlorine',
    3: 'Combined Cl',
    4: 'Turbidity',
    5: 'Temperature'
};

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

// Updated code with transport configuration
const socketUrl = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnectionAttempts: 5
});
window.mockData = mockData;

// Global variables for charts
let chemistryChart = null;
window.historyChart = null

if (typeof window.historyChart === 'undefined') {
    window.historyChart = null;
}

// Make it globally accessible by attaching to window
window.updatePumpStatus = function(id, running) {
    // Check if element exists before updating
    const statusEl = document.getElementById(id + 'Status');
    if (!statusEl) {
        console.warn(`Element with ID ${id}Status not found`);
        return;
    }
    
    const isPac = id.includes('pac');
    
    if (running) {
        // Update text and styling for active pump
        statusEl.innerHTML = `<i class="bi bi-droplet-fill me-1"></i> ${isPac ? 'PAC pump' : 'Pump'} active`;
        statusEl.className = 'text-primary pump-active';
    } else {
        // Update text and styling for inactive pump
        statusEl.innerHTML = `<i class="bi bi-droplet me-1"></i> ${isPac ? 'PAC pump' : 'Pump'} inactive`;
        statusEl.className = 'text-secondary';
    }
    
    // Log the update for debugging
    console.log(`Updated ${id}Status to ${running ? 'active' : 'inactive'}`);
};

// Improve DOM Content Loading sequence
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized - starting boot sequence');
    
    // Stage 1: Initialize navigation and UI
    console.log('Stage 1: Initializing UI and controls');
    initializeNavigation();

    // Ensure consistent global reference to the chart
    if (typeof historyChart !== 'undefined' && historyChart !== null) {
        window.historyChart = historyChart;
    }

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = tab.id === 'overview-tab' ? 'block' : 'none';
    });

    // Setup event listeners
    setupEventListeners();
    setupEnhancedChartControls();
    
    // Add accessibility features
    enhanceSidebarAccessibility();
    enhanceParameterCardsAccessibility();
    enhanceControlsAccessibility();
    updateAllRangeAriaAttributes();
    enhanceInitializeHistoryChart();
    enhanceChartInitialization();
    setupDosingEventsToggle();
    enhanceSyncParameterSelection();
    enhanceHistoryChartInit();
    fixDosingEventsToggle();

    // Stage 2: Initialize panel controls (without charts yet)
    console.log('Stage 2: Initializing panel controls');
    initializeWaterChemistryControls();
    initializeTurbidityPACControls();
    initializeHistoryTab();
    initializeSettingsTab();
    
    // Stage 3: Load settings and initial data
    console.log('Stage 3: Loading settings and initial data');
    loadSavedSettings();
    updateUIFromSettings();
    updateParameterDisplays(mockData);
    setupDosingEventsToggle();

    // Stage 4: Initialize charts after a short delay
    console.log('Stage 4: Initializing charts (with delay)');
    setTimeout(() => {
        try {
            initializeCharts();
        } catch (error) {
            console.error('Error initializing charts:', error);
            // Maybe show a toast notification to the user
            showToast('Error initializing charts. Some features may be limited.', 'warning');
        }

        // Stage 5: Set up WebSocket after charts are ready
        console.log('Stage 5: Setting up WebSocket connection');
        setTimeout(() => {
            if (window.WebSocketManager && typeof window.WebSocketManager.initializeWebSocketFeatures === 'function') {
                window.WebSocketManager.initializeWebSocketFeatures();
            }
            
            // Final stage: Start data polling or simulation
            console.log('Final stage: Starting data updates');
            fetchStatus();
            fetchDosingStatus();
            
            if (getParameterByName('simulate') !== 'false') {
                startSimulation();
            }
            
            console.log('System initialization complete');
        }, 300);
    }, 200);
});

/**
 * Set up event listeners in one place for better organization
 */
function setupEventListeners() {
    // Mode toggle buttons
    document.getElementById('autoMode').addEventListener('click', function() {
        setMode('automatic');
    });
    
    document.getElementById('manualMode').addEventListener('click', function() {
        setMode('manual');
    });
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', function() {
        if (socket && socket.connected) {
            socket.emit('request_system_state');
            showToast('Requesting latest system data...', 'info');
        } else {
            fetchStatus();
            updateParameterDisplays(mockData);
        }
    });
}

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
    console.log(`Starting pH dosing for ${duration} seconds`);
    
    // Set dosing session active
    window.activeDosingSessions.ph = true;
    
    // Update local data
    mockData.phPumpRunning = true;
    
    // Update UI status indicators
    updatePumpStatus('phPump', true);
    updatePumpStatus('phPumpDetail', true);
    
    // Show toast notification
    showToast(`pH dosing started for ${duration} seconds`);
    
    // Auto-stop after duration
    setTimeout(() => {
        stopPHDosing();
    }, duration * 1000);
}

function stopPHDosing() {
    console.log('Stopping pH dosing');
    
    // End dosing session
    window.activeDosingSessions.ph = false;
    
    // Update local data
    mockData.phPumpRunning = false;
    
    // Update UI status indicators
    updatePumpStatus('phPump', false);
    updatePumpStatus('phPumpDetail', false);
    
    // Show toast notification
    showToast('pH dosing stopped');
}

/**
 * Simulate starting chlorine dosing
 */
function startCLDosing(duration) {
    console.log(`Starting chlorine dosing for ${duration} seconds`);
    
    // Set dosing session active
    window.activeDosingSessions.cl = true;
    
    // Update local data
    mockData.clPumpRunning = true;
    
    // Update UI status indicators
    updatePumpStatus('clPump', true);
    updatePumpStatus('clPumpDetail', true);
    
    // Show toast notification
    showToast(`Chlorine dosing started for ${duration} seconds`);
    
    // Auto-stop after duration
    setTimeout(() => {
        stopCLDosing();
    }, duration * 1000);
}

function stopCLDosing() {
    console.log('Stopping chlorine dosing');
    
    // End dosing session
    window.activeDosingSessions.cl = false;
    
    // Update local data
    mockData.clPumpRunning = false;
    
    // Update UI status indicators
    updatePumpStatus('clPump', false);
    updatePumpStatus('clPumpDetail', false);
    
    // Show toast notification
    showToast('Chlorine dosing stopped');
}

/**
 * Show a toast notification with different styles for message types
 * @param {string} message - Message to display
 * @param {string} type - Message type: 'success', 'warning', 'danger', 'info'
 */
function showToast(message, type = 'success') {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }

    // Get appropriate icon for the message type
    let icon = 'info-circle';
    let bgClass = 'bg-primary';
    
    switch (type) {
        case 'success':
            icon = 'check-circle';
            bgClass = 'bg-success';
            break;
        case 'warning':
            icon = 'exclamation-triangle';
            bgClass = 'bg-warning text-dark';
            break;
        case 'danger':
            icon = 'exclamation-circle';
            bgClass = 'bg-danger';
            break;
        case 'info':
            icon = 'info-circle';
            bgClass = 'bg-info text-dark';
            break;
    }

    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
    <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header ${bgClass} text-white">
            <i class="bi bi-${icon} me-2"></i>
            <strong class="me-auto">Pool Automation</strong>
            <small>Just now</small>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
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
    const toast = new bootstrap.Toast(toastElement, { 
        autohide: true, 
        delay: type === 'danger' ? 5000 : 3000 // Show error messages longer
    });
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

window.showToast = showToast;

// Initialize chemistry chart with proper cleanup
function initializeChemistryChart() {
    console.log('Initializing chemistry chart');
    const ctx = document.getElementById('chemistryChart');
    
    if (!ctx) {
        console.error('Chemistry chart canvas not found!');
        return;
    }
    
    // Destroy existing chart if it exists
    if (window.chemistryChart instanceof Chart) {
        console.log('Destroying existing chemistry chart');
        window.chemistryChart.destroy();
    }
    
    try {
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
        
        // Create chart with better error handling
        window.chemistryChart = new Chart(ctx, {
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
                resizeDelay: 100,
                onResize: function(chart, size) {
                    // Adjust point size and line width based on chart size
                    if (size.width < 400) {
                        chart.data.datasets.forEach(dataset => {
                            dataset.pointRadius = 1;
                            dataset.borderWidth = 1;
                        });
                        chart.options.scales.x.ticks.maxTicksLimit = 4;
                    } else if (size.width < 768) {
                        chart.data.datasets.forEach(dataset => {
                            dataset.pointRadius = 2;
                            dataset.borderWidth = 2;
                        });
                        chart.options.scales.x.ticks.maxTicksLimit = 6;
                    } else {
                        chart.data.datasets.forEach(dataset => {
                            dataset.pointRadius = 3;
                            dataset.borderWidth = 2;
                        });
                        chart.options.scales.x.ticks.maxTicksLimit = 8;
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 8 : 10
                                };
                            }
                        }
                    },
                    'y-ph': {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'pH',
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 10 : 12
                                };
                            }
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
                            text: 'Chlorine (mg/L)',
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 10 : 12
                                };
                            }
                        },
                        min: 0,
                        max: 3.0,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: function(context) {
                                const chart = context.chart;
                                return chart.width < 400 ? 10 : 15;
                            },
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 10 : 12
                                };
                            }
                        }
                    },
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
        
        console.log('Chemistry chart initialized successfully');
    } catch (error) {
        console.error('Error initializing chemistry chart:', error);
    }
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

    // Update axis options for better display with different time ranges
    if (hours <= 24) {
        chemistryChart.options.scales.x.ticks.maxTicksLimit = 8;
    } else if (hours <= 48) {
        chemistryChart.options.scales.x.ticks.maxTicksLimit = 12;
    } else {
        chemistryChart.options.scales.x.ticks.maxTicksLimit = 14;
    }

    // Force responsive adaptation to current size
    const currentWidth = chemistryChart.width;
    chemistryChart.options.onResize(chemistryChart, {width: currentWidth, height: chemistryChart.height});

    // Update chart
    chemistryChart.update();

    // Update ARIA label
    const chartContainer = document.querySelector('#chemistryChart').closest('.chart-container');
    if (chartContainer) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        
        // Format dates for accessibility description
        const formatDate = (date) => {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        };
        
        chartContainer.setAttribute('aria-label', 
            `Chart showing pH and chlorine history from ${formatDate(startDate)} to ${formatDate(endDate)}`);
    }
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
    
    // Update pH marker position and ARIA attribute
    const phPercentage = ((mockData.ph - 6.8) / (8.0 - 6.8)) * 100;
    const phMarker = document.querySelector('.ph-marker');
    if (phMarker) {
        phMarker.style.left = `${phPercentage}%`;
        
        // Update ARIA attributes for pH progress container
        const phProgress = phMarker.closest('.progress, .parameter-range');
        if (phProgress) {
            phProgress.setAttribute('aria-valuenow', mockData.ph);
        }
    }
    
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
    
    // Update chlorine marker position and ARIA attribute
    const clPercentage = ((mockData.freeChlorine - 0.5) / (5.0 - 0.5)) * 100;
    const chlorineMarker = document.querySelector('.chlorine-marker');
    if (chlorineMarker) {
        chlorineMarker.style.left = `${clPercentage}%`;
        
        // Update ARIA attributes for chlorine progress container
        const clProgress = chlorineMarker.closest('.progress, .parameter-range');
        if (clProgress) {
            clProgress.setAttribute('aria-valuenow', mockData.freeChlorine);
        }
    }
    
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

    const phBlueIndicator = document.querySelector('.ph-control .blue-indicator');
    if (phBlueIndicator) {
        const phPosition = ((mockData.ph - 6.8) / (8.0 - 6.8)) * 100;
        phBlueIndicator.style.left = `${phPosition}%`;
        
        const phProgressBar = phBlueIndicator.closest('.progress');
        if (phProgressBar) {
            phProgressBar.setAttribute('aria-valuenow', mockData.ph);
        }
    }

    const clBlueIndicator = document.querySelector('.chlorine-control .blue-indicator');
    if (clBlueIndicator) {
        const clPosition = ((mockData.freeChlorine - 0.5) / (5.0 - 0.5)) * 100;
        clBlueIndicator.style.left = `${clPosition}%`;
        
        const clProgressBar = clBlueIndicator.closest('.progress');
        if (clProgressBar) {
            clProgressBar.setAttribute('aria-valuenow', mockData.freeChlorine);
        }
    }
}

/**
 * Updates all parameter displays with current values
 * 
 * This function refreshes the UI for all monitored parameters (pH, ORP, chlorine, etc.)
 * It updates values, status indicators, and position markers for each parameter.
 * 
 * @param {Object} data - Object containing all current parameter values
 * @param {number} data.ph - Current pH value
 * @param {number} data.orp - Current ORP value in mV
 * @param {number} data.freeChlorine - Current free chlorine value in mg/L
 * @param {number} data.combinedChlorine - Current combined chlorine value in mg/L
 * @param {number} data.turbidity - Current turbidity value in NTU
 * @param {number} data.temperature - Current temperature in °C
 * @param {number} data.uvIntensity - Current UV intensity percentage
 * @param {boolean} data.phPumpRunning - Whether pH pump is currently active
 * @param {boolean} data.clPumpRunning - Whether chlorine pump is currently active
 * @param {boolean} data.pacPumpRunning - Whether PAC pump is currently active
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
 * Update a specific parameter in the UI
 * 
 * Updates the value display, status indicator (good/fair/poor), 
 * and position marker for a given parameter.
 * 
 * @param {string} id - Parameter ID (e.g., 'ph', 'orp', 'turbidity')
 * @param {number} value - Current parameter value
 * @param {number} lowThreshold - Lower threshold for "good" status
 * @param {number} highThreshold - Upper threshold for "good" status
 * @param {number} minValue - Minimum value on the scale
 * @param {number} maxValue - Maximum value on the scale
 */
function updateParameter(id, value, lowThreshold, highThreshold, minValue, maxValue) {
    // Update value with consistent formatting
    const valueEl = document.getElementById(id + 'Value');
    if (valueEl) {
        valueEl.textContent = formatParameterValue(value, id);
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

    // Update ARIA attributes
    updateAriaAttributes(id, value, minValue, maxValue);
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

// Add this near the top of dashboard.js
/**
 * Update pump status display
 * @param {string} id - Element ID prefix without 'Status' suffix
 * @param {boolean} running - Whether the pump is running
 */
function updatePumpStatus(id, running) {
    console.log(`Updating pump status: ${id} -> ${running ? 'active' : 'inactive'}`);
    
    const statusEl = document.getElementById(`${id}Status`);
    if (!statusEl) {
        console.warn(`Element not found: ${id}Status`);
        return;
    }
    
    const isPac = id.includes('pac');
    
    if (running) {
        statusEl.innerHTML = `<i class="bi bi-droplet-fill me-1 text-primary"></i>${isPac ? 'PAC pump' : 'Pump'} active`;
        statusEl.className = 'text-primary pump-active';
    } else {
        statusEl.innerHTML = `<i class="bi bi-droplet me-1"></i>${isPac ? 'PAC pump' : 'Pump'} inactive`;
        statusEl.className = 'text-secondary';
    }
}

window.updatePumpStatus = updatePumpStatus;

/**
 * Fetch current system status
 */
function fetchStatus() {
    apiCall('/api/status', 
        {}, // Default options
        (data) => {
            console.log('Status:', data);
            const mode = data.simulation_mode ? 'simulation' : 'production';
            updateStatusBar(`System running in ${mode} mode (v${data.version})`, 'info');
        },
        (error) => {
            console.error('Error fetching status:', error);
            updateStatusBar('Error connecting to server. Using simulation mode.', 'danger');
            // Fall back to simulation mode
            simulateDataChanges();
        }
    );
}

/**
 * Fetch dashboard data
 */
function fetchDashboardData() {
    apiCall('/api/dashboard',
        {}, // Default options
        (data) => {
            // Update UI with real data
            updateParameterDisplays(data);
            updateWaterChemistryDisplays();
            updateTurbidityPACDisplays();
            
            // Cache the data for offline use
            localStorage.setItem('lastDashboardData', JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        },
        (error) => {
            console.error('Error fetching dashboard data:', error);
            
            // Check if we have cached data that's not too old (< 1 hour)
            const cachedDataJSON = localStorage.getItem('lastDashboardData');
            if (cachedDataJSON) {
                try {
                    const cachedData = JSON.parse(cachedDataJSON);
                    const isCacheValid = (Date.now() - cachedData.timestamp) < (60 * 60 * 1000); // 1 hour
                    
                    if (isCacheValid) {
                        showToast('Using cached data from previous session', 'info');
                        updateParameterDisplays(cachedData.data);
                        updateWaterChemistryDisplays();
                        updateTurbidityPACDisplays();
                        return;
                    }
                } catch (err) {
                    console.error('Error parsing cached data:', err);
                }
            }
            
            // Fall back to mock data if no valid cache
            updateParameterDisplays(mockData);
        }
    );
}

/**
 * Update status bar
 */
function updateStatusBar(message, type) {
    const statusBar = document.getElementById('statusBar');
    statusBar.className = `alert alert-${type}`;
    statusBar.textContent = message;
}

// Update setMode function to keep PAC mode in sync
function setMode(mode) {
    const autoBtn = document.getElementById('autoMode');
    const manualBtn = document.getElementById('manualMode');
    
    if (mode === 'automatic') {
        // Update UI
        autoBtn.classList.add('btn-success', 'active');
        autoBtn.classList.remove('btn-outline-secondary');
        manualBtn.classList.add('btn-outline-secondary');
        manualBtn.classList.remove('btn-warning', 'active');
        
        // Update PAC mode to match global mode
        const pacAutoSwitch = document.getElementById('pacAutoSwitch');
        if (pacAutoSwitch && !pacAutoSwitch.checked) {
            pacAutoSwitch.checked = true;
            // Call API to update server
            fetch('/api/dosing/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'AUTOMATIC' }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    togglePACAutoMode(true);
                }
            });
        }
        
        updateStatusBar('Automatic mode activated', 'success');
    } else {
        // Update UI
        manualBtn.classList.add('btn-warning', 'active');
        manualBtn.classList.remove('btn-outline-secondary');
        autoBtn.classList.add('btn-outline-secondary');
        autoBtn.classList.remove('btn-success', 'active');
        
        // Update PAC mode to match global mode
        const pacAutoSwitch = document.getElementById('pacAutoSwitch');
        if (pacAutoSwitch && pacAutoSwitch.checked) {
            pacAutoSwitch.checked = false;
            // Call API to update server
            fetch('/api/dosing/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'MANUAL' }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    togglePACAutoMode(false);
                }
            });
        }
        
        updateStatusBar('Manual mode activated', 'warning');
    }

    updateControlsBasedOnMode();
}

// Replace setInterval with a more efficient approach
function startSimulation() {
    let lastTimestamp = 0;
    const simulationInterval = 5000; // 5 seconds
    
    function simulationLoop(timestamp) {
        if (timestamp - lastTimestamp >= simulationInterval) {
            simulateDataChanges();
            lastTimestamp = timestamp;
        }
        
        requestAnimationFrame(simulationLoop);
    }
    
    requestAnimationFrame(simulationLoop);
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
    
// Update PAC auto switch handler to keep global mode in sync
    document.getElementById('pacAutoSwitch').addEventListener('change', function() {
        const mode = this.checked ? 'AUTOMATIC' : 'MANUAL';
        
        fetch('/api/dosing/mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: mode }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update PAC controls
                togglePACAutoMode(this.checked);
                
                // Also update global mode buttons
                const autoBtn = document.getElementById('autoMode');
                const manualBtn = document.getElementById('manualMode');
                
                if (this.checked) { // AUTOMATIC mode
                    autoBtn.classList.add('btn-success', 'active');
                    autoBtn.classList.remove('btn-outline-secondary');
                    manualBtn.classList.add('btn-outline-secondary');
                    manualBtn.classList.remove('btn-warning', 'active');
                    updateStatusBar('Automatic mode activated', 'success');
                } else { // MANUAL mode
                    manualBtn.classList.add('btn-warning', 'active');
                    manualBtn.classList.remove('btn-outline-secondary');
                    autoBtn.classList.add('btn-outline-secondary');
                    autoBtn.classList.remove('btn-success', 'active');
                    updateStatusBar('Manual mode activated', 'warning');
                }
            }
        });
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
        
        // Enable threshold inputs in auto mode
        document.getElementById('pacHighThreshold').disabled = false;
        document.getElementById('pacLowThreshold').disabled = false;
        document.getElementById('pacTargetValue').disabled = false;
        
        showToast('PAC dosing switched to automatic mode');
    } else {
        document.getElementById('pacDosingStatus').textContent = 'Manual';
        document.getElementById('pacDosingStatus').className = 'badge bg-warning';
        
        // Always enable manual controls when in PAC manual mode
        document.getElementById('pacDoseBtn').disabled = false;
        document.getElementById('pacStopBtn').disabled = false;
        document.getElementById('pacFlowRate').disabled = false;
        
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

function startPACDosing(flowRate) {
    console.log(`Starting PAC dosing at ${flowRate} ml/h`);
    
    // Set dosing session active
    window.activeDosingSessions.pac = true;
    
    // Update local data
    mockData.pacPumpRunning = true;
    mockData.pacDosingRate = parseInt(flowRate);
    
    // Update UI status indicators
    updatePumpStatus('pacPump', true);
    updatePumpStatus('pacPumpDetail', true);
    
    // Show toast notification
    showToast(`PAC dosing started at ${flowRate} ml/h`);
    
    // API call
    fetch('/api/pumps/pac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            command: 'start',
            duration: 30,
            flow_rate: parseInt(flowRate)
        }),
    })
    .catch(error => console.error('Error starting PAC dosing:', error));
    
    // For demo purposes, auto-stop after 30 seconds
    setTimeout(() => {
        stopPACDosing();
    }, 30000);
}

function stopPACDosing() {
    console.log('Stopping PAC dosing');
    
    // End dosing session
    window.activeDosingSessions.pac = false;
    
    // Update local data
    mockData.pacPumpRunning = false;
    
    // Update UI status indicators
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
    
    // Update turbidity marker position and ARIA attributes
    const turbidityPercentage = ((mockData.turbidity - 0.05) / (0.5 - 0.05)) * 100;
    const turbidityMarker = document.querySelector('.turbidity-marker');
    if (turbidityMarker) {
        turbidityMarker.style.left = `${turbidityPercentage}%`;
        
        // Update ARIA attributes
        const turbidityProgress = turbidityMarker.closest('.progress, .parameter-range');
        if (turbidityProgress) {
            turbidityProgress.setAttribute('aria-valuenow', mockData.turbidity);
        }
    }

    // Add ARIA updates to the turbidity blue indicator
    const turbidityBlueIndicator = document.querySelector('.turbidity-control .blue-indicator');
    if (turbidityBlueIndicator) {
        const turbPosition = ((mockData.turbidity - 0.05) / (0.5 - 0.05)) * 100;
        turbidityBlueIndicator.style.left = `${turbPosition}%`;
        
        const turbProgressBar = turbidityBlueIndicator.closest('.progress');
        if (turbProgressBar) {
            turbProgressBar.setAttribute('aria-valuenow', mockData.turbidity);
        }
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
        pacLevelIndicator.parentElement.setAttribute('aria-valuenow', pacLevel);
        
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

// Initialize turbidity chart with proper cleanup
function initializeTurbidityChart() {
    console.log('Initializing turbidity chart');
    const ctx = document.getElementById('turbidityChart');
    
    if (!ctx) {
        console.error('Turbidity chart canvas not found!');
        return;
    }
    
    // Destroy existing chart if it exists
    if (window.turbidityChart instanceof Chart) {
        console.log('Destroying existing turbidity chart');
        window.turbidityChart.destroy();
    }
    
    try {
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
        window.turbidityChart = new Chart(ctx, {
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
                        borderWidth: 2,
                        pointRadius: 8,
                        pointStyle: 'triangle',
                        pointRotation: 180,
                        showLine: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 100,
                onResize: function(chart, size) {
                    // Adjust point size, triangle size, and line width based on chart size
                    if (size.width < 400) {
                        // For main turbidity dataset
                        chart.data.datasets[0].pointRadius = 1;
                        chart.data.datasets[0].borderWidth = 1;
                        
                        // For dosing events triangles
                        chart.data.datasets[1].pointRadius = 4;
                        
                        // Limit the number of x-axis labels
                        chart.options.scales.x.ticks.maxTicksLimit = 4;
                    } else if (size.width < 768) {
                        // For main turbidity dataset
                        chart.data.datasets[0].pointRadius = 2;
                        chart.data.datasets[0].borderWidth = 2;
                        
                        // For dosing events triangles
                        chart.data.datasets[1].pointRadius = 5;
                        
                        // Limit the number of x-axis labels
                        chart.options.scales.x.ticks.maxTicksLimit = 6;
                    } else {
                        // For main turbidity dataset
                        chart.data.datasets[0].pointRadius = 3;
                        chart.data.datasets[0].borderWidth = 2;
                        
                        // For dosing events triangles
                        chart.data.datasets[1].pointRadius = 6;
                        
                        // Limit the number of x-axis labels
                        chart.options.scales.x.ticks.maxTicksLimit = 8;
                    }
                },
                interaction: {
                    mode: 'nearest',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 8 : 10
                                };
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        min: 0.08,
                        max: 0.22,
                        title: {
                            display: true,
                            text: 'Turbidity (NTU)',
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 10 : 12
                                };
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: function(context) {
                                const chart = context.chart;
                                return chart.width < 400 ? 10 : 15;
                            },
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 10 : 12
                                };
                            }
                        }
                    },
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
                                    label += context.parsed.y.toFixed(3) + ' NTU';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });

        console.log('Turbidity chart initialized successfully');
    } catch (error) {
        console.error('Error initializing turbidity chart:', error);
    }
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

    // Update axis options for better display with different time ranges
    if (hours <= 24) {
        turbidityChart.options.scales.x.ticks.maxTicksLimit = 8;
    } else if (hours <= 48) {
        turbidityChart.options.scales.x.ticks.maxTicksLimit = 12;
    } else {
        turbidityChart.options.scales.x.ticks.maxTicksLimit = 14;
    }
    
    // Force responsive adaptation to current size
    const currentWidth = turbidityChart.width;
    turbidityChart.options.onResize(turbidityChart, {width: currentWidth, height: turbidityChart.height});
    
    // Update chart
    turbidityChart.update();

    // Update ARIA label
    const chartContainer = document.querySelector('#turbidityChart').closest('.chart-container');
    if (chartContainer) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        
        // Format dates for accessibility description
        const formatDate = (date) => {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        };
        
        chartContainer.setAttribute('aria-label', 
            `Chart showing turbidity history from ${formatDate(startDate)} to ${formatDate(endDate)}`);
    }
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
    
    // Add event listeners to checkboxes
    document.querySelectorAll('#history-tab input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            syncParameterSelection('checkbox', this.id, this.checked);
        });
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
 * Initialize history chart with proper cleanup
 */
function initializeHistoryChart() {
    console.log('Initializing history chart');
    const ctx = document.getElementById('historyChart');
    
    if (!ctx) {
        console.error('History chart canvas not found!');
        return;
    }
    
    // Destroy existing chart if it exists
    if (window.historyChart instanceof Chart) {
        console.log('Destroying existing history chart');
        window.historyChart.destroy();
        window.historyChart = null;
    }
    
    try {
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
        window.historyChart = new Chart(ctx, {
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
                resizeDelay: 100,
                onResize: function(chart, size) {
                    // Adjust point size and line width based on chart size
                    if (size.width < 400) {
                        chart.data.datasets.forEach(dataset => {
                            if (dataset.pointStyle !== 'triangle') { // Don't adjust dosing events
                                dataset.pointRadius = 1;
                                dataset.borderWidth = 1;
                            }
                        });
                        chart.options.scales.x.ticks.maxTicksLimit = 5;
                    } else if (size.width < 768) {
                        chart.data.datasets.forEach(dataset => {
                            if (dataset.pointStyle !== 'triangle') {
                                dataset.pointRadius = 2;
                                dataset.borderWidth = 2;
                            }
                        });
                        chart.options.scales.x.ticks.maxTicksLimit = 8;
                    } else {
                        chart.data.datasets.forEach(dataset => {
                            if (dataset.pointStyle !== 'triangle') {
                                dataset.pointRadius = 3;
                                dataset.borderWidth = 2;
                            }
                        });
                        chart.options.scales.x.ticks.maxTicksLimit = 10;
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 8 : 10
                                };
                            },
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
                        max: 3.0,
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
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            boxWidth: function(context) {
                                const chart = context.chart;
                                return chart.width < 400 ? 10 : 15;
                            },
                            font: function(context) {
                                const chart = context.chart;
                                return {
                                    size: chart.width < 400 ? 10 : 12
                                };
                            }
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
        
        // Link parameter checkboxes to chart visibility
        linkCheckboxesToChart();
        syncCheckboxesWithChart();
        setupDosingEventsToggle();
        
        // Initialize parameter buttons
        initializeParameterButtons();
        
        console.log('History chart initialized successfully');
    } catch (error) {
        console.error('Error initializing history chart:', error);
    }
}

/**
 * Improved history chart initialization with correct initial visibility
 */
function enhanceInitializeHistoryChart() {
    // Store reference to original function
    const originalInitFunction = window.initializeHistoryChart;
    
    // Replace with enhanced version
    window.initializeHistoryChart = function() {
        try {
            // Call original function
            originalInitFunction.apply(this, arguments);
            
            if (!window.historyChart) {
                console.warn("Chart not initialized properly");
                return;
            }
            
            // Set initial dataset visibility - only show pH and Free Chlorine
            const initialVisibility = {
                0: true,  // pH - visible
                1: false, // ORP - hidden
                2: true,  // Free Chlorine - visible
                3: false, // Combined Chlorine - hidden
                4: false, // Turbidity - hidden
                5: false, // Temperature - hidden
                6: true   // Dosing Events - visible
            };
            
            // Apply initial visibility to chart
            Object.keys(initialVisibility).forEach(datasetIndex => {
                const isVisible = initialVisibility[datasetIndex];
                window.historyChart.data.datasets[datasetIndex].hidden = !isVisible;
            });
            
            // Update UI to match chart state
            syncUIWithChartState(initialVisibility);
            
            // Update axis visibility
            setTimeout(updateAllAxisVisibility, 50);
            
            // Update chart
            window.historyChart.update('none');
            
            console.log("Chart initialized with custom visibility settings");
        } catch (error) {
            console.error("Error in enhanced history chart initialization:", error);
        }
    };
}

/**
 * Initialize all charts with proper cleanup and sequencing
 */
function initializeCharts() {
    console.log('Initializing all charts sequentially...');
    
    // Create a sequence to initialize charts with delays
    function initializeChartSequence() {
        // Phase 1: Initialize Chemistry Chart
        console.log('Initializing chemistry chart...');
        if (document.getElementById('chemistryChart')) {
            if (typeof initializeChemistryChart === 'function') {
                initializeChemistryChart();
            }
        }
        
        // Phase 2: Initialize Turbidity Chart after a short delay
        setTimeout(() => {
            console.log('Initializing turbidity chart...');
            if (document.getElementById('turbidityChart')) {
                if (typeof initializeTurbidityChart === 'function') {
                    initializeTurbidityChart();
                }
            }
            
            // Phase 3: Initialize History Chart after another short delay
            setTimeout(() => {
                console.log('Initializing history chart...');
                if (document.getElementById('historyChart')) {
                    if (typeof initializeHistoryChart === 'function') {
                        initializeHistoryChart();
                    }
                }
                console.log('All charts initialized successfully');
            }, 100);
        }, 100);
    }
    
    // Start the sequence
    initializeChartSequence();
}

/**
 * Initialize parameter button states based on chart visibility
 */
function initializeParameterButtons() {
    // Clear any existing event handlers by replacing buttons
    document.querySelectorAll('.parameters button').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add our new failsafe handler
        newButton.addEventListener('click', function() {
            try {
                console.log("Button clicked:", this.textContent.trim());
                
                // Get parameter name
                const paramName = this.textContent.trim();
                if (!buttonToDataset.hasOwnProperty(paramName)) {
                    console.warn("Unknown parameter:", paramName);
                    return;
                }
                
                const datasetIndex = buttonToDataset[paramName];
                if (!historyChart || !historyChart.data || !historyChart.data.datasets || 
                    !historyChart.data.datasets[datasetIndex]) {
                    console.warn("Chart or dataset not available");
                    return;
                }
                
                // Toggle visibility (inverse of current state)
                const isCurrentlyVisible = !historyChart.data.datasets[datasetIndex].hidden;
                const newVisibility = !isCurrentlyVisible;
                
                console.log(`Setting ${paramName} visibility to ${newVisibility}`);
                
                // Set visibility directly for maximum compatibility
                historyChart.data.datasets[datasetIndex].hidden = !newVisibility;
                
                // Update button appearance
                this.classList.toggle('active', newVisibility);
                this.classList.toggle('btn-primary', newVisibility);
                this.classList.toggle('btn-outline-secondary', !newVisibility);
                
                // Update corresponding checkbox if it exists
                const checkboxMap = {
                    'pH': 'showPh',
                    'ORP': 'showOrp',
                    'Free Chlorine': 'showFreeChlorine',
                    'Combined Cl': 'showCombinedChlorine', 
                    'Turbidity': 'showTurbidity',
                    'Temperature': 'showTemp'
                };
                
                const checkboxId = checkboxMap[paramName];
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.checked = newVisibility;
                }
                
                // Update axis visibility
                updateAllAxisVisibility();
                
                // Force chart update
                historyChart.update('none');
            } catch (error) {
                console.error("Error in parameter button handler:", error);
            }
        });
    });
    
    // Also fix the dosing events checkbox
    const dosingEventsCheckbox = document.getElementById('showDosingEvents');
    if (dosingEventsCheckbox) {
        // Remove existing listeners
        const newCheckbox = dosingEventsCheckbox.cloneNode(true);
        dosingEventsCheckbox.parentNode.replaceChild(newCheckbox, dosingEventsCheckbox);
        
        // Add new failsafe handler
        newCheckbox.addEventListener('change', function() {
            try {
                if (!historyChart || !historyChart.data || !historyChart.data.datasets) {
                    console.warn("Chart not available for dosing events toggle");
                    return;
                }
                
                const dosingEventsIndex = 6;
                if (historyChart.data.datasets[dosingEventsIndex]) {
                    historyChart.data.datasets[dosingEventsIndex].hidden = !this.checked;
                    historyChart.update('none');
                }
            } catch (error) {
                console.error("Error in dosing events checkbox handler:", error);
            }
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

    // Update the ARIA label with the custom date range
    const chartContainer = document.querySelector('#historyChart').closest('.chart-container');
    if (chartContainer) {
        // Format dates for accessibility description
        const formatDate = (date) => {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        };
        
        // Get visible parameters for a more descriptive label
        const visibleParams = [];
        if (historyChart.isDatasetVisible(0)) visibleParams.push('pH');
        if (historyChart.isDatasetVisible(1)) visibleParams.push('ORP');
        if (historyChart.isDatasetVisible(2)) visibleParams.push('Free Chlorine');
        if (historyChart.isDatasetVisible(3)) visibleParams.push('Combined Chlorine');
        if (historyChart.isDatasetVisible(4)) visibleParams.push('Turbidity');
        if (historyChart.isDatasetVisible(5)) visibleParams.push('Temperature');
        
        const paramText = visibleParams.length > 0 
            ? `showing ${visibleParams.join(', ')}` 
            : 'showing selected parameters';
            
        chartContainer.setAttribute('aria-label', 
            `Chart ${paramText} from ${formatDate(startDate)} to ${formatDate(endDate)}`);
    }
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

    // Update dataset visibility based on checkboxes
    document.querySelectorAll('#history-tab input[type="checkbox"]').forEach(checkbox => {
        syncParameterSelection('checkbox', checkbox.id, checkbox.checked);
    });

    historyChart.update('none');
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
 * Update chart type with better error handling
 */
function updateHistoryChartType(type) {
    if (!window.historyChart) {
        console.warn("Cannot update chart type - chart not initialized");
        return;
    }
    
    try {
        console.log(`Changing chart type to ${type}`);
        
        // Make sure we have a valid type
        if (!['line', 'bar', 'scatter'].includes(type)) {
            console.warn(`Invalid chart type: ${type}`);
            return;
        }
        
        // Change chart type
        window.historyChart.config.type = type;
        
        // Adjust point sizes for different chart types
        if (type === 'scatter') {
            window.historyChart.data.datasets.forEach(dataset => {
                if (dataset.label !== 'Dosing Events') {
                    dataset.pointRadius = 3;
                }
            });
        } else {
            window.historyChart.data.datasets.forEach(dataset => {
                if (dataset.label !== 'Dosing Events') {
                    dataset.pointRadius = type === 'line' ? undefined : 0;
                }
            });
        }
        
        // Preserve the dosing events as triangles
        const dosingEventsDataset = window.historyChart.data.datasets.find(ds => ds.label === 'Dosing Events');
        if (dosingEventsDataset) {
            dosingEventsDataset.type = 'scatter';
            dosingEventsDataset.pointStyle = 'triangle';
            dosingEventsDataset.pointRadius = 12;
        }
        
        // Update chart
        window.historyChart.update();
        
        // Update visualization type selector to match
        const visualizationSelect = document.getElementById('visualizationType');
        if (visualizationSelect && visualizationSelect.value !== type) {
            visualizationSelect.value = type;
        }
        
        console.log("Chart type updated successfully");
    } catch (error) {
        console.error("Error updating chart type:", error);
    }
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
 * Format date/time with appropriate precision based on resolution
 */
function formatDateTime(date, resolution = 'hour') {
    if (resolution === 'day') {
        return date.toLocaleDateString();
    } else if (resolution === 'hour') {
        return `${date.toLocaleDateString()} ${date.getHours()}:00`;
    } else {
        return date.toLocaleString();
    }
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
 * Initialize settings tab functionality
 */
function initializeSettingsTab() {
    console.log('Initializing Settings Tab');
    
    // Form submission handlers
    document.getElementById('accountSettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveAccountSettings(this);
    });
    
    document.getElementById('notificationSettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveNotificationSettings(this);
    });
    
    document.getElementById('systemConfigForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSystemConfig(this);
    });
    
    document.getElementById('chemistryTargetsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveChemistryTargets(this);
    });
    
    document.getElementById('pumpConfigForm').addEventListener('submit', function(e) {
        e.preventDefault();
        savePumpConfig(this);
    });
    
    document.getElementById('turbiditySettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveTurbiditySettings(this);
    });
    
    // Data management buttons
    document.getElementById('exportSettingsBtn').addEventListener('click', exportSettings);
    document.getElementById('importSettingsFile').addEventListener('change', importSettings);
    document.getElementById('saveRetentionBtn').addEventListener('click', saveRetentionSettings);
    document.getElementById('resetSettingsBtn').addEventListener('click', confirmResetSettings);
    document.getElementById('clearDataBtn').addEventListener('click', confirmClearData);
    
    // Load saved settings if available
    loadSavedSettings();
}

/**
 * Save account settings with password change
 */
function saveAccountSettings(form) {
    // Get form elements
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const submitButton = form.querySelector('button[type="submit"]');

    // Validate form
    const isValid = validateForm({
        'currentPassword': {
            label: 'Current Password',
            required: true
        },
        'newPassword': {
            label: 'New Password',
            required: true
        },
        'confirmPassword': {
            label: 'Confirm Password',
            required: true
        },
        _relationships: [
            {
                type: 'equality',
                field1: 'newPassword',
                field2: 'confirmPassword',
                field1Label: 'New Password',
                field2Label: 'Confirm Password',
                errorMessage: 'New passwords do not match'
            }
        ]
    });
    
    if (!isValid) {
        return; // Don't proceed if validation fails
    }

    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Show loading state on the card
    showLoading(form.closest('.card'));
    
    // For demo, we'll just simulate an API call with a timeout
    setTimeout(function() {
        // In a real app, you would send this to an API
        console.log('Password change saved');
        
        // Hide loading state
        hideLoading(form.closest('.card'));
        
        // Reset form and button
        form.reset();
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        showToast('Password changed successfully');
    }, 1000);
}

/**
 * Save notification settings
 */
function saveNotificationSettings(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');

    // Validate form
    const isValid = validateForm({
        'notificationEmail': {
            label: 'Notification Email',
            required: false,
            email: true
        }
    });
    
    if (!isValid) {
        return; // Don't proceed if validation fails
    }

    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Show loading state on the card
    showLoading(form.closest('.card'));
    
    // Get settings
    const notificationEmail = document.getElementById('notificationEmail').value;
    const alertNotifications = document.getElementById('alertNotifications').checked;
    const warningNotifications = document.getElementById('warningNotifications').checked;
    const maintenanceNotifications = document.getElementById('maintenanceNotifications').checked;
    const dailyReportNotifications = document.getElementById('dailyReportNotifications').checked;
    
    // Save to localStorage for demo
    const notificationSettings = {
        notificationEmail,
        alertNotifications,
        warningNotifications,
        maintenanceNotifications,
        dailyReportNotifications
    };
    
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
    
    // Simulated delay to show loading state
    setTimeout(function() {
        // Hide loading state
        hideLoading(form.closest('.card'));
        
        // Reset button state
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        showToast('Notification settings saved successfully');
    }, 800);
}

/**
 * Save system configuration
 */
function saveSystemConfig(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');

    // Validate form
    const isValid = validateForm({
        'systemName': {
            label: 'System Name',
            required: true
        },
        'poolSize': {
            label: 'Pool Size',
            required: true,
            numeric: true,
            min: 10,
            max: 10000
        },
        'refreshInterval': {
            label: 'Refresh Interval',
            required: true,
            numeric: true,
            min: 5,
            max: 3600
        }
    });
    
    if (!isValid) {
        return; // Don't proceed if validation fails
    }

    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;

    // Show loading state on the card
    showLoading(form.closest('.card'));
    
    // Get settings
    const systemName = document.getElementById('systemName').value;
    const poolSize = document.getElementById('poolSize').value;
    const refreshInterval = document.getElementById('refreshInterval').value;
    const defaultMode = document.getElementById('defaultModeAuto').checked ? 'auto' : 'manual';
    
    // Simulate API call with delay
    setTimeout(function() {
        // Save to localStorage for demo
        const systemConfig = {
            systemName,
            poolSize,
            refreshInterval,
            defaultMode,
        };

        localStorage.setItem('systemConfig', JSON.stringify(systemConfig));

        // Update UI elements that depend on these settings
        document.querySelector('.sidebar-header h3').textContent = systemName;
    
        // Hide loading state
        hideLoading(form.closest('.card'));
        
        // Reset button
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        showToast('System settings saved successfully');
        updateUIFromSettings();
    }, 800);
}

/**
 * Save chemistry targets
 */
function saveChemistryTargets(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Validate form
    const isValid = validateForm({
        'phTargetMin': {
            label: 'Minimum pH',
            required: true,
            numeric: true,
            min: 6.5,
            max: 8.0
        },
        'phTargetMax': {
            label: 'Maximum pH',
            required: true,
            numeric: true,
            min: 6.5,
            max: 8.0
        },
        'orpTargetMin': {
            label: 'Minimum ORP',
            required: true,
            numeric: true,
            min: 500,
            max: 900
        },
        'orpTargetMax': {
            label: 'Maximum ORP',
            required: true,
            numeric: true,
            min: 500,
            max: 900
        },
        'freeClTargetMin': {
            label: 'Minimum Free Chlorine',
            required: true,
            numeric: true,
            min: 0.5,
            max: 5.0
        },
        'freeClTargetMax': {
            label: 'Maximum Free Chlorine',
            required: true,
            numeric: true,
            min: 0.5,
            max: 5.0
        },
        'combinedClMax': {
            label: 'Maximum Combined Chlorine',
            required: true,
            numeric: true,
            min: 0,
            max: 1.0
        },
        _relationships: [
            {
                type: 'minLessThanMax',
                minField: 'phTargetMin',
                maxField: 'phTargetMax',
                label: 'Minimum pH',
                maxLabel: 'Maximum pH'
            },
            {
                type: 'minLessThanMax',
                minField: 'orpTargetMin',
                maxField: 'orpTargetMax',
                label: 'Minimum ORP',
                maxLabel: 'Maximum ORP'
            },
            {
                type: 'minLessThanMax',
                minField: 'freeClTargetMin',
                maxField: 'freeClTargetMax',
                label: 'Minimum Free Chlorine',
                maxLabel: 'Maximum Free Chlorine'
            }
        ]
    });
    
    if (!isValid) {
        return; // Don't proceed if validation fails
    }

    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Show loading state on the card
    showLoading(form.closest('.card'));
    
    // Get settings
    const phTargetMin = document.getElementById('phTargetMin').value;
    const phTargetMax = document.getElementById('phTargetMax').value;
    const orpTargetMin = document.getElementById('orpTargetMin').value;
    const orpTargetMax = document.getElementById('orpTargetMax').value;
    const freeClTargetMin = document.getElementById('freeClTargetMin').value;
    const freeClTargetMax = document.getElementById('freeClTargetMax').value;
    const combinedClMax = document.getElementById('combinedClMax').value;
    
    // Save to localStorage for demo
    const chemistryTargets = {
        phTargetMin,
        phTargetMax,
        orpTargetMin,
        orpTargetMax,
        freeClTargetMin,
        freeClTargetMax,
        combinedClMax
    };
    
    localStorage.setItem('chemistryTargets', JSON.stringify(chemistryTargets));
    
    // Simulated delay to show loading state
    setTimeout(function() {
        // Hide loading state
        hideLoading(form.closest('.card'));
        
        // Reset button state
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        showToast('Chemistry targets saved successfully', 'success');
        updateUIFromSettings();
    }, 800);
}

/**
 * Save pump configuration
 */
function savePumpConfig(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');

    // Validate form
    const isValid = validateForm({
        'phPumpFlowRate': {
            label: 'pH Pump Flow Rate',
            required: true,
            numeric: true,
            min: 10,
            max: 500
        },
        'clPumpFlowRate': {
            label: 'Chlorine Pump Flow Rate',
            required: true,
            numeric: true,
            min: 10,
            max: 500
        },
        'pacMinFlow': {
            label: 'PAC Minimum Flow',
            required: true,
            numeric: true,
            min: 10,
            max: 100
        },
        'pacMaxFlow': {
            label: 'PAC Maximum Flow',
            required: true,
            numeric: true,
            min: 100,
            max: 500
        },
        'phMaxDoseDuration': {
            label: 'pH Maximum Dose Duration',
            required: true,
            numeric: true,
            min: 30,
            max: 1800
        },
        'clMaxDoseDuration': {
            label: 'Chlorine Maximum Dose Duration',
            required: true,
            numeric: true,
            min: 30,
            max: 1800
        },
        _relationships: [
            {
                type: 'minLessThanMax',
                minField: 'pacMinFlow',
                maxField: 'pacMaxFlow',
                label: 'PAC Minimum Flow',
                maxLabel: 'PAC Maximum Flow'
            }
        ]
    });
    
    if (!isValid) {
        return; // Don't proceed if validation fails
    }

    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Show loading state on the card
    showLoading(form.closest('.card'));
    
    // Get settings
    const phPumpFlowRate = document.getElementById('phPumpFlowRate').value;
    const clPumpFlowRate = document.getElementById('clPumpFlowRate').value;
    const pacMinFlow = document.getElementById('pacMinFlow').value;
    const pacMaxFlow = document.getElementById('pacMaxFlow').value;
    const phMaxDoseDuration = document.getElementById('phMaxDoseDuration').value;
    const clMaxDoseDuration = document.getElementById('clMaxDoseDuration').value;
    
    // Save to localStorage for demo
    const pumpConfig = {
        phPumpFlowRate,
        clPumpFlowRate,
        pacMinFlow,
        pacMaxFlow,
        phMaxDoseDuration,
        clMaxDoseDuration
    };
    
    localStorage.setItem('pumpConfig', JSON.stringify(pumpConfig));
    
    // Update mock data for simulation
    if (mockData) {
        // Recalculate PAC dosing rate based on new min/max
        mockData.pacDosingRate = parseInt(pacMinFlow) + Math.floor(Math.random() * (parseInt(pacMaxFlow) - parseInt(pacMinFlow)));
    }
    
    // Simulated delay to show loading state
    setTimeout(function() {
        // Hide loading state
        hideLoading(form.closest('.card'));
        
        // Reset button state
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        showToast('Pump settings saved successfully');
        updateUIFromSettings();
    }, 800);
}

/**
 * Save turbidity settings
 */
function saveTurbiditySettings(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');

    // Validate form
    const isValid = validateForm({
        'turbidityTarget': {
            label: 'Turbidity Target',
            required: true,
            numeric: true,
            min: 0.05,
            max: 0.3
        },
        'turbidityLowThreshold': {
            label: 'Turbidity Low Threshold',
            required: true,
            numeric: true,
            min: 0.05,
            max: 0.3
        },
        'turbidityHighThreshold': {
            label: 'Turbidity High Threshold',
            required: true,
            numeric: true,
            min: 0.1,
            max: 0.5
        },
        'filterBackwashLevel': {
            label: 'Filter Backwash Level',
            required: true,
            numeric: true,
            min: 50,
            max: 90
        },
        _relationships: [
            {
                type: 'minLessThanMax',
                minField: 'turbidityLowThreshold',
                maxField: 'turbidityHighThreshold',
                label: 'Low Threshold',
                maxLabel: 'High Threshold'
            },
            {
                type: 'targetBetweenMinMax',
                targetField: 'turbidityTarget',
                minField: 'turbidityLowThreshold',
                maxField: 'turbidityHighThreshold',
                targetLabel: 'Target Value',
                minLabel: 'Low Threshold',
                maxLabel: 'High Threshold'
            }
        ]
    });
    
    if (!isValid) {
        return; // Don't proceed if validation fails
    }

    // Validate thresholds
    if (!validateThresholds(
        'turbidityLowThreshold', 
        'turbidityHighThreshold', 
        'turbidityTarget', 
        'Turbidity'
    )) {
        return;
    }
    
    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Show loading state on the card
    showLoading(form.closest('.card'));
    
    // Get settings
    const turbidityTarget = document.getElementById('turbidityTarget').value;
    const turbidityLowThreshold = document.getElementById('turbidityLowThreshold').value;
    const turbidityHighThreshold = document.getElementById('turbidityHighThreshold').value;
    const filterBackwashLevel = document.getElementById('filterBackwashLevel').value;
    const autoBackwashAlerts = document.getElementById('autoBackwashAlerts').checked;
    
    // Save to localStorage for demo
    const turbiditySettings = {
        turbidityTarget,
        turbidityLowThreshold,
        turbidityHighThreshold,
        filterBackwashLevel,
        autoBackwashAlerts
    };
    
    console.log("Saving turbidity settings:", turbiditySettings); // Debug
    localStorage.setItem('turbiditySettings', JSON.stringify(turbiditySettings));
    
    // Update UI elements
    document.getElementById('pacTargetValue').value = turbidityTarget;
    document.getElementById('pacLowThreshold').value = turbidityLowThreshold;
    document.getElementById('pacHighThreshold').value = turbidityHighThreshold;
    
    // Simulated delay to show loading state
    setTimeout(function() {
        // Hide loading state
        hideLoading(form.closest('.card'));
        
        // Reset button state
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        showToast('Turbidity settings saved successfully');
        updateUIFromSettings();
    }, 800);
}

/**
 * Export settings as a JSON file
 */
function exportSettings() {
    // Show loading on settings cards
    showLoading('.data-management-section .card');
    
    // Collect all settings from localStorage
    const allSettings = {
        systemConfig: JSON.parse(localStorage.getItem('systemConfig') || '{}'),
        notificationSettings: JSON.parse(localStorage.getItem('notificationSettings') || '{}'),
        chemistryTargets: JSON.parse(localStorage.getItem('chemistryTargets') || '{}'),
        pumpConfig: JSON.parse(localStorage.getItem('pumpConfig') || '{}'),
        turbiditySettings: JSON.parse(localStorage.getItem('turbiditySettings') || '{}')
    };
    
    // Simulated processing delay
    setTimeout(() => {
        // Create a blob and download link
        const blob = new Blob([JSON.stringify(allSettings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pool_settings_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Hide loading
        hideLoading('.data-management-section .card');
        
        showToast('Settings exported successfully');
    }, 600);
}

/**
 * Import settings from a JSON file
 */
function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show loading on settings cards
    showLoading('.data-management-section .card');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const settings = JSON.parse(e.target.result);
            console.log("Importing settings:", settings); // Debug
            
            // Save each settings group to localStorage
            if (settings.systemConfig) {
                localStorage.setItem('systemConfig', JSON.stringify(settings.systemConfig));
            }
            
            if (settings.notificationSettings) {
                localStorage.setItem('notificationSettings', JSON.stringify(settings.notificationSettings));
            }
            
            if (settings.chemistryTargets) {
                localStorage.setItem('chemistryTargets', JSON.stringify(settings.chemistryTargets));
            }
            
            if (settings.pumpConfig) {
                localStorage.setItem('pumpConfig', JSON.stringify(settings.pumpConfig));
            }
            
            if (settings.turbiditySettings) {
                localStorage.setItem('turbiditySettings', JSON.stringify(settings.turbiditySettings));
            }
            
            if (settings.retentionSettings) {
                localStorage.setItem('retentionSettings', JSON.stringify(settings.retentionSettings));
            }
            
            // Update all form fields with imported values
            // This will take some time, so we keep the loading state active
            setTimeout(() => {
                // Load all form field values
                loadSavedSettings();
                
                // Update UI elements
                updateUIFromSettings();
                
                // Hide loading
                hideLoading('.data-management-section .card');
                
                showToast('Settings imported successfully');
            }, 800);
        } catch (error) {
            console.error('Error importing settings:', error);
            
            // Hide loading
            hideLoading('.data-management-section .card');
            
            showToast('Error importing settings. Invalid file format.', 'warning');
        }
    };
    
    reader.readAsText(file);
    
    // Clear the file input for future imports
    event.target.value = '';
}

/**
 * Save data retention settings
 */
function saveRetentionSettings() {
    // Get the button
    const button = document.getElementById('saveRetentionBtn');

    // Validate form
    const isValid = validateForm({
        'dataRetention': {
            label: 'Data Retention',
            required: true,
            numeric: true,
            min: 7,
            max: 365
        },
        'eventRetention': {
            label: 'Event Retention',
            required: true,
            numeric: true,
            min: 7,
            max: 365
        }
    });
    
    if (!isValid) {
        return; // Don't proceed if validation fails
    }

    // Set loading state
    const originalButtonText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    button.disabled = true;
    
    // Show loading state
    showLoading(button.closest('.card'));
    
    const dataRetention = document.getElementById('dataRetention').value;
    const eventRetention = document.getElementById('eventRetention').value;
    
    // Create retention settings object
    const retentionSettings = {
        dataRetention,
        eventRetention
    };
    
    localStorage.setItem('retentionSettings', JSON.stringify(retentionSettings));

    // Simulated delay to show loading state
    setTimeout(function() {
        // Hide loading state
        hideLoading(button.closest('.card'));
        
        // Reset button
        button.innerHTML = originalButtonText;
        button.disabled = false;
        
        showToast('Data retention settings saved');
    }, 800);
}

/**
 * Confirm reset of all settings to defaults
 */
function confirmResetSettings() {
    if (confirm('Are you sure you want to reset all settings to default values? This cannot be undone.')) {
        // Show loading indicator on all settings cards
        showLoading('.settings-tab .card');
        
        console.log("Resetting settings to defaults");
        
        // Clear localStorage
        localStorage.removeItem('systemConfig');
        localStorage.removeItem('notificationSettings');
        localStorage.removeItem('chemistryTargets');
        localStorage.removeItem('pumpConfig');
        localStorage.removeItem('turbiditySettings');
        localStorage.removeItem('retentionSettings');
        
        // Set form fields to defaults
        // System config defaults
        document.getElementById('systemName').value = 'Pool Automation System';
        document.getElementById('poolSize').value = '300';
        document.getElementById('refreshInterval').value = '10';
        document.getElementById('defaultModeAuto').checked = true;
        
        // Chemistry targets defaults
        document.getElementById('phTargetMin').value = '7.2';
        document.getElementById('phTargetMax').value = '7.6';
        document.getElementById('orpTargetMin').value = '650';
        document.getElementById('orpTargetMax').value = '750';
        document.getElementById('freeClTargetMin').value = '1.0';
        document.getElementById('freeClTargetMax').value = '2.0';
        document.getElementById('combinedClMax').value = '0.3';
        
        // Pump config defaults
        document.getElementById('phPumpFlowRate').value = '120';
        document.getElementById('clPumpFlowRate').value = '150';
        document.getElementById('pacMinFlow').value = '60';
        document.getElementById('pacMaxFlow').value = '150';
        document.getElementById('phMaxDoseDuration').value = '300';
        document.getElementById('clMaxDoseDuration').value = '300';
        
        // Turbidity settings defaults
        document.getElementById('turbidityTarget').value = '0.15';
        document.getElementById('turbidityLowThreshold').value = '0.12';
        document.getElementById('turbidityHighThreshold').value = '0.25';
        document.getElementById('filterBackwashLevel').value = '70';
        document.getElementById('autoBackwashAlerts').checked = true;
        
        // Notification settings defaults
        document.getElementById('notificationEmail').value = '';
        document.getElementById('alertNotifications').checked = true;
        document.getElementById('warningNotifications').checked = true;
        document.getElementById('maintenanceNotifications').checked = true;
        document.getElementById('dailyReportNotifications').checked = false;
        
        // Retention settings defaults
        document.getElementById('dataRetention').value = '90';
        document.getElementById('eventRetention').value = '90';
        
        // Save all default values to localStorage
        const systemConfig = {
            systemName: 'Pool Automation System',
            poolSize: '300',
            refreshInterval: '10',
            defaultMode: 'auto'
        };
        localStorage.setItem('systemConfig', JSON.stringify(systemConfig));
        
        const chemistryTargets = {
            phTargetMin: '7.2',
            phTargetMax: '7.6',
            orpTargetMin: '650',
            orpTargetMax: '750',
            freeClTargetMin: '1.0',
            freeClTargetMax: '2.0',
            combinedClMax: '0.3'
        };
        localStorage.setItem('chemistryTargets', JSON.stringify(chemistryTargets));
        
        const pumpConfig = {
            phPumpFlowRate: '120',
            clPumpFlowRate: '150',
            pacMinFlow: '60',
            pacMaxFlow: '150',
            phMaxDoseDuration: '300',
            clMaxDoseDuration: '300'
        };
        localStorage.setItem('pumpConfig', JSON.stringify(pumpConfig));
        
        const turbiditySettings = {
            turbidityTarget: '0.15',
            turbidityLowThreshold: '0.12',
            turbidityHighThreshold: '0.25',
            filterBackwashLevel: '70',
            autoBackwashAlerts: true
        };
        localStorage.setItem('turbiditySettings', JSON.stringify(turbiditySettings));
        
        const notificationSettings = {
            notificationEmail: '',
            alertNotifications: true,
            warningNotifications: true,
            maintenanceNotifications: true,
            dailyReportNotifications: false
        };
        localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
        
        const retentionSettings = {
            dataRetention: '90',
            eventRetention: '90'
        };
        localStorage.setItem('retentionSettings', JSON.stringify(retentionSettings));
        
        // Update PAC dosing rate in mock data
        if (mockData) {
            mockData.pacDosingRate = 75; // Default value
        }
        
        // Simulated delay to show loading state 
        setTimeout(function() {
            // Hide loading state
            hideLoading('.settings-tab .card');
            
            // Update UI to reflect defaults
            updateUIFromSettings();
            
            console.log("Reset complete - UI should be updated");
            showToast('Settings reset to defaults');
        }, 1200);
    }
}

/**
 * Confirm clearing of historical data
 */
function confirmClearData() {
    if (confirm('Are you sure you want to clear all historical data? This cannot be undone.')) {
        // Show loading indicator
        const button = document.getElementById('clearDataBtn');
        const originalButtonText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Clearing...';
        button.disabled = true;
        
        // Show loading state on related elements
        showLoading('#historyDataTable');
        showLoading('#eventsTable');
        showLoading('#historyChart');
        
        // In a real app, this would call an API to clear data
        setTimeout(function() {
            // Reset button state
            button.innerHTML = originalButtonText;
            button.disabled = false;
            
            // Clear any local chart data (simulated)
            if (historyChart) {
                historyChart.data.datasets.forEach(dataset => {
                    dataset.data = [];
                });
                historyChart.update();
            }
            
            // Clear table data
            const historyTable = document.getElementById('historyDataTable');
            if (historyTable && historyTable.querySelector('tbody')) {
                historyTable.querySelector('tbody').innerHTML = '<tr><td colspan="7" class="text-center">No data available</td></tr>';
            }
            
            const eventsTable = document.getElementById('eventsTable');
            if (eventsTable && eventsTable.querySelector('tbody')) {
                eventsTable.querySelector('tbody').innerHTML = '<tr><td colspan="5" class="text-center">No events available</td></tr>';
            }
            
            // Hide loading states
            hideLoading('#historyDataTable');
            hideLoading('#eventsTable');
            hideLoading('#historyChart');
            
            showToast('Historical data cleared successfully');
        }, 1500);
    }
}

/**
 * Load saved settings from localStorage
 */
function loadSavedSettings() {
    // Load notification settings
    const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings'));
    if (notificationSettings) {
        document.getElementById('notificationEmail').value = notificationSettings.notificationEmail || '';
        document.getElementById('alertNotifications').checked = notificationSettings.alertNotifications !== false;
        document.getElementById('warningNotifications').checked = notificationSettings.warningNotifications !== false;
        document.getElementById('maintenanceNotifications').checked = notificationSettings.maintenanceNotifications !== false;
        document.getElementById('dailyReportNotifications').checked = notificationSettings.dailyReportNotifications === true;
    }
    
    // Load system configuration
    const systemConfig = JSON.parse(localStorage.getItem('systemConfig'));
    if (systemConfig) {
        document.getElementById('systemName').value = systemConfig.systemName || 'Pool Automation System';
        document.getElementById('poolSize').value = systemConfig.poolSize || '300';
        document.getElementById('refreshInterval').value = systemConfig.refreshInterval || '10';
        
        if (systemConfig.defaultMode === 'manual') {
            document.getElementById('defaultModeManual').checked = true;
        } else {
            document.getElementById('defaultModeAuto').checked = true;
        }
    }
    
    // Load chemistry targets
    const chemistryTargets = JSON.parse(localStorage.getItem('chemistryTargets'));
    if (chemistryTargets) {
        document.getElementById('phTargetMin').value = chemistryTargets.phTargetMin || '7.2';
        document.getElementById('phTargetMax').value = chemistryTargets.phTargetMax || '7.6';
        document.getElementById('orpTargetMin').value = chemistryTargets.orpTargetMin || '650';
        document.getElementById('orpTargetMax').value = chemistryTargets.orpTargetMax || '750';
        document.getElementById('freeClTargetMin').value = chemistryTargets.freeClTargetMin || '1.0';
        document.getElementById('freeClTargetMax').value = chemistryTargets.freeClTargetMax || '2.0';
        document.getElementById('combinedClMax').value = chemistryTargets.combinedClMax || '0.3';
    }
    
    // Load pump configuration
    const pumpConfig = JSON.parse(localStorage.getItem('pumpConfig'));
    if (pumpConfig) {
        document.getElementById('phPumpFlowRate').value = pumpConfig.phPumpFlowRate || '120';
        document.getElementById('clPumpFlowRate').value = pumpConfig.clPumpFlowRate || '150';
        document.getElementById('pacMinFlow').value = pumpConfig.pacMinFlow || '60';
        document.getElementById('pacMaxFlow').value = pumpConfig.pacMaxFlow || '150';
        document.getElementById('phMaxDoseDuration').value = pumpConfig.phMaxDoseDuration || '300';
        document.getElementById('clMaxDoseDuration').value = pumpConfig.clMaxDoseDuration || '300';
    }
    
    // Load turbidity settings
    const turbiditySettings = JSON.parse(localStorage.getItem('turbiditySettings'));
    if (turbiditySettings) {
        document.getElementById('turbidityTarget').value = turbiditySettings.turbidityTarget || '0.15';
        document.getElementById('turbidityLowThreshold').value = turbiditySettings.turbidityLowThreshold || '0.12';
        document.getElementById('turbidityHighThreshold').value = turbiditySettings.turbidityHighThreshold || '0.25';
        document.getElementById('filterBackwashLevel').value = turbiditySettings.filterBackwashLevel || '70';
        document.getElementById('autoBackwashAlerts').checked = turbiditySettings.autoBackwashAlerts !== false;
    }
    
    // Load retention settings
    const retentionSettings = JSON.parse(localStorage.getItem('retentionSettings'));
    if (retentionSettings) {
        document.getElementById('dataRetention').value = retentionSettings.dataRetention || '90';
        document.getElementById('eventRetention').value = retentionSettings.eventRetention || '90';
    }
}

/**
 * Updates UI elements based on saved settings
 * 
 * This function reads settings from localStorage and updates all UI elements 
 * to reflect these settings. Should be called on page load and after any settings changes.
 * 
 * Updates:
 * - System name and document title
 * - Target ranges in overview cards
 * - Operation mode selection
 * - PAC dosing thresholds
 * - Pump flow rate options
 * - Dose duration options
 */
function updateUIFromSettings() {
    // Get current settings
    const systemConfig = JSON.parse(localStorage.getItem('systemConfig') || '{}');
    const chemistryTargets = JSON.parse(localStorage.getItem('chemistryTargets') || '{}');
    const turbiditySettings = JSON.parse(localStorage.getItem('turbiditySettings') || '{}');
    const pumpConfig = JSON.parse(localStorage.getItem('pumpConfig') || '{}');
    
    console.log("Updating UI from settings:", { systemConfig, chemistryTargets, turbiditySettings, pumpConfig });
    
    // Update system name
    if (systemConfig.systemName) {
        const sidebarHeader = document.querySelector('.sidebar-header h3');
        if (sidebarHeader) {
            sidebarHeader.textContent = systemConfig.systemName;
            // Also update document title
            document.title = systemConfig.systemName;
        }
    }
    
    // Update operation mode
    if (systemConfig.defaultMode) {
        if (systemConfig.defaultMode === 'manual') {
            const manualModeBtn = document.getElementById('manualMode');
            if (manualModeBtn && !manualModeBtn.classList.contains('active')) {
                manualModeBtn.click(); // Simulate clicking the manual mode button
            }
        } else {
            const autoModeBtn = document.getElementById('autoMode');
            if (autoModeBtn && !autoModeBtn.classList.contains('active')) {
                autoModeBtn.click(); // Simulate clicking the auto mode button
            }
        }
    }
    
    // Update target ranges in overview cards
    if (chemistryTargets.phTargetMin && chemistryTargets.phTargetMax) {
        const phTargetEl = document.querySelector('#phValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (phTargetEl) {
            phTargetEl.textContent = `Target: ${chemistryTargets.phTargetMin} - ${chemistryTargets.phTargetMax}`;
        }
        
        // Also update the range display in the pH Control panel
        const phRangeEl = document.querySelector('.ph-control .active-range');
        if (phRangeEl) {
            phRangeEl.textContent = `${chemistryTargets.phTargetMin} - ${chemistryTargets.phTargetMax}`;
        }
    }
    
    if (chemistryTargets.orpTargetMin && chemistryTargets.orpTargetMax) {
        const orpTargetEl = document.querySelector('#orpValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (orpTargetEl) {
            orpTargetEl.textContent = `mV (Target: ${chemistryTargets.orpTargetMin} - ${chemistryTargets.orpTargetMax})`;
        }
    }
    
    if (chemistryTargets.freeClTargetMin && chemistryTargets.freeClTargetMax) {
        const clTargetEl = document.querySelector('#freeChlorineValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (clTargetEl) {
            clTargetEl.textContent = `Free (mg/L) (Target: ${chemistryTargets.freeClTargetMin} - ${chemistryTargets.freeClTargetMax})`;
        }
        
        // Also update the range display in the Chlorine Control panel
        const clRangeEl = document.querySelector('.chlorine-control .active-range');
        if (clRangeEl) {
            clRangeEl.textContent = `${chemistryTargets.freeClTargetMin} - ${chemistryTargets.freeClTargetMax}`;
        }
    }
    
    // Update turbidity settings in PAC tab
    if (turbiditySettings.turbidityTarget) {
        document.getElementById('pacTargetValue').value = turbiditySettings.turbidityTarget;
        
        // Also update the turbidity target display in the overview
        const turbidityTargetEl = document.querySelector('#turbidityValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (turbidityTargetEl) {
            turbidityTargetEl.textContent = `NTU (Target: ${turbiditySettings.turbidityLowThreshold} - ${turbiditySettings.turbidityHighThreshold})`;
        }
    }
    
    if (turbiditySettings.turbidityLowThreshold) {
        document.getElementById('pacLowThreshold').value = turbiditySettings.turbidityLowThreshold;
    }
    
    if (turbiditySettings.turbidityHighThreshold) {
        document.getElementById('pacHighThreshold').value = turbiditySettings.turbidityHighThreshold;
    }
    
    // Update PAC pump flow rate options
    if (pumpConfig.pacMinFlow && pumpConfig.pacMaxFlow) {
        const pacFlowRateSelect = document.getElementById('pacFlowRate');
        if (pacFlowRateSelect) {
            const minFlow = parseInt(pumpConfig.pacMinFlow);
            const maxFlow = parseInt(pumpConfig.pacMaxFlow);
            const medFlow = Math.round((minFlow + maxFlow) / 2);
            const lowFlow = Math.round((minFlow + medFlow) / 2);
            const highFlow = Math.round((medFlow + maxFlow) / 2);
            
            pacFlowRateSelect.innerHTML = `
                <option value="${minFlow}">${minFlow} ml/h (Minimum)</option>
                <option value="${lowFlow}" selected>${lowFlow} ml/h (Low)</option>
                <option value="${medFlow}">${medFlow} ml/h (Medium)</option>
                <option value="${highFlow}">${highFlow} ml/h (High)</option>
                <option value="${maxFlow}">${maxFlow} ml/h (Maximum)</option>
            `;
            
            // Update mock data PAC dosing rate to be within the new range
            if (mockData) {
                mockData.pacDosingRate = lowFlow;
                
                // Update displayed PAC dosing rate
                const pacDosingRateEl = document.getElementById('pacDosingRate');
                if (pacDosingRateEl) {
                    pacDosingRateEl.textContent = mockData.pacDosingRate;
                }
            }
        }
    }
    
    // Update dose duration options based on configured max duration
    if (pumpConfig.phMaxDoseDuration) {
        updateDoseDurationOptions('phDoseDuration', parseInt(pumpConfig.phMaxDoseDuration));
    }
    
    if (pumpConfig.clMaxDoseDuration) {
        updateDoseDurationOptions('clDoseDuration', parseInt(pumpConfig.clMaxDoseDuration));
    }
}

/**
 * Update dose duration select options based on maximum duration
 * @param {string} selectId - Select element ID
 * @param {number} maxDuration - Maximum duration in seconds
 */
function updateDoseDurationOptions(selectId, maxDuration) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    
    // Clear existing options
    selectEl.innerHTML = '';
    
    // Add standard options based on max duration
    const options = [
        { value: 5, text: '5 seconds' },
        { value: 10, text: '10 seconds' },
        { value: 30, text: '30 seconds' },
        { value: 60, text: '1 minute' },
        { value: 120, text: '2 minutes' },
        { value: 300, text: '5 minutes' }
    ];
    
    // Add any custom options if max duration is larger
    if (maxDuration > 300) {
        options.push({ value: 600, text: '10 minutes' });
    }
    
    if (maxDuration > 600) {
        options.push({ value: 900, text: '15 minutes' });
    }
    
    // Keep only options that are <= maxDuration
    const validOptions = options.filter(opt => opt.value <= maxDuration);
    
    // Add options to select
    validOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        
        // Select 30 seconds by default
        if (opt.value === 30) {
            option.selected = true;
        }
        
        selectEl.appendChild(option);
    });
}

/**
 * Validate thresholds for configuration inputs
 * @param {string} minId - Minimum input ID
 * @param {string} maxId - Maximum input ID
 * @param {string} targetId - Target input ID (optional)
 * @param {string} name - Parameter name for error message
 * @returns {boolean} - Whether validation passed
 */
function validateThresholds(minId, maxId, targetId, name) {
    const minInput = document.getElementById(minId);
    const maxInput = document.getElementById(maxId);
    
    if (!minInput || !maxInput) return false;
    
    const min = parseFloat(minInput.value);
    const max = parseFloat(maxInput.value);
    
    if (isNaN(min) || isNaN(max)) {
        showToast(`${name} values must be valid numbers`, 'warning');
        return false;
    }
    
    if (min >= max) {
        showToast(`${name} minimum must be less than maximum`, 'warning');
        minInput.classList.add('is-invalid');
        maxInput.classList.add('is-invalid');
        return false;
    }
    
    minInput.classList.remove('is-invalid');
    maxInput.classList.remove('is-invalid');
    
    if (targetId) {
        const targetInput = document.getElementById(targetId);
        if (!targetInput) return true;
        
        const target = parseFloat(targetInput.value);
        
        if (isNaN(target)) {
            showToast(`${name} target must be a valid number`, 'warning');
            return false;
        }
        
        if (target <= min || target >= max) {
            showToast(`${name} target must be between minimum and maximum`, 'warning');
            targetInput.classList.add('is-invalid');
            return false;
        }
        
        targetInput.classList.remove('is-invalid');
    }
    
    return true;
}

/**
 * Create a comprehensive form validation utility
 * @param {Object} validations - Object containing field IDs and validation rules
 * @returns {boolean} - Whether validation passed
 */
function validateForm(validations) {
    let isValid = true;
    
    for (const fieldId in validations) {
        const field = document.getElementById(fieldId);
        if (!field) continue;
        
        const rules = validations[fieldId];
        const value = field.value;
        
        // Clear previous validation styling
        field.classList.remove('is-invalid');
        
        // Required field validation
        if (rules.required && !value.trim()) {
            field.classList.add('is-invalid');
            showToast(`${rules.label || fieldId} is required`, 'warning');
            isValid = false;
            continue;
        }
        
        // Numeric validation
        if (rules.numeric && value.trim()) {
            const numValue = parseFloat(value);
            
            // Check if it's a valid number
            if (isNaN(numValue)) {
                field.classList.add('is-invalid');
                showToast(`${rules.label || fieldId} must be a valid number`, 'warning');
                isValid = false;
                continue;
            }
            
            // Min/max validation
            if (rules.min !== undefined && numValue < rules.min) {
                field.classList.add('is-invalid');
                showToast(`${rules.label || fieldId} must be at least ${rules.min}`, 'warning');
                isValid = false;
                continue;
            }
            
            if (rules.max !== undefined && numValue > rules.max) {
                field.classList.add('is-invalid');
                showToast(`${rules.label || fieldId} must be no more than ${rules.max}`, 'warning');
                isValid = false;
                continue;
            }
        }
        
        // Email validation
        if (rules.email && value.trim() && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value)) {
            field.classList.add('is-invalid');
            showToast(`Please enter a valid email address`, 'warning');
            isValid = false;
            continue;
        }
    }
    
    // Relationship validations (comparing fields)
    for (const relationship of (validations._relationships || [])) {
        // Min/max relationship validation
        if (relationship.type === 'minLessThanMax') {
            const minField = document.getElementById(relationship.minField);
            const maxField = document.getElementById(relationship.maxField);
            
            if (minField && maxField) {
                const minValue = parseFloat(minField.value);
                const maxValue = parseFloat(maxField.value);
                
                if (!isNaN(minValue) && !isNaN(maxValue) && minValue >= maxValue) {
                    minField.classList.add('is-invalid');
                    maxField.classList.add('is-invalid');
                    showToast(`${relationship.label || 'Min'} must be less than ${relationship.maxLabel || 'Max'}`, 'warning');
                    isValid = false;
                }
            }
        }
        
        // Target between min/max validation
        if (relationship.type === 'targetBetweenMinMax') {
            const minField = document.getElementById(relationship.minField);
            const maxField = document.getElementById(relationship.maxField);
            const targetField = document.getElementById(relationship.targetField);
            
            if (minField && maxField && targetField) {
                const minValue = parseFloat(minField.value);
                const maxValue = parseFloat(maxField.value);
                const targetValue = parseFloat(targetField.value);
                
                if (!isNaN(minValue) && !isNaN(maxValue) && !isNaN(targetValue)) {
                    if (targetValue <= minValue || targetValue >= maxValue) {
                        targetField.classList.add('is-invalid');
                        showToast(`${relationship.targetLabel || 'Target'} must be between ${relationship.minLabel || 'Min'} and ${relationship.maxLabel || 'Max'}`, 'warning');
                        isValid = false;
                    }
                }
            }
        }
    }
    
    return isValid;
}

/**
 * Initialize Socket.IO connection with enhanced error handling and reconnection
 */
function initializeSocketConnection() {
    console.log('Initializing Socket.IO connection');
    
    // Track connection state
    let isReconnecting = false;
    
    // Connection events
    socket.on('connect', function() {
        console.log('Connected to server');
        updateStatusBar('Connected to server', 'success');
        isReconnecting = false;
        
        // Fetch initial data after connection
        fetchDashboardData();
    });
    
    socket.on('disconnect', function(reason) {
        console.log('Disconnected from server. Reason:', reason);
        
        if (reason === 'io server disconnect') {
            // Server intentionally closed the connection, need to manually reconnect
            console.log('Server disconnected the client. Attempting manual reconnect...');
            socket.connect();
        }
        
        updateStatusBar('Disconnected from server. Using simulation mode.', 'danger');
        
        // Start simulation mode when disconnected if not already started
        startSimulation();
    });
    
    // Enhanced reconnection handling
    socket.io.on('reconnect_attempt', (attempt) => {
        isReconnecting = true;
        console.log(`Reconnection attempt ${attempt}`);
        updateStatusBar(`Attempting to reconnect to server... (Attempt ${attempt})`, 'warning');
    });
    
    socket.io.on('reconnect', (attempt) => {
        console.log(`Reconnected to server after ${attempt} attempts`);
        isReconnecting = false;
        updateStatusBar('Connection restored', 'success');
        fetchDashboardData();
    });
    
    socket.io.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
        const errorMessage = error.message || 'Unknown error';
        updateStatusBar(`Failed to reconnect: ${errorMessage}. Using simulation mode.`, 'danger');
    });
    
    socket.io.on('reconnect_failed', () => {
        console.error('Failed to reconnect after all attempts');
        isReconnecting = false;
        updateStatusBar('Connection lost. Using simulation mode.', 'danger');
        
        // Show reconnect button in the UI
        addReconnectButton();
    });
    
    socket.io.on('error', (error) => {
        console.error('Socket.IO error:', error);
        const errorMessage = error.message || 'Unknown error';
        updateStatusBar(`Connection error: ${errorMessage}`, 'danger');
    });
    
    // Data update events
    socket.on('parameter_update', function(data) {
        console.log('Parameter update received:', data);
        
        // Update specific parameter
        if (data.parameter && data.value !== undefined) {
            mockData[data.parameter] = data.value;
            
            // Update UI based on parameter type
            updateUIForParameter(data.parameter, data.value);
        }
    });
    
    socket.on('pump_status', function(data) {
        console.log('Pump status update received:', data);
        
        if (data.pump && data.status !== undefined) {
            // Update pump status
            mockData[data.pump + 'PumpRunning'] = data.status;
            updatePumpStatus(data.pump + 'Pump', data.status);
            updatePumpStatus(data.pump + 'PumpDetail', data.status);
        }
    });
    
    socket.on('system_alert', function(data) {
        console.log('System alert received:', data);
        
        if (data.message) {
            showToast(data.message, data.type || 'info');
            
            // If critical alert, also update status bar
            if (data.type === 'danger' || data.type === 'warning') {
                updateStatusBar(data.message, data.type);
            }
        }
    });
    
    // Add custom event for dosing events
    socket.on('dosing_event', function(data) {
        console.log('Dosing event received:', data);
        
        // Update UI to reflect the new mode
        updateDosingModeUI(data.mode);
    
        // Show a toast notification
        showToast(`Dosing mode changed to ${data.mode}`, 'info');

        if (data.type && data.duration) {
            // Show dosing event notification
            showToast(`${data.type} dosing started for ${data.duration} seconds`, 'info');
            
            // Update pump status
            if (data.type.toLowerCase() === 'ph') {
                mockData.phPumpRunning = true;
                updatePumpStatus('phPump', true);
                updatePumpStatus('phPumpDetail', true);
                
                // Auto-stop after duration
                setTimeout(() => {
                    mockData.phPumpRunning = false;
                    updatePumpStatus('phPump', false);
                    updatePumpStatus('phPumpDetail', false);
                }, data.duration * 1000);
            } else if (data.type.toLowerCase() === 'chlorine' || data.type.toLowerCase() === 'cl') {
                mockData.clPumpRunning = true;
                updatePumpStatus('clPump', true);
                updatePumpStatus('clPumpDetail', true);
                
                // Auto-stop after duration
                setTimeout(() => {
                    mockData.clPumpRunning = false;
                    updatePumpStatus('clPump', false);
                    updatePumpStatus('clPumpDetail', false);
                }, data.duration * 1000);
            } else if (data.type.toLowerCase() === 'pac') {
                mockData.pacPumpRunning = true;
                updatePumpStatus('pacPump', true);
                updatePumpStatus('pacPumpDetail', true);
                
                // Auto-stop after duration
                setTimeout(() => {
                    mockData.pacPumpRunning = false;
                    updatePumpStatus('pacPump', false);
                    updatePumpStatus('pacPumpDetail', false);
                }, data.duration * 1000);
            }
        }
    });
    
    // Connection management
    socket.io.on('reconnect_attempt', (attempt) => {
        console.log(`Reconnection attempt ${attempt}`);
        updateStatusBar(`Attempting to reconnect to server... (Attempt ${attempt})`, 'warning');
    });
    
    socket.io.on('reconnect', () => {
        console.log('Reconnected to server');
        updateStatusBar('Connection restored', 'success');
        fetchDashboardData();
    });
    
    socket.io.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
        updateStatusBar('Failed to reconnect. Using simulation mode.', 'danger');
    });
    
    socket.io.on('reconnect_failed', () => {
        console.error('Failed to reconnect after all attempts');
        updateStatusBar('Connection lost. Using simulation mode.', 'danger');
    });
}

// Add this helper function
function updateDosingModeUI(mode) {
    // Update mode toggle if it exists
    const autoSwitch = document.getElementById('pacAutoSwitch');
    if (autoSwitch) {
        autoSwitch.checked = (mode === 'AUTOMATIC');
    }
    
    // Update status badge
    const statusBadge = document.getElementById('pacDosingStatus');
    if (statusBadge) {
        if (mode === 'AUTOMATIC') {
            statusBadge.textContent = 'Optimized';
            statusBadge.className = 'badge bg-success';
        } else if (mode === 'MANUAL') {
            statusBadge.textContent = 'Manual';
            statusBadge.className = 'badge bg-warning';
        } else {
            statusBadge.textContent = 'Off';
            statusBadge.className = 'badge bg-secondary';
        }
    }
    
    // Update manual control buttons
    const isManualMode = (mode === 'MANUAL');
    const isManualPageActive = document.getElementById('manualMode').classList.contains('active');
    
    document.getElementById('pacDoseBtn').disabled = !(isManualMode && isManualPageActive);
    document.getElementById('pacStopBtn').disabled = !(isManualMode && isManualPageActive);
    document.getElementById('pacFlowRate').disabled = !(isManualMode && isManualPageActive);
}

function fetchDosingStatus() {
    fetch('/api/dosing/status')
        .then(response => response.json())
        .then(data => {
            console.log('Dosing status:', data);
            updateDosingModeUI(data.mode);
        })
        .catch(error => {
            console.error('Error fetching dosing status:', error);
        });
}

/**
 * Update ARIA attributes for accessibility
 * @param {string} id - Element ID
 * @param {number} value - Current value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 */
function updateAriaAttributes(id, value, min, max) {
    const element = document.querySelector(`#${id}Value`).closest('.d-flex').querySelector('.parameter-range');
    if (element) {
        element.setAttribute('aria-valuenow', value);
        element.setAttribute('aria-valuemin', min);
        element.setAttribute('aria-valuemax', max);
    }
}

/**
 * Format a numeric value with appropriate decimal places
 * @param {number} value - Number to format
 * @param {string} paramType - Parameter type (e.g., 'ph', 'orp', 'chlorine')
 * @returns {string} - Formatted value
 */
function formatParameterValue(value, paramType) {
    if (typeof value !== 'number' || isNaN(value)) {
        return String(value);
    }
    
    switch (paramType) {
        case 'ph':
            return value.toFixed(2);
        case 'orp':
        case 'uvIntensity':
            return Math.round(value).toString();
        case 'chlorine':
        case 'freeChlorine':
        case 'combinedChlorine':
            return value.toFixed(2);
        case 'turbidity':
            return value.toFixed(3);
        case 'temperature':
            return value.toFixed(1);
        default:
            // Default formatting based on magnitude
            return value < 10 ? value.toFixed(2) : value.toFixed(1);
    }
}

/**
 * Synchronize parameter selection between checkboxes, buttons, and chart visibility
 * @param {string} source - Source of the update ('checkbox', 'button', or 'chart')
 * @param {string} id - ID of the element that triggered the update
 * @param {boolean} isVisible - Whether the parameter should be visible
 * Enhanced version of your syncParameterSelection with better error handling
 */
function syncParameterSelection(source, id, isVisible) {
    // Validate chart existence first
    if (!window.historyChart || !window.historyChart.data || !window.historyChart.data.datasets) {
        console.warn("Chart not fully initialized for parameter sync");
        return;
    }
    
    // Make sure these mappings exist
    const checkboxToDataset = {
        'showPh': 0,
        'showOrp': 1,
        'showFreeChlorine': 2,
        'showCombinedChlorine': 3,
        'showTurbidity': 4,
        'showTemp': 5,
        'showDosingEvents': 6
    };
    
    const datasetToCheckbox = {
        0: 'showPh',
        1: 'showOrp',
        2: 'showFreeChlorine',
        3: 'showCombinedChlorine',
        4: 'showTurbidity',
        5: 'showTemp',
        6: 'showDosingEvents'
    };
    
    // Define buttonToDataset if it doesn't exist
    const buttonToDataset = {
        'pH': 0,
        'ORP': 1,
        'Free Chlorine': 2,
        'Combined Cl': 3,
        'Turbidity': 4,
        'Temperature': 5
    };
    
    // Define datasetToButton if it doesn't exist
    const datasetToButton = {
        0: 'pH',
        1: 'ORP',
        2: 'Free Chlorine',
        3: 'Combined Cl',
        4: 'Turbidity',
        5: 'Temperature'
    };
    
    try {
        if (source === 'checkbox') {
            // Update from checkbox - find corresponding dataset
            const datasetIndex = checkboxToDataset[id];
            if (datasetIndex === undefined) return;
            
            // Update chart visibility - use direct property setting instead of method
            window.historyChart.data.datasets[datasetIndex].hidden = !isVisible;
            
            // Update button state if exists
            const buttonText = datasetToButton[datasetIndex];
            if (buttonText) {
                const buttons = document.querySelectorAll('.btn-group .btn');
                buttons.forEach(button => {
                    if (button.textContent.trim() === buttonText) {
                        button.classList.toggle('active', isVisible);
                        button.classList.toggle('btn-primary', isVisible);
                        button.classList.toggle('btn-outline-secondary', !isVisible);
                    }
                });
            }
        } else if (source === 'button') {
            // Update from button - find corresponding dataset
            const datasetIndex = buttonToDataset[id];
            if (datasetIndex === undefined) return;
            
            // Update chart visibility
            window.historyChart.data.datasets[datasetIndex].hidden = !isVisible;
            
            // Update checkbox state
            const checkboxId = datasetToCheckbox[datasetIndex];
            if (checkboxId) {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.checked = isVisible;
                }
            }
        } else if (source === 'chart') {
            // Update from chart legend - sync both buttons and checkboxes
            const datasetIndex = parseInt(id);
            if (isNaN(datasetIndex)) return;
            
            // Update checkbox state
            const checkboxId = datasetToCheckbox[datasetIndex];
            if (checkboxId) {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.checked = isVisible;
                }
            }
            
            // Update button state
            const buttonText = datasetToButton[datasetIndex];
            if (buttonText) {
                const buttons = document.querySelectorAll('.btn-group .btn');
                buttons.forEach(button => {
                    if (button.textContent.trim() === buttonText) {
                        button.classList.toggle('active', isVisible);
                        button.classList.toggle('btn-primary', isVisible);
                        button.classList.toggle('btn-outline-secondary', !isVisible);
                    }
                });
            }
        }
        
        // Always update axis visibility after any change
        if (typeof updateAllAxisVisibility === 'function') {
            updateAllAxisVisibility();
        }
        
        // Update chart with minimal animation
        window.historyChart.update('none');
        
        // Update ARIA label with current visible parameters
        if (typeof updateChartAriaLabel === 'function') {
            updateChartAriaLabel();
        }
    } catch (error) {
        console.error("Error in syncParameterSelection:", error);
    }
}

/**
 * Generate a random parameter change with constraints
 * @param {number} currentValue - Current parameter value
 * @param {number} magnitude - Maximum change magnitude
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {number} probability - Probability of change (0-1)
 * @returns {Object} - Object with newValue and changed flag
 */
function generateParameterChange(currentValue, magnitude, min, max, probability = 0.3) {
    if (Math.random() >= probability) {
        return { newValue: currentValue, changed: false };
    }
    
    const change = (Math.random() - 0.5) * magnitude;
    const newValue = clamp(currentValue + change, min, max);
    const changed = Math.abs(newValue - currentValue) > 0.001;
    
    return { newValue, changed };
}

/**
 * Generate changes for chemistry parameters (pH, ORP, chlorine)
 * @returns {Object} - Object with updated parameters and change flags
 */
function generateChemistryChanges() {
    const data = { ...mockData };
    let changed = false;
    let chemistryChanged = false;
    
    // pH changes (30% chance)
    const phChange = generateParameterChange(data.ph, 0.05, 6.8, 8.0);
    data.ph = phChange.newValue;
    changed = changed || phChange.changed;
    chemistryChanged = chemistryChanged || phChange.changed;
    
    // ORP changes (20% chance)
    const orpChange = generateParameterChange(data.orp, 10, 600, 800, 0.2);
    data.orp = orpChange.newValue;
    changed = changed || orpChange.changed;
    
    // Free chlorine changes (25% chance)
    const clChange = generateParameterChange(data.freeChlorine, 0.05, 0.5, 3.0, 0.25);
    data.freeChlorine = clChange.newValue;
    changed = changed || clChange.changed;
    chemistryChanged = chemistryChanged || clChange.changed;
    
    // Combined chlorine changes (15% chance)
    const combClChange = generateParameterChange(data.combinedChlorine, 0.02, 0, 0.5, 0.15);
    data.combinedChlorine = combClChange.newValue;
    changed = changed || combClChange.changed;
    chemistryChanged = chemistryChanged || combClChange.changed;
    
    return { data, changed, chemistryChanged };
}

/**
 * Generate changes for physical parameters (turbidity, temperature)
 * @returns {Object} - Object with updated parameters and change flags
 */
function generatePhysicalChanges() {
    const data = { ...mockData };
    let changed = false;
    let turbidityChanged = false;
    
    // Turbidity changes (20% chance)
    const turbChange = generateParameterChange(data.turbidity, 0.01, 0.05, 0.5, 0.2);
    data.turbidity = turbChange.newValue;
    changed = changed || turbChange.changed;
    turbidityChanged = turbChange.changed;
    
    // Temperature changes (10% chance - temperature changes slowly)
    const tempChange = generateParameterChange(data.temperature, 0.1, 20, 32, 0.1);
    data.temperature = tempChange.newValue;
    changed = changed || tempChange.changed;
    
    return { data, changed, turbidityChanged };
}

/**
 * Generate pump status changes
 * @returns {Object} - Object with updated pump statuses and change flag
 */
function generatePumpChanges() {
    const data = { ...mockData };
    let changed = false;
    
    // Occasionally toggle pump states (5% chance for each pump)
    const activeSessions = window.activeDosingSessions || { ph: false, cl: false, pac: false };

    // Only toggle pumps that aren't in active dosing sessions
    if (Math.random() < 0.05 && !activeSessions.ph) {
        data.phPumpRunning = !data.phPumpRunning;
        changed = true;
    }
    
    if (Math.random() < 0.05 && !activeSessions.cl) {
        data.clPumpRunning = !data.clPumpRunning;
        changed = true;
    }
    
    if (Math.random() < 0.05 && !activeSessions.pac) {
        data.pacPumpRunning = !data.pacPumpRunning;
        changed = true;
    }
    
    return { data, changed };
}

/**
 * Simulate data changes for demonstration with improved performance
 */
function simulateDataChanges() {
    // Get active tab
    const activeTabLink = document.querySelector('#sidebar .nav-link.active');
    const activeTabId = activeTabLink ? activeTabLink.getAttribute('href') : '#overview-tab';
    
    // Generate chemistry parameter changes
    const chemChanges = generateChemistryChanges();
    
    // Generate physical parameter changes
    const physChanges = generatePhysicalChanges();
    
    // Generate pump status changes
    const pumpChanges = generatePumpChanges();
    
    // Merge all changes into mockData
    Object.assign(mockData, chemChanges.data, physChanges.data, pumpChanges.data);
    
    // Only update UI if something changed and we're on the relevant tab
    if (chemChanges.changed || physChanges.changed) {
        // Overview is always updated regardless of tab
        requestAnimationFrame(() => {
            updateParameterDisplays(mockData);
        });
    }
    
    if (chemChanges.chemistryChanged && (activeTabId === '#overview-tab' || activeTabId === '#water-chemistry-tab')) {
        requestAnimationFrame(() => {
            updateWaterChemistryDisplays();
        });
    }
    
    if (physChanges.turbidityChanged && (activeTabId === '#overview-tab' || activeTabId === '#turbidity-pac-tab')) {
        requestAnimationFrame(() => {
            updateTurbidityPACDisplays();
        });
    }
    
    if (pumpChanges.changed) {
        requestAnimationFrame(() => {
            updateAllPumpStatuses();
        });
    }
}

/**
 * Update all pump statuses based on current state
 */
function updateAllPumpStatuses() {
    // Check if elements exist before updating them
    const phPumpStatus = document.getElementById('phPumpStatus');
    const phPumpDetailStatus = document.getElementById('phPumpDetailStatus');
    const clPumpStatus = document.getElementById('clPumpStatus');
    const clPumpDetailStatus = document.getElementById('clPumpDetailStatus');
    const pacPumpStatus = document.getElementById('pacPumpStatus');
    const pacPumpDetailStatus = document.getElementById('pacPumpDetailStatus');
    
    if (phPumpStatus) updatePumpStatus('phPump', mockData.phPumpRunning);
    if (phPumpDetailStatus) updatePumpStatus('phPumpDetail', mockData.phPumpRunning);
    if (clPumpStatus) updatePumpStatus('clPump', mockData.clPumpRunning);
    if (clPumpDetailStatus) updatePumpStatus('clPumpDetail', mockData.clPumpRunning);
    if (pacPumpStatus) updatePumpStatus('pacPump', mockData.pacPumpRunning);
    if (pacPumpDetailStatus) updatePumpStatus('pacPumpDetail', mockData.pacPumpRunning);
}

/**
 * Generate sample data for history chart
 * @param {number} baseValue - Base value for data generation
 * @param {number} variation - Maximum variation from base value
 * @param {number} count - Number of data points to generate
 * @returns {Array} - Array of data points
 */
function generateHistoryData(baseValue, variation, count) {
    const data = [];
    for (let i = 0; i < count; i++) {
        // Add some trend using sine wave
        const trend = Math.sin(i / 20) * variation * 0.5;
        // Add randomness
        const random = (Math.random() - 0.5) * variation;
        // Combine for final value
        const value = baseValue + trend + random;
        data.push(value);
    }
    return data;
}

/**
 * Generate time labels with appropriate resolution
 * @param {number} hours - Number of hours to generate labels for
 * @param {string} resolution - Data resolution (raw, minute, hour, day)
 * @returns {Array} Array of formatted date/time labels
 */
function generateTimeLabels(hours, resolution = 'hour') {
    const labels = [];
    const now = new Date();
    let interval;
    
    // Set interval based on resolution
    switch (resolution) {
        case 'raw':
            interval = 15 * 60 * 1000; // 15 minutes in ms
            break;
        case 'minute':
            interval = 60 * 1000; // 1 minute in ms
            break;
        case 'hour':
            interval = 60 * 60 * 1000; // 1 hour in ms
            break;
        case 'day':
            interval = 24 * 60 * 60 * 1000; // 1 day in ms
            break;
        default:
            interval = 60 * 60 * 1000; // Default to hourly
    }
    
    // Calculate number of points based on hours and interval
    const points = Math.ceil((hours * 60 * 60 * 1000) / interval);
    
    for (let i = points - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setTime(date.getTime() - (i * interval));
        labels.push(formatDateTime(date, resolution));
    }
    
    return labels;
}

/**
 * Configure chart axis options based on time range
 * @param {Object} chart - Chart.js chart object
 * @param {number} hours - Number of hours in the time range
 */
function configureChartTimeAxis(chart, hours) {
    // Update axis options for better display with different time ranges
    if (hours <= 48) {
        chart.options.scales.x.ticks.maxTicksLimit = 24;
    } else if (hours <= 168) {
        chart.options.scales.x.ticks.maxTicksLimit = 14;
    } else {
        chart.options.scales.x.ticks.maxTicksLimit = 10;
    }
    
    // Force responsive adaptation to current size
    const currentWidth = chart.width;
    chart.options.onResize(chart, {width: currentWidth, height: chart.height});
}

/**
 * Updates the ARIA label of a chart based on time range or visible parameters
 * @param {string} [chartId] - Chart canvas ID (for time-range version)
 * @param {number} [hours] - Number of hours in time range (for time-range version)
 * @param {object} [chart] - Chart.js chart object (defaults to historyChart if not provided)
 */
function updateChartAriaLabel(chartId, hours, chart) {
    try {
        // Use historyChart as default if no chart object provided
        chart = chart || window.historyChart;
        
        // Exit if no valid chart
        if (!chart || !chart.data || !chart.data.datasets) {
            console.warn('No valid chart available for ARIA label update');
            return;
        }
        
        // Check if dataset is visible safely
        const isDatasetVisible = (index) => {
            // First check if the dataset exists
            if (!chart.data.datasets[index]) return false;
            
            // Try the Chart.js API method first
            if (typeof chart.isDatasetVisible === 'function') {
                try {
                    return chart.isDatasetVisible(index);
                } catch (e) {
                    // Fallback to checking hidden property directly
                    return !chart.data.datasets[index].hidden;
                }
            } else {
                // No visibility method, check hidden property
                return !chart.data.datasets[index].hidden;
            }
        };
        
        // If chartId and hours are provided, it's the time-range version
        if (chartId && hours) {
            const chartElement = document.getElementById(chartId);
            if (!chartElement) {
                console.warn(`Chart element with ID ${chartId} not found`);
                return;
            }
            
            const chartContainer = chartElement.closest('.chart-container');
            if (!chartContainer) {
                console.warn('Chart container not found');
                return;
            }
            
            const endDate = new Date();
            const startDate = new Date();
            startDate.setHours(startDate.getHours() - hours);
            
            // Format dates for accessibility description
            const formatDate = (date) => {
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            };
            
            // Get visible parameters for a more descriptive label
            const visibleParams = [];
            const parameterMap = [
                {index: 0, name: 'pH'},
                {index: 1, name: 'ORP'},
                {index: 2, name: 'Free Chlorine'},
                {index: 3, name: 'Combined Chlorine'},
                {index: 4, name: 'Turbidity'},
                {index: 5, name: 'Temperature'},
                {index: 6, name: 'Dosing Events'}
            ];
            
            parameterMap.forEach(param => {
                if (isDatasetVisible(param.index)) {
                    visibleParams.push(param.name);
                }
            });
            
            const paramText = visibleParams.length > 0 
                ? `showing ${visibleParams.join(', ')}` 
                : 'showing selected parameters';
                
            chartContainer.setAttribute('aria-label', 
                `Chart ${paramText} from ${formatDate(startDate)} to ${formatDate(endDate)}`);
        } 
        // No chartId/hours - update based on visible datasets only
        else {
            const container = chart.canvas ? chart.canvas.closest('.chart-container') : null;
            if (!container) {
                console.warn('Chart container not found for ARIA label update');
                return;
            }
            
            // Get names of visible parameters
            const visibleParams = [];
            const parameterMap = [
                {index: 0, name: 'pH'},
                {index: 1, name: 'ORP'},
                {index: 2, name: 'free chlorine'},
                {index: 3, name: 'combined chlorine'},
                {index: 4, name: 'turbidity'},
                {index: 5, name: 'temperature'},
                {index: 6, name: 'dosing events'}
            ];
            
            parameterMap.forEach(param => {
                if (isDatasetVisible(param.index)) {
                    visibleParams.push(param.name);
                }
            });
            
            // Create descriptive label
            let label = 'Chart showing ';
            
            if (visibleParams.length === 0) {
                label += 'no parameters';
            } else if (visibleParams.length === 1) {
                label += visibleParams[0];
            } else {
                label += visibleParams.slice(0, -1).join(', ') + ' and ' + visibleParams[visibleParams.length - 1];
            }
            
            container.setAttribute('aria-label', label);
        }
    } catch (error) {
        console.error('Error updating chart ARIA label:', error);
        // Don't let ARIA label errors break chart functionality
    }
}

/**
 * Enhanced update history chart with support for resolution and visualization type
 * @param {number} hours - Number of hours to display
 * @param {string} resolution - Data resolution (raw, minute, hour, day)
 * @param {string} visualizationType - Chart type (line, bar, scatter)
 */
function updateHistoryChart(hours, resolution, visualizationType) {
    if (!window.historyChart) {
        console.warn("Cannot update history chart - chart not initialized");
        return;
    }
    
    try {
        // Show loading state
        showLoading('#historyChart');
        
        console.log(`Updating history chart - Range: ${hours}h, Resolution: ${resolution || 'default'}, Type: ${visualizationType || 'default'}`);
        
        // Get current resolution if not provided
        if (!resolution) {
            resolution = document.getElementById('dataResolution')?.value || 'hour';
        }
        
        // Determine data point density based on resolution
        let dataPointsPerHour = 1; // Default: hourly
        switch (resolution) {
            case 'raw':
                dataPointsPerHour = 4; // 15 minutes
                break;
            case 'minute':
                dataPointsPerHour = 60; // 1 minute
                break;
            case 'hour':
                dataPointsPerHour = 1; // 1 hour
                break;
            case 'day':
                dataPointsPerHour = 1/24; // 1 day (1/24 points per hour)
                break;
        }
        
        // Calculate total data points
        const totalPoints = Math.ceil(hours * dataPointsPerHour);
        
        // Generate time labels based on resolution
        const labels = generateTimeLabels(hours, resolution);
        
        // Generate data for each parameter with appropriate granularity
        const phData = generateHistoryData(7.4, 0.2, totalPoints);
        const orpData = generateHistoryData(720, 30, totalPoints);
        const freeChlorineData = generateHistoryData(1.2, 0.3, totalPoints);
        const combinedChlorineData = generateHistoryData(0.2, 0.1, totalPoints);
        const turbidityData = generateHistoryData(0.15, 0.05, totalPoints);
        const temperatureData = generateHistoryData(28, 1, totalPoints);
        
        // Generate dosing events
        const dosingEvents = generateSampleEvents(hours, Math.max(5, Math.floor(hours / 12)));
        
        // Update chart data
        window.historyChart.data.labels = labels;
        window.historyChart.data.datasets[0].data = phData;
        window.historyChart.data.datasets[1].data = orpData;
        window.historyChart.data.datasets[2].data = freeChlorineData;
        window.historyChart.data.datasets[3].data = combinedChlorineData;
        window.historyChart.data.datasets[4].data = turbidityData;
        window.historyChart.data.datasets[5].data = temperatureData;
        window.historyChart.data.datasets[6].data = dosingEvents;
        
        // Configure chart options based on time range
        configureChartTimeAxis(window.historyChart, hours);
        
        // Update chart type if specified
        if (visualizationType && window.historyChart.config.type !== visualizationType) {
            updateHistoryChartType(visualizationType);
        }
        
        // Update ARIA label
        updateChartAriaLabel('historyChart', hours);
        
        // Update table data
        updateTableDataForPage('historyDataTable', 1);
        
        // Sync UI controls with current state
        syncUIControlsWithState(hours, resolution, visualizationType);
        
        // Update chart
        window.historyChart.update();
        
        console.log("History chart updated successfully");
    } catch (error) {
        console.error("Error updating history chart:", error);
    } finally {
        // Always hide loading state, even if there was an error
        hideLoading('#historyChart');
    }
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
 * Update ARIA attributes for all parameter ranges
 */
function updateAllRangeAriaAttributes() {
    // Update pH range
    updateAriaAttributes('ph', mockData.ph, 6.8, 8.0);
    
    // Update ORP range
    updateAriaAttributes('orp', mockData.orp, 600, 800);
    
    // Update chlorine ranges
    updateAriaAttributes('freeChlorine', mockData.freeChlorine, 0.5, 3.0);
    
    // Update turbidity range
    updateAriaAttributes('turbidity', mockData.turbidity, 0.05, 0.5);
    
    // Update temperature range
    updateAriaAttributes('temp', mockData.temperature, 20, 32);
}

/**
 * Add a reconnect button to the UI when connection fails completely
 */
function addReconnectButton() {
    // Check if button already exists
    if (document.getElementById('reconnectBtn')) return;
    
    // Create button
    const reconnectBtn = document.createElement('button');
    reconnectBtn.id = 'reconnectBtn';
    reconnectBtn.className = 'btn btn-warning';
    reconnectBtn.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Reconnect';
    reconnectBtn.addEventListener('click', function() {
        socket.connect();
        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Connecting...';
        setTimeout(() => {
            this.disabled = false;
            this.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Reconnect';
        }, 5000);
    });
    
    // Add to status bar area
    const statusBar = document.getElementById('statusBar');
    statusBar.parentNode.insertBefore(reconnectBtn, statusBar.nextSibling);
}

/**
 * Update UI for a specific parameter
 * @param {string} parameter - Parameter name
 * @param {any} value - Parameter value
 */
function updateUIForParameter(parameter, value) {
    // Update dashboard display for the parameter
    switch(parameter) {
        case 'ph':
        case 'orp':
        case 'freeChlorine':
        case 'combinedChlorine':
        case 'turbidity':
        case 'temperature':
        case 'uvIntensity':
            updateParameter(parameter, value);
            break;
        case 'phPumpRunning':
            updatePumpStatus('phPump', value);
            updatePumpStatus('phPumpDetail', value);
            break;
        case 'clPumpRunning':
            updatePumpStatus('clPump', value);
            updatePumpStatus('clPumpDetail', value);
            break;
        case 'pacPumpRunning':
            updatePumpStatus('pacPump', value);
            updatePumpStatus('pacPumpDetail', value);
            break;
        case 'pacDosingRate':
            // Update PAC dosing rate displays
            const pacDosingRateEl = document.getElementById('pacDosingRate');
            if (pacDosingRateEl) {
                pacDosingRateEl.textContent = value;
            }
            break;
    }
}

/**
 * Safe chart data update function with better error handling
 */
window.updateChartData = function(data) {
    // Skip updates if no data is provided
    if (!data) {
        console.warn('No data provided to updateChartData');
        return;
    }
    
    console.log('Updating chart data:', data);
    
    // Update turbidity chart with proper error handling
    try {
        if (window.turbidityChart && 
            window.turbidityChart.data && 
            window.turbidityChart.data.datasets && 
            window.turbidityChart.data.datasets[0] && 
            data.turbidity !== undefined) {
            
            // Get current data
            const chartData = window.turbidityChart.data.datasets[0].data;
            const labels = window.turbidityChart.data.labels;
            
            // Add new data point (keep last 24 points)
            if (chartData && chartData.length >= 24) {
                chartData.shift();
                if (labels && labels.length >= 24) {
                    labels.shift();
                }
            }
            
            if (chartData) {
                chartData.push(data.turbidity);
                if (labels) {
                    labels.push(formatTime(new Date()));
                }
                
                // Use 'none' animation mode for better performance
                window.turbidityChart.update('none');
            }
        }
    } catch (error) {
        console.error('Error updating turbidity chart:', error);
    }
    
    // Update chemistry chart with proper error handling
    try {
        if (window.chemistryChart && 
            window.chemistryChart.data && 
            window.chemistryChart.data.datasets) {
            
            // Update pH data if available
            if (data.ph !== undefined && 
                window.chemistryChart.data.datasets[0] && 
                window.chemistryChart.data.datasets[0].data) {
                
                const phData = window.chemistryChart.data.datasets[0].data;
                
                // Keep last 24 points
                if (phData.length >= 24) {
                    phData.shift();
                }
                
                phData.push(data.ph);
            }
            
            // Update chlorine data if available
            if (data.freeChlorine !== undefined && 
                window.chemistryChart.data.datasets[1] && 
                window.chemistryChart.data.datasets[1].data) {
                
                const clData = window.chemistryChart.data.datasets[1].data;
                
                // Keep last 24 points
                if (clData.length >= 24) {
                    clData.shift();
                }
                
                clData.push(data.freeChlorine);
            }
            
            // Update labels
            if (window.chemistryChart.data.labels) {
                const labels = window.chemistryChart.data.labels;
                if (labels.length >= 24) {
                    labels.shift();
                }
                labels.push(formatTime(new Date()));
            }
            
            // Update chart with minimal animation for performance
            window.chemistryChart.update('none');
        }
    } catch (error) {
        console.error('Error updating chemistry chart:', error);
    }
};

// Helper function for formatting time if it doesn't exist
function formatTime(date) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Add to dashboard.js
function setupLiveChartUpdates() {
    // Ensure socket and charts are initialized
    if (!socket || !window.turbidityChart || !window.chemistryChart) return;
    
    // Handle real-time parameter updates for charts
    socket.on('parameter_update', function(data) {
        // Get current timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Update turbidity chart if it exists and has data
        if (window.turbidityChart && window.turbidityChart.data && 
            window.turbidityChart.data.datasets && window.turbidityChart.data.datasets[0]) {
            
            // Add new data point (limit to 50 points)
            if (window.turbidityChart.data.labels.length >= 50) {
                window.turbidityChart.data.labels.shift();
                window.turbidityChart.data.datasets[0].data.shift();
                
                // Also shift dosing events if they exist
                if (window.turbidityChart.data.datasets[1]) {
                    window.turbidityChart.data.datasets[1].data.shift();
                }
            }
            
            // Add new turbidity value
            window.turbidityChart.data.labels.push(timeStr);
            window.turbidityChart.data.datasets[0].data.push(data.turbidity);
            
            // Add null for dosing event (will be updated on dosing event message)
            if (window.turbidityChart.data.datasets[1]) {
                window.turbidityChart.data.datasets[1].data.push(null);
            }
            
            // Update chart with animation duration of 0 for better performance
            window.turbidityChart.update('none');
        }
        
        // Similarly update chemistry chart
        if (window.chemistryChart && window.chemistryChart.data && 
            window.chemistryChart.data.datasets) {
            
            // Manage data points (limit to 50)
            if (window.chemistryChart.data.labels.length >= 50) {
                window.chemistryChart.data.labels.shift();
                window.chemistryChart.data.datasets.forEach(dataset => {
                    if (dataset.data) dataset.data.shift();
                });
            }
            
            // Add label
            window.chemistryChart.data.labels.push(timeStr);
            
            // Add data for each parameter
            if (window.chemistryChart.data.datasets[0] && data.ph !== undefined) {
                window.chemistryChart.data.datasets[0].data.push(data.ph);
            }
            
            if (window.chemistryChart.data.datasets[1] && data.orp !== undefined) {
                window.chemistryChart.data.datasets[1].data.push(data.orp / 100); // Scale for display
            }
            
            if (window.chemistryChart.data.datasets[2] && data.freeChlorine !== undefined) {
                window.chemistryChart.data.datasets[2].data.push(data.freeChlorine);
            }
            
            // Update chart without animation
            window.chemistryChart.update('none');
        }
    });
    
    // Handle dosing events for chart annotation
    socket.on('dosing_event', function(data) {
        // If this is a PAC dosing event, add a marker to the turbidity chart
        if (data.type && data.type.toLowerCase() === 'pac' && 
            window.turbidityChart && window.turbidityChart.data && 
            window.turbidityChart.data.datasets && window.turbidityChart.data.datasets[1]) {
            
            // Replace the last null value with the dosing marker
            const lastIndex = window.turbidityChart.data.datasets[1].data.length - 1;
            if (lastIndex >= 0) {
                // Set marker at top of chart
                window.turbidityChart.data.datasets[1].data[lastIndex] = 0.4; // Position at top
                window.turbidityChart.update('none');
                
                // After 5 seconds, fade out the marker
                setTimeout(() => {
                    window.turbidityChart.data.datasets[1].data[lastIndex] = null;
                    window.turbidityChart.update('none');
                }, 5000);
            }
        }
    });
}

/**
 * Improved toggle dosing events function with better error handling
 */
function toggleDosingEvents(checked) {
    if (!window.historyChart || !window.historyChart.data || !window.historyChart.data.datasets) {
        console.warn("Chart not available for dosing events toggle");
        return false;
    }
    
    try {
        // Find the dosing events dataset
        const dosingEventsIndex = 6;
        const dosingDataset = window.historyChart.data.datasets[dosingEventsIndex];
        
        if (!dosingDataset) {
            console.warn("Dosing events dataset not found at index 6");
            return false;
        }
        
        console.log(`Setting dosing events visibility to ${checked ? 'visible' : 'hidden'}`);
        
        // Set visibility directly
        dosingDataset.hidden = !checked;
        
        // Update the chart
        window.historyChart.update('none');
        
        // If axis visibility update function exists, call it
        if (typeof updateAllAxisVisibility === 'function') {
            updateAllAxisVisibility();
        }
        
        return true;
    } catch (error) {
        console.error("Error toggling dosing events:", error);
        return false;
    }
}

/**
 * Fix initialization of event listeners for the dosing events toggle
 */
function setupDosingEventsToggle() {
    const checkbox = document.getElementById('showDosingEvents');
    if (!checkbox) return;
    
    // Remove existing listeners
    const newCheckbox = checkbox.cloneNode(true);
    checkbox.parentNode.replaceChild(newCheckbox, checkbox);
    
    // Add new handler with proper error handling
    newCheckbox.addEventListener('change', function() {
        toggleDosingEvents(this.checked);
    });
}

/**
 * Updated function to safely handle axis visibility updates
 */
function updateAllAxisVisibility() {
    try {
        // Make sure we use the global reference to ensure consistency
        if (!window.historyChart || !window.historyChart.options || !window.historyChart.options.scales) {
            console.warn("Cannot update axis visibility - chart not ready");
            return;
        }
        
        // First, set all axes to hidden
        Object.keys(window.historyChart.options.scales).forEach(scaleId => {
            if (scaleId.startsWith('y-')) {
                window.historyChart.options.scales[scaleId].display = false;
                if (window.historyChart.options.scales[scaleId].title) {
                    window.historyChart.options.scales[scaleId].title.display = false;
                }
            }
        });
        
        // Map datasets to their corresponding axes
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
        for (let i = 0; i < window.historyChart.data.datasets.length; i++) {
            // Check visibility directly using hidden property
            const isVisible = !window.historyChart.data.datasets[i].hidden;
            
            if (isVisible) {
                const axisId = datasetToAxisMap[i];
                if (axisId && window.historyChart.options.scales[axisId]) {
                    window.historyChart.options.scales[axisId].display = true;
                    
                    // Also ensure axis title is visible
                    if (window.historyChart.options.scales[axisId].title) {
                        window.historyChart.options.scales[axisId].title.display = true;
                    }
                }
            }
        }
        
        // Make sure to update the chart with the new axis visibility
        window.historyChart.update('none');
        
        console.log("Axis visibility updated successfully");
    } catch (error) {
        console.error("Error updating axis visibility:", error);
    }
}

/**
 * Ensure axis visibility is properly updated after chart initialization
 */
function enhanceChartInitialization() {
    // Store reference to original initialization function
    const originalInitFunction = window.initializeHistoryChart;
    
    // Replace with enhanced version
    window.initializeHistoryChart = function() {
        try {
            // Call original function
            originalInitFunction.apply(this, arguments);
            
            // Give the chart time to fully render before updating axes
            setTimeout(() => {
                console.log("Delayed axis visibility update");
                if (window.historyChart) {
                    updateAllAxisVisibility();
                }
            }, 200);
        } catch (error) {
            console.error("Error in enhanced chart initialization:", error);
        }
    };
}

/**
 * Modify syncParameterSelection to use a delayed axis update
 */
function enhanceSyncParameterSelection() {
    // Store reference to original sync function
    const originalSyncFunction = window.syncParameterSelection;
    
    // Replace with enhanced version
    window.syncParameterSelection = function(source, id, isVisible) {
        try {
            // Call original function but remove its axis update call
            originalSyncFunction.call(this, source, id, isVisible);
            
            // Perform axis update with a short delay to ensure chart is ready
            setTimeout(() => {
                updateAllAxisVisibility();
            }, 50);
        } catch (error) {
            console.error("Error in enhanced parameter sync:", error);
        }
    };
}

/**
 * Sync UI elements with chart state
 */
function syncUIWithChartState(visibilityState) {
    try {
        // Map dataset indices to checkbox IDs
        const datasetToCheckbox = {
            0: 'showPh',
            1: 'showOrp',
            2: 'showFreeChlorine',
            3: 'showCombinedChlorine',
            4: 'showTurbidity',
            5: 'showTemp',
            6: 'showDosingEvents'
        };
        
        // Map dataset indices to button labels
        const datasetToButton = {
            0: 'pH',
            1: 'ORP',
            2: 'Free Chlorine',
            3: 'Combined Cl',
            4: 'Turbidity',
            5: 'Temperature'
        };
        
        // Update checkboxes
        Object.keys(datasetToCheckbox).forEach(datasetIndex => {
            const checkboxId = datasetToCheckbox[datasetIndex];
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                const isVisible = visibilityState[datasetIndex];
                checkbox.checked = isVisible;
            }
        });
        
        // Update buttons
        Object.keys(datasetToButton).forEach(datasetIndex => {
            const buttonText = datasetToButton[datasetIndex];
            if (buttonText) {
                const buttons = document.querySelectorAll('.btn-group .btn');
                buttons.forEach(button => {
                    if (button.textContent.trim() === buttonText) {
                        const isVisible = visibilityState[datasetIndex];
                        button.classList.toggle('active', isVisible);
                        button.classList.toggle('btn-primary', isVisible);
                        button.classList.toggle('btn-outline-secondary', !isVisible);
                    }
                });
            }
        });
        
        console.log("UI synchronized with chart state");
    } catch (error) {
        console.error("Error syncing UI with chart state:", error);
    }
}

/**
 * Improved dosing events toggle handler with retry mechanism
 */
function fixDosingEventsToggle() {
    const checkbox = document.getElementById('showDosingEvents');
    if (!checkbox) {
        console.warn("Dosing events checkbox not found");
        return;
    }
    
    // Remove any existing listeners by cloning
    const newCheckbox = checkbox.cloneNode(true);
    checkbox.parentNode.replaceChild(newCheckbox, checkbox);
    
    // Add enhanced handler with retry mechanism
    newCheckbox.addEventListener('change', function() {
        // Store the checked state for reference
        const isChecked = this.checked;
        
        // Try to toggle dosing events with retry
        const success = toggleDosingEventsWithRetry(isChecked);
        
        // If unsuccessful after retries, revert checkbox to match chart state
        if (!success && window.historyChart) {
            // Find dosing events dataset (index 6)
            const dosingDataset = window.historyChart.data.datasets[6];
            if (dosingDataset) {
                // Get actual visibility from chart
                const isActuallyVisible = !dosingDataset.hidden;
                // Update checkbox only if it doesn't match
                if (isChecked !== isActuallyVisible) {
                    this.checked = isActuallyVisible;
                }
            }
        }
    });
}

/**
 * Toggle dosing events visibility with retry mechanism
 */
function toggleDosingEventsWithRetry(checked, retries = 3, delay = 100) {
    console.log(`Attempting to toggle dosing events to ${checked ? 'visible' : 'hidden'}`);
    
    // Try to toggle immediately first
    if (toggleDosingEvents(checked)) {
        return true;
    }
    
    // If immediate toggle failed and we have retries left, try again after delay
    if (retries > 0) {
        console.log(`Retrying dosing events toggle... ${retries} attempts left`);
        setTimeout(() => {
            toggleDosingEventsWithRetry(checked, retries - 1, delay);
        }, delay);
    } else {
        console.warn("Failed to toggle dosing events after multiple attempts");
        return false;
    }
}

/**
 * Enhanced chart initialization to ensure dosing events toggle works
 */
function enhanceHistoryChartInit() {
    // Get original chart initialization function
    const originalInit = window.initializeHistoryChart;
    
    // Replace with enhanced version
    window.initializeHistoryChart = function() {
        // Call original initialization
        originalInit.apply(this, arguments);
        
        // Setup dosing events toggle after chart is initialized
        setTimeout(() => {
            fixDosingEventsToggle();
            
            // Also ensure dosing events visibility matches UI on init
            const checkbox = document.getElementById('showDosingEvents');
            if (checkbox && window.historyChart) {
                toggleDosingEvents(checkbox.checked);
            }
        }, 200); // Slightly longer delay to ensure chart is fully ready
    };
}

/**
 * Synchronize UI controls with current chart state
 */
function syncUIControlsWithState(hours, resolution, visualizationType) {
    // Sync time range selector
    const timeRangeSelect = document.getElementById('historyPresetRange');
    if (timeRangeSelect) {
        // Find the matching preset if possible, otherwise leave as is
        const commonPresets = [24, 48, 168, 720]; // Common hour values in the dropdown
        if (commonPresets.includes(hours) && timeRangeSelect.value !== hours.toString()) {
            timeRangeSelect.value = hours.toString();
        }
    }
    
    // Sync resolution selector
    const resolutionSelect = document.getElementById('dataResolution');
    if (resolutionSelect && resolution && resolutionSelect.value !== resolution) {
        // Only set if a valid option
        const validResolutions = Array.from(resolutionSelect.options).map(opt => opt.value);
        if (validResolutions.includes(resolution)) {
            resolutionSelect.value = resolution;
        }
    }
    
    // Sync visualization type
    const visualTypeSelect = document.getElementById('visualizationType');
    if (visualTypeSelect && visualizationType && visualTypeSelect.value !== visualizationType) {
        // Only set if a valid option
        const validTypes = Array.from(visualTypeSelect.options).map(opt => opt.value);
        if (validTypes.includes(visualizationType)) {
            visualTypeSelect.value = visualizationType;
        }
    }
}

/**
 * Set up enhanced event listeners for chart controls
 */
function setupEnhancedChartControls() {
    // Time range selection
    const historyPresetRange = document.getElementById('historyPresetRange');
    if (historyPresetRange) {
        // Add enhanced listener (keep existing one)
        historyPresetRange.addEventListener('change', function() {
            if (this.value !== 'custom') {
                // Get current state for other parameters
                const resolution = document.getElementById('dataResolution').value;
                const visualType = document.getElementById('visualizationType').value;
                
                // Update chart with all parameters
                updateHistoryChart(parseInt(this.value), resolution, visualType);
            }
        });
    }
    
    // Data resolution
    const dataResolution = document.getElementById('dataResolution');
    if (dataResolution) {
        // Add enhanced listener (keep existing one)
        dataResolution.addEventListener('change', function() {
            // Get current range 
            const rangeSelect = document.getElementById('historyPresetRange');
            const rangeValue = rangeSelect.value === 'custom' 
                ? getCustomRangeHours() 
                : parseInt(rangeSelect.value);
            
            // Get current visualization type
            const visualType = document.getElementById('visualizationType').value;
            
            // Update chart with all parameters
            updateHistoryChart(rangeValue, this.value, visualType);
        });
    }
    
    // Visualization type
    const visualizationType = document.getElementById('visualizationType');
    if (visualizationType) {
        // Add enhanced listener (keep existing one)
        visualizationType.addEventListener('change', function() {
            // Get current range and resolution
            const rangeSelect = document.getElementById('historyPresetRange');
            const rangeValue = rangeSelect.value === 'custom' 
                ? getCustomRangeHours() 
                : parseInt(rangeSelect.value);
            
            const resolution = document.getElementById('dataResolution').value;
            
            // Update chart with all parameters
            updateHistoryChart(rangeValue, resolution, this.value);
        });
    }
    
    // Refresh button - already properly handled in your code
}

/**
 * Get the number of hours in the custom date range
 */
function getCustomRangeHours() {
    try {
        const startDate = new Date(document.getElementById('historyStartDate').value);
        const endDate = new Date(document.getElementById('historyEndDate').value);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return 168; // Default to 7 days if dates are invalid
        }
        
        // Calculate hours between dates
        return Math.ceil((endDate - startDate) / (1000 * 60 * 60));
    } catch (error) {
        console.error("Error calculating custom range hours:", error);
        return 168; // Default to 7 days on error
    }
}