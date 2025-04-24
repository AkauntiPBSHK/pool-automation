// frontend/static/js/websocket.js

// Initialize socket connection with your existing Flask-SocketIO setup
let wsSocket = null;
window.socket = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectInterval = 3000; // 3 seconds
let lastHeartbeat = Date.now();

// Initialize WebSocket connection
function initializeWebSocket() {
    if (wsSocket) {
        console.log('WebSocket connection already exists');
        return;
    }

    console.log('Initializing WebSocket connection...');
    
    // Create a Socket.IO connection with better transport options
    wsSocket = io('http://127.0.0.1:5000', {
        transports: ['polling', 'websocket'],  // Start with polling FIRST, then upgrade
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 10,
        timeout: 20000,
        forceNew: true,
        path: '/socket.io/'
    });
    window.socket = wsSocket;

    // Add transport logging for debugging
    wsSocket.io.engine.on('transport', function(transport) {
        console.log('Transport established:', transport.name);
    });

    // Connection established
    wsSocket.on('connect', function() {
        console.log('WebSocket connected with transport:', wsSocket.io.engine.transport.name);
        showToast('Connected to server', 'success');
        updateConnectionStatus(true);
        lastHeartbeat = Date.now();
    });

    // Connection confirmation
    wsSocket.on('connection_confirmed', function(data) {
        console.log('Connection confirmed by server:', data);
    });

    // Parameter updates with safer implementation
    wsSocket.on('parameter_update', function(data) {
        try {
            handleParameterUpdate(data);
        } catch (error) {
            console.error('Error handling parameter update:', error);
        }
    });

    // Dosing updates
    wsSocket.on('dosing_update', function(data) {
        handleDosingUpdate(data);
    });

    // System events
    wsSocket.on('system_event', function(data) {
        handleSystemEvent(data);
    });

    socket.on('complete_system_state', function(data) {
        console.log('Received complete system state:', data);
        showToast('System data refreshed', 'success');
        
        try {
            // Update all UI elements with the complete state
            updateParameterDisplay('phValue', data.ph);
            updateParameterDisplay('orpValue', data.orp);
            updateParameterDisplay('freeChlorineValue', data.freeChlorine);
            updateParameterDisplay('combinedChlorineValue', data.combinedChlorine);
            updateParameterDisplay('turbidityValue', data.turbidity);
            updateParameterDisplay('tempValue', data.temperature);
            
            // Update detailed panels
            updateParameterDisplay('phDetailValue', data.ph);
            updateParameterDisplay('freeChlorineDetailValue', data.freeChlorine);
            updateParameterDisplay('combinedChlorineDetailValue', data.combinedChlorine);
            updateParameterDisplay('turbidityDetailValue', data.turbidity);
            
            // Update PAC dosing rate if available
            if (data.pacDosingRate !== undefined) {
                updateParameterDisplay('pacDosingRate', data.pacDosingRate);
            }
            
            // Update dosing mode
            const pacAutoSwitch = document.getElementById('pacAutoSwitch');
            if (pacAutoSwitch) {
                pacAutoSwitch.checked = (data.dosingMode === 'AUTOMATIC');
            }
            
            // Don't update pump status if we have active dosing sessions
            const activeSessions = window.activeDosingSessions || { ph: false, cl: false, pac: false };
            
            // Only update pump statuses if not in active sessions
            if (!activeSessions.ph && typeof window.updatePumpStatus === 'function') {
                window.updatePumpStatus('phPump', data.phPumpRunning);
                window.updatePumpStatus('phPumpDetail', data.phPumpRunning);
            }
            
            if (!activeSessions.cl && typeof window.updatePumpStatus === 'function') {
                window.updatePumpStatus('clPump', data.clPumpRunning);
                window.updatePumpStatus('clPumpDetail', data.clPumpRunning);
            }
            
            if (!activeSessions.pac && typeof window.updatePumpStatus === 'function') {
                window.updatePumpStatus('pacPump', data.pacPumpRunning);
                window.updatePumpStatus('pacPumpDetail', data.pacPumpRunning);
            }
        } catch (error) {
            console.error('Error updating UI from system state:', error);
        }
    });

    // Connection lost
    wsSocket.on('disconnect', function() {
        console.log('WebSocket connection lost');
        updateConnectionStatus(false);
        showToast('Connection lost. Attempting to reconnect...', 'warning');
    });

    // Add better error handling
    wsSocket.on('connect_error', function(error) {
        console.error('Connection error:', error);
        showToast('Connection error: ' + error.message, 'warning');
        
        if (wsSocket.io.reconnectionAttempts > 3) {
            console.warn('Multiple connection failures - switching to simulation mode');
            startSimulation();
        }
    });

    // Add heartbeat handler
    wsSocket.on('heartbeat', function() {
        lastHeartbeat = Date.now();
        console.log('Heartbeat received');
    });
    
    // Start heartbeat monitoring
    startHeartbeatMonitor();
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
    
    // Also update the status bar
    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
        if (connected) {
            statusBar.className = 'alert alert-success';
            statusBar.textContent = 'Connected to server';
        } else {
            statusBar.className = 'alert alert-danger';
            statusBar.textContent = 'Disconnected from server. Using simulation mode.';
        }
    }
}

// Request current parameters from server
function requestParameters() {
    if (wsSocket && wsSocket.connected) {
        wsSocket.emit('request_params');
    }
}

// Handle parameter update with better error handling
function handleParameterUpdate(data) {
    // Update other parameters as normal
    updateParameterDisplay('phValue', data.ph);
    updateParameterDisplay('orpValue', data.orp);
    updateParameterDisplay('freeChlorineValue', data.freeChlorine);
    updateParameterDisplay('combinedChlorineValue', data.combinedChlorine);
    updateParameterDisplay('turbidityValue', data.turbidity);
    updateParameterDisplay('tempValue', data.temperature);
    
    // Also update detailed values
    updateParameterDisplay('phDetailValue', data.ph);
    updateParameterDisplay('freeChlorineDetailValue', data.freeChlorine);
    updateParameterDisplay('combinedChlorineDetailValue', data.combinedChlorine);
    updateParameterDisplay('turbidityDetailValue', data.turbidity);
    
    // PAC dosing rate if available
    if (data.pacDosingRate !== undefined) {
        updateParameterDisplay('pacDosingRate', data.pacDosingRate);
    }
    
    // Only update pump statuses if not in active sessions
    const activeSessions = window.activeDosingSessions || { ph: false, cl: false, pac: false };
    
    if (data.phPumpRunning !== undefined && !activeSessions.ph && typeof window.updatePumpStatus === 'function') {
        window.updatePumpStatus('phPump', data.phPumpRunning);
        window.updatePumpStatus('phPumpDetail', data.phPumpRunning);
    }
    
    if (data.clPumpRunning !== undefined && !activeSessions.cl && typeof window.updatePumpStatus === 'function') {
        window.updatePumpStatus('clPump', data.clPumpRunning);
        window.updatePumpStatus('clPumpDetail', data.clPumpRunning);
    }
    
    if (data.pacPumpRunning !== undefined && !activeSessions.pac && typeof window.updatePumpStatus === 'function') {
        window.updatePumpStatus('pacPump', data.pacPumpRunning);
        window.updatePumpStatus('pacPumpDetail', data.pacPumpRunning);
    }
    
    // Update charts if available and initialized
    if (window.updateChartData && typeof window.updateChartData === 'function') {
        try {
            window.updateChartData(data);
        } catch (error) {
            console.error('Error updating charts:', error);
        }
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
    console.log('Initializing WebSocket features...');
    
    // Create a hidden element for event-history if it doesn't exist
    if (!document.getElementById('event-history')) {
        const hiddenEventHistory = document.createElement('div');
        hiddenEventHistory.id = 'event-history';
        hiddenEventHistory.style.display = 'none';
        document.body.appendChild(hiddenEventHistory);
    }
    
    // Initialize WebSocket connection
    initializeWebSocket();
    
    // Setup controls for PAC auto/manual switching
    setupPacAutoSwitch();
    
    // Log initialization
    console.log('WebSocket features initialized');
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

// Add heartbeat monitoring system
const MAX_HEARTBEAT_DELAY = 10000; // 10 seconds

function startHeartbeatMonitor() {
    // Check heartbeat periodically
    const heartbeatInterval = setInterval(function() {
        const now = Date.now();
        if (socket && socket.connected) {
            // If we haven't received a heartbeat recently, request one
            if (now - lastHeartbeat > MAX_HEARTBEAT_DELAY) {
                console.warn('Heartbeat missed, connection may be stale');
                socket.emit('request_heartbeat');
                
                // If still no response after another 5 seconds, reconnect
                setTimeout(function() {
                    if (now - lastHeartbeat > MAX_HEARTBEAT_DELAY) {
                        showToast('Connection appears stale, reconnecting...', 'warning');
                        socket.disconnect().connect(); 
                    }
                }, 5000);
            }
        }
    }, 5000);
    
    // Store interval ID for cleanup if needed
    window.heartbeatInterval = heartbeatInterval;
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