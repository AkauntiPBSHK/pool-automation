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
    pacPumpRunning: false
};

// Connect to Socket.IO
const socket = io();

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    // Setup event listeners
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