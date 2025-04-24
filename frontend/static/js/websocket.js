// frontend/static/js/websocket.js

// Initialize socket connection with your existing Flask-SocketIO setup
let wsSocket = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectInterval = 3000; // 3 seconds

// Initialize WebSocket connection
function initializeWebSocket() {
    if (wsSocket) {
        console.log('WebSocket connection already exists');
        return;
    }

    console.log('Initializing WebSocket connection...');
    
    // Create a Socket.IO connection to the server
    wsSocket = io();

    // Connection established
    wsSocket.on('connect', function() {
        console.log('WebSocket connection established');
        reconnectAttempts = 0;
        
        // Update UI connection status
        showToast('Connected to server', 'success');
        updateConnectionStatus(true);
    });

    // Connection confirmation
    wsSocket.on('connection_confirmed', function(data) {
        console.log('Connection confirmed by server:', data);
    });

    // Parameter updates
    wsSocket.on('parameter_update', function(data) {
        handleParameterUpdate(data);
    });

    // Dosing updates
    wsSocket.on('dosing_update', function(data) {
        handleDosingUpdate(data);
    });

    // System events
    wsSocket.on('system_event', function(data) {
        handleSystemEvent(data);
    });

    // Connection lost
    wsSocket.on('disconnect', function() {
        console.log('WebSocket connection lost');
        updateConnectionStatus(false);
        
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = reconnectInterval * reconnectAttempts;
            
            console.log(`Attempting to reconnect in ${delay/1000} seconds...`);
            setTimeout(initializeWebSocket, delay);
            
            showToast(`Connection lost. Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`, 'warning');
        } else {
            showToast('Connection lost. Please refresh the page.', 'error');
        }
    });

    // Error handling
    wsSocket.on('error', function(error) {
        console.error('WebSocket error:', error);
    });
}

// Update connection status indicator in UI
function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connection-status');
    if (statusIndicator) {
        if (connected) {
            statusIndicator.classList.remove('status-disconnected');
            statusIndicator.classList.add('status-connected');
            statusIndicator.title = 'Connected to server';
        } else {
            statusIndicator.classList.remove('status-connected');
            statusIndicator.classList.add('status-disconnected');
            statusIndicator.title = 'Disconnected from server';
        }
    }
}

// Request current parameters from server
function requestParameters() {
    if (wsSocket && wsSocket.connected) {
        wsSocket.emit('request_params');
    }
}

// Handle parameter update message
function handleParameterUpdate(data) {
    // Update UI with new parameter values - using your HTML element IDs
    updateParameterDisplay('phValue', data.ph);
    updateParameterDisplay('orpValue', data.orp);
    updateParameterDisplay('freeChlorineValue', data.freeChlorine);
    updateParameterDisplay('combinedChlorineValue', data.combinedChlorine);
    updateParameterDisplay('turbidityValue', data.turbidity);
    updateParameterDisplay('tempValue', data.temperature);
    
    // Also update detailed values if they exist
    updateParameterDisplay('phDetailValue', data.ph);
    updateParameterDisplay('freeChlorineDetailValue', data.freeChlorine);
    updateParameterDisplay('combinedChlorineDetailValue', data.combinedChlorine);
    updateParameterDisplay('turbidityDetailValue', data.turbidity);
    
    // Update pump status indicators
    updatePumpStatus('phPumpStatus', data.phPumpRunning);
    updatePumpStatus('clPumpStatus', data.clPumpRunning);
    updatePumpStatus('pacPumpStatus', data.pacPumpRunning);
    
    // Also update detailed pump statuses if they exist
    updatePumpStatus('phPumpDetailStatus', data.phPumpRunning);
    updatePumpStatus('clPumpDetailStatus', data.clPumpRunning);
    updatePumpStatus('pacPumpDetailStatus', data.pacPumpRunning);
    
    // Update dosing mode UI elements
    if (data.dosingMode) {
        // Update pacAutoSwitch checkbox based on mode (UI update only)
        const pacAutoSwitch = document.getElementById('pacAutoSwitch');
        if (pacAutoSwitch) {
            pacAutoSwitch.checked = (data.dosingMode === 'AUTOMATIC');
        }
        
        // Update dosing mode display
        const dosingModeElement = document.getElementById('dosing-mode');
        if (dosingModeElement) {
            dosingModeElement.textContent = data.dosingMode;
            dosingModeElement.className = 'dosing-mode';
            dosingModeElement.classList.add(`mode-${data.dosingMode.toLowerCase()}`);
        }
        
        // Update mode selector if it exists
        const modeSelector = document.getElementById('dosing-mode-select');
        if (modeSelector) {
            modeSelector.value = data.dosingMode;
        }
        
        // Show/hide manual dosing controls based on mode
        const manualControls = document.getElementById('manual-dosing-controls');
        if (manualControls) {
            if (data.dosingMode === 'MANUAL') {
                manualControls.classList.remove('hidden');
            } else {
                manualControls.classList.add('hidden');
            }
        }
    }
    
    // Update PAC flow rate if available
    if (data.pacDosingRate !== undefined) {
        updateParameterDisplay('pacDosingRate', data.pacDosingRate);
    }
    
    // Update charts if the function exists
    if (typeof updateChartData === 'function') {
        updateChartData(data);
    }
}

// Handle dosing update message
function handleDosingUpdate(data) {
    // Update dosing mode
    updateDosingMode(data.mode);
    
    // Show notification based on event type
    switch (data.event) {
        case 'mode_changed':
            showToast(`Dosing mode changed to ${data.mode}`, 'info');
            break;
        case 'manual_dose_started':
            showToast(`Manual dosing started (${data.duration}s, ${data.flow_rate} mL/h)`, 'info');
            break;
        case 'auto_dose_started':
            showToast(`Automatic dosing started (turbidity: ${data.status.current_turbidity} NTU)`, 'info');
            break;
        case 'dose_completed':
            showToast('Dosing completed', 'success');
            break;
    }
    
    // Update manual dosing controls if the function exists
    if (typeof updateDosingControls === 'function') {
        updateDosingControls(data.mode);
    }
}

// Handle system event message
function handleSystemEvent(data) {
    // Log the event
    console.log('System event:', data);
    
    // Show notification for the event
    showToast(data.description, 'info');
    
    // Add event to history list if the function exists
    if (typeof addEventToHistory === 'function') {
        addEventToHistory(data);
    }
}

// Update parameter display in UI
function updateParameterDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = typeof value === 'number' ? value.toFixed(2) : value;
        
        // Check if element has thresholds for color-coding
        if (element.dataset.min && element.dataset.max) {
            const min = parseFloat(element.dataset.min);
            const max = parseFloat(element.dataset.max);
            
            if (value < min || value > max) {
                element.classList.add('value-warning');
            } else {
                element.classList.remove('value-warning');
            }
        }
    }
}

// Updated updatePumpStatus function to match your HTML structure
function updatePumpStatus(elementId, isRunning) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (isRunning) {
        element.innerHTML = '<i class="bi bi-droplet-fill me-1"></i> Pump active';
        element.className = 'text-primary';
    } else {
        element.innerHTML = '<i class="bi bi-droplet me-1"></i> Pump inactive';
        element.className = 'text-secondary';
    }
}

// Update dosing mode indicator in UI
function updateDosingMode(mode) {
    const element = document.getElementById('dosing-mode');
    if (element) {
        element.textContent = mode;
        
        // Update class for styling
        element.className = 'dosing-mode';
        element.classList.add(`mode-${mode.toLowerCase()}`);
    }
    
    // Update mode selector if it exists
    const modeSelector = document.getElementById('dosing-mode-select');
    if (modeSelector) {
        modeSelector.value = mode;
    }
    
    // Update UI elements based on mode
    if (typeof updateDosingControls === 'function') {
        updateDosingControls(mode);
    }
}

// Update dosing controls based on mode (implement or modify this based on your UI)
function updateDosingControls(mode) {
    const manualControls = document.getElementById('manual-dosing-controls');
    
    if (manualControls) {
        if (mode === 'MANUAL') {
            manualControls.classList.remove('hidden');
        } else {
            manualControls.classList.add('hidden');
        }
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// Updated function to add event to history
function addEventToHistory(event) {
    // Get events table body
    const eventsTableBody = document.querySelector('#eventsTable tbody');
    if (!eventsTableBody) return;
    
    // Format timestamp
    const timestamp = new Date(event.timestamp * 1000).toLocaleString();
    
    // Create a new table row
    const row = document.createElement('tr');
    
    // Determine badge class based on event type
    let badgeClass = 'bg-info';
    let eventTypeDisplay = 'System';
    
    if (event.event.includes('dose')) {
        badgeClass = 'bg-success';
        eventTypeDisplay = 'Dosing';
    } else if (event.event.includes('alert') || event.event.includes('warning')) {
        badgeClass = 'bg-warning';
        eventTypeDisplay = 'Alert';
    } else if (event.event.includes('error')) {
        badgeClass = 'bg-danger';
        eventTypeDisplay = 'Error';
    }
    
    // Create row content
    row.innerHTML = `
        <td>${timestamp}</td>
        <td><span class="badge ${badgeClass}">${eventTypeDisplay}</span></td>
        <td>${event.description}</td>
        <td>${event.parameter || '-'}</td>
        <td>${event.value || '-'}</td>
    `;
    
    // Add to the beginning of the table
    if (eventsTableBody.firstChild) {
        eventsTableBody.insertBefore(row, eventsTableBody.firstChild);
    } else {
        eventsTableBody.appendChild(row);
    }
    
    // Limit number of displayed rows
    const maxRows = 50;
    while (eventsTableBody.children.length > maxRows) {
        eventsTableBody.removeChild(eventsTableBody.lastChild);
    }
}

// Initialize all WebSocket features
function initializeWebSocketFeatures() {
    // Create a hidden element for event-history if it doesn't exist
    if (!document.getElementById('event-history')) {
        const hiddenEventHistory = document.createElement('div');
        hiddenEventHistory.id = 'event-history';
        hiddenEventHistory.style.display = 'none';
        document.body.appendChild(hiddenEventHistory);
    }
    
    // Initialize WebSocket connection
    initializeWebSocket();
    
    // Set up event listeners for dosing controls
    setupDosingControls();
    
    // Setup controls for PAC auto/manual switching
    setupPacAutoSwitch();
}

// Setup pacAutoSwitch event listener (separate function)
function setupPacAutoSwitch() {
    const pacAutoSwitch = document.getElementById('pacAutoSwitch');
    if (pacAutoSwitch) {
        pacAutoSwitch.addEventListener('change', function() {
            // Call the API to change dosing mode based on checkbox state
            const newMode = this.checked ? 'AUTOMATIC' : 'MANUAL';
            fetch('/api/dosing/mode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mode: newMode })
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    // Reset checkbox if change failed
                    this.checked = !this.checked;
                    showToast(`Failed to change dosing mode: ${data.error}`, 'error');
                }
            })
            .catch(error => {
                // Reset checkbox on error
                this.checked = !this.checked;
                console.error('Error changing dosing mode:', error);
                showToast('Error changing dosing mode', 'error');
            });
        });
    }
}

// Set up dosing control event listeners
function setupDosingControls() {
    // Dosing mode selector
    const modeSelector = document.getElementById('dosing-mode-select');
    if (modeSelector) {
        modeSelector.addEventListener('change', function() {
            const newMode = this.value;
            
            // Send mode change request to server
            fetch('/api/dosing/mode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mode: newMode })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast(`Dosing mode changed to ${newMode}`, 'success');
                } else {
                    showToast(`Failed to change dosing mode: ${data.error}`, 'error');
                    // Reset selector to current mode
                    this.value = document.getElementById('dosing-mode').textContent;
                }
            })
            .catch(error => {
                console.error('Error changing dosing mode:', error);
                showToast('Error changing dosing mode', 'error');
                // Reset selector to current mode
                this.value = document.getElementById('dosing-mode').textContent;
            });
        });
    }
    
    // Manual dosing form
    const manualDosingForm = document.getElementById('manual-dosing-form');
    if (manualDosingForm) {
        manualDosingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form values
            const duration = parseInt(document.getElementById('dosing-duration').value) || 30;
            const flowRate = parseFloat(document.getElementById('dosing-flow-rate').value) || 100;
            
            // Send manual dosing request to server
            fetch('/api/dosing/manual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    duration: duration,
                    flow_rate: flowRate
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast(`Manual dosing started (${duration}s, ${flowRate} mL/h)`, 'success');
                } else {
                    showToast(`Failed to start manual dosing: ${data.message}`, 'error');
                }
            })
            .catch(error => {
                console.error('Error starting manual dosing:', error);
                showToast('Error starting manual dosing', 'error');
            });
        });
    }
}

// Export functions for use in dashboard.js
window.WebSocketManager = {
    initializeWebSocketFeatures,
    initializeWebSocket,
    requestParameters,
    showToast,
    updateConnectionStatus,
    setupPacAutoSwitch
};