#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Pool Automation System - Main API Application
"""

import os
import json
import logging
import random
import time
import math
import threading
from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from backend.models.database import DatabaseHandler
from backend.utils.enhanced_simulator import EnhancedPoolSimulator
from backend.hardware.sensors.mock import MockTurbiditySensor
from backend.hardware.actuators.mock import MockPump
from backend.hardware.controllers.advanced_dosing import AdvancedDosingController, DosingMode

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask application
app = Flask(__name__, 
    static_folder='../../frontend/static',
    template_folder='../../frontend/templates'
)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key')
CORS(app)  # Enable CORS for all routes

async_mode = None  # Let Flask-SocketIO choose the best async mode

# Update your Socket.IO configuration to use polling only
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    transports=["polling"]    # Only allow polling transport
)

# Load configuration
def load_config():
    env = os.getenv('FLASK_ENV', 'development')

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    config_path = os.path.join(project_root, 'config', env, 'config.json')

    try:
        with open(config_path, 'r') as f:
            logger.info(f"Loading configuration from {config_path}")
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        # Return default configuration
        return {
            "system": {"simulation_mode": True},
            "dosing": {
                "high_threshold_ntu": 0.25,
                "low_threshold_ntu": 0.12,
                "target_ntu": 0.15
            }
        }

config = load_config()
# Create a global instance of the system simulator
simulator = EnhancedPoolSimulator(config.get('simulator', {}))

# Create mock hardware using the simulator
mock_turbidity_sensor = MockTurbiditySensor(config.get('hardware', {}).get('turbidity_sensor', {}), simulator)
mock_pac_pump = MockPump({'type': 'pac', **config.get('hardware', {}).get('pac_pump', {})}, simulator)

# Create an event logger function
def log_dosing_event(event_type, duration, flow_rate, turbidity):
    db = DatabaseHandler()
    db.log_dosing_event(event_type, duration, flow_rate, turbidity)
    logger.info(f"Dosing event logged: {event_type}, {duration}s, {flow_rate}ml/h, {turbidity}NTU")

def send_status_update():
    """Send current system status to all connected clients."""
    if not simulator:
        return
    
    params = simulator.get_all_parameters()
    pump_states = simulator.get_pump_states()
    
    # Get more detailed status information from the advanced controller
    dosing_status = dosing_controller.get_status()
    
    # Create a more comprehensive status update
    status_data = {
        "ph": round(params['ph'], 2),
        "orp": round(params['orp']),
        "freeChlorine": round(params['free_chlorine'], 2),
        "combinedChlorine": round(params['combined_chlorine'], 2),
        "turbidity": round(params['turbidity'], 3),
        "temperature": round(params['temperature'], 1),
        "phPumpRunning": pump_states.get('acid', False),
        "clPumpRunning": pump_states.get('chlorine', False),
        "pacPumpRunning": pump_states.get('pac', False),
        "pacDosingRate": mock_pac_pump.get_flow_rate(),
        "dosingMode": dosing_status['mode'],  # Use values from dosing_status
        "timestamp": time.time(),
        "turbidityLimits": {
            "highThreshold": dosing_status['high_threshold'],
            "lowThreshold": dosing_status['low_threshold'],
            "target": dosing_status['target']
        },
        # Include more detailed dosing controller status
        "dosingController": {
            "lastDoseTime": dosing_status['last_dose_time'],
            "doseCounter": dosing_status['dose_counter'],
            "pumpRunning": dosing_status['pump_status'],
            "pidLastError": dosing_controller.pid.last_error if hasattr(dosing_controller, 'pid') else 0,
            "pidIntegral": dosing_controller.pid.integral if hasattr(dosing_controller, 'pid') else 0
        }
    }
    
    socketio.emit('parameter_update', status_data)

# Add these functions for emitting dosing and system events
def emit_dosing_update(event_type, details=None):
    """Emit dosing controller update to all clients."""
    if not dosing_controller:
        return
    
    status = dosing_controller.get_status()
    
    data = {
        'event': event_type,
        'mode': dosing_controller.mode.name,
        'status': status
    }
    
    if details:
        data.update(details)
    
    socketio.emit('dosing_update', data)

def emit_system_event(event_type, description, parameter=None, value=None):
    """Emit system event to all clients."""
    data = {
        'event': event_type,
        'description': description,
        'timestamp': time.time()
    }
    
    if parameter:
        data['parameter'] = parameter
    
    if value:
        data['value'] = value
    
    socketio.emit('system_event', data)

# Modify your start_background_tasks function
def start_background_tasks():
    """Start background tasks for real-time updates."""
    def send_updates():
        while True:
            try:
                send_status_update()
                time.sleep(2)  # Update every 2 seconds
            except Exception as e:
                logger.error(f"Error in update task: {e}")
                time.sleep(5)  # Delay on error
    
    thread = threading.Thread(target=send_updates, daemon=True)
    thread.start()
    logger.info("Background tasks started")

# Call this after initializing the Flask app
start_background_tasks()

# Initialize the dosing controller with the simulator components
dosing_controller = AdvancedDosingController(
    mock_turbidity_sensor, 
    mock_pac_pump,
    config.get('dosing', {
        'high_threshold_ntu': 0.25,
        'low_threshold_ntu': 0.12,
        'target_ntu': 0.15,
        'min_dose_interval_sec': 300,
        'dose_duration_sec': 30,
        # Add PID controller settings
        'pid_kp': 1.0,
        'pid_ki': 0.1,
        'pid_kd': 0.05
    }),
    log_dosing_event
)

# Start the controller in automatic mode
dosing_controller.start(DosingMode.AUTOMATIC)

# Simulated data generator
def get_simulated_data():
    """Generate simulated sensor data in camelCase format for the frontend"""
    return {
        "turbidity": {
            "current": round(random.uniform(0.05, 0.35), 3),
            "average": round(random.uniform(0.10, 0.25), 3),
            "highThreshold": 0.25,
            "lowThreshold": 0.12,
            "target": 0.15,
            "pumpStatus": "stopped"
        },
        "ph": round(random.uniform(7.0, 7.4), 1),
        "orp": int(random.uniform(650, 750)),
        "freeChlorine": round(random.uniform(0.8, 1.2), 2),
        "combinedChlorine": round(random.uniform(0.1, 0.3), 1),  # Note: using camelCase here
        "temperature": round(random.uniform(26.0, 29.0), 1),
        "systemStatus": {
            "running": True,
            "simulation": True,
            "lastUpdate": time.time()
        }
    }

# Routes
@app.route('/')
def index():
    """Render the main dashboard page."""
    return render_template('index.html')

@app.route('/api/status')
def status():
    """Get the current system status."""
    simulation_mode = config.get('system', {}).get('simulation_mode', True)
    return jsonify({
        "status": "ok",
        "simulation_mode": simulation_mode,
        "version": "0.1.0"
    })

@app.route('/socket-status')
def socket_status():
    """Simple Socket.IO status check"""
    return jsonify({
        "status": "Socket.IO server running",
        "transport": "polling-only mode"
    })

# Add these API endpoints
@app.route('/api/dashboard')
def dashboard_data():
    """Get all dashboard data for the frontend."""
    if simulator:
        # Get data from the simulator
        params = simulator.get_all_parameters()
        pump_states = simulator.get_pump_states()
        
        return jsonify({
            "ph": round(params['ph'], 1),
            "orp": round(params['orp']),
            "freeChlorine": round(params['free_chlorine'], 2),
            "combinedChlorine": round(params['combined_chlorine'], 1),
            "turbidity": round(params['turbidity'], 3),
            "temperature": round(params['temperature'], 1),
            "uvIntensity": 94,  # Fixed value for now
            "phPumpRunning": pump_states.get('acid', False),
            "clPumpRunning": pump_states.get('chlorine', False),
            "pacPumpRunning": pump_states.get('pac', False),
            "pacDosingRate": mock_pac_pump.get_flow_rate()
        })
    else:
        # Fallback to random data
        return jsonify({
            "ph": round(random.uniform(7.2, 7.6), 1),
            "orp": random.randint(680, 760),
            "freeChlorine": round(random.uniform(1.0, 1.4), 2),
            "combinedChlorine": round(random.uniform(0.1, 0.3), 1),
            "turbidity": round(random.uniform(0.12, 0.18), 3),
            "temperature": round(random.uniform(27.0, 29.0), 1),
            "uvIntensity": random.randint(90, 96),
            "phPumpRunning": False,
            "clPumpRunning": False,
            "pacPumpRunning": False,
            "pacDosingRate": 75
        })
    
# Update your control_pac_pump endpoint to use emit_system_event
@app.route('/api/pumps/pac', methods=['POST'])
def control_pac_pump():
    """Control the PAC dosing pump."""
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    data = request.json
    command = data.get('command')
    
    if command == 'start':
        duration = data.get('duration', 30)
        flow_rate = data.get('flow_rate')
        
        if flow_rate:
            mock_pac_pump.set_flow_rate(flow_rate)
        
        success = mock_pac_pump.start(duration=duration)
        
        # Emit system event
        emit_system_event('pac_pump_started', 
                         f"PAC pump started manually for {duration}s at {mock_pac_pump.get_flow_rate()} mL/h")
        
        return jsonify({
            "success": success,
            "message": f"PAC pump started for {duration} seconds at {mock_pac_pump.get_flow_rate()} ml/h"
        })
    
    elif command == 'stop':
        success = mock_pac_pump.stop()
        
        # Emit system event
        emit_system_event('pac_pump_stopped', "PAC pump stopped manually")
        
        return jsonify({
            "success": success,
            "message": "PAC pump stopped"
        })
    
    elif command == 'set_rate':
        flow_rate = data.get('flow_rate')
        if not flow_rate:
            return jsonify({"error": "Missing flow_rate parameter"}), 400
        
        success = mock_pac_pump.set_flow_rate(flow_rate)
        
        # Emit system event
        emit_system_event('pac_flow_rate_changed', f"PAC pump flow rate set to {flow_rate} mL/h")
        
        return jsonify({
            "success": success,
            "message": f"PAC pump flow rate set to {flow_rate} ml/h"
        })
    
    else:
        return jsonify({"error": "Invalid command"}), 400
    
@app.route('/api/simulator/control', methods=['POST'])
def control_simulator():
    """Control the system simulator."""
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    data = request.json
    command = data.get('command')
    
    if command == 'set_parameter':
        param = data.get('parameter')
        value = data.get('value')
        
        if not param or value is None:
            return jsonify({"error": "Missing parameter or value"}), 400
        
        # Update the parameter in the simulator
        simulator.parameters[param] = float(value)
        
        return jsonify({
            "success": True,
            "message": f"Parameter {param} set to {value}"
        })
    
    elif command == 'set_time_scale':
        time_scale = data.get('time_scale')
        
        if not time_scale:
            return jsonify({"error": "Missing time_scale parameter"}), 400
        
        simulator.time_scale = float(time_scale)
        
        return jsonify({
            "success": True,
            "message": f"Time scale set to {time_scale}x"
        })
    
    else:
        return jsonify({"error": "Invalid command"}), 400

@app.route('/api/history/turbidity')
def turbidity_history():
    """Get historical turbidity data for charts."""
    hours = request.args.get('hours', default=24, type=int)
    db = DatabaseHandler()
    data = db.get_turbidity_history(hours)
    
    # Format for frontend charts
    timestamps = [entry['timestamp'] for entry in data]
    values = [entry['value'] for entry in data]
    moving_avg = [entry['moving_avg'] for entry in data if entry['moving_avg'] is not None]
    
    return jsonify({
        "timestamps": timestamps,
        "values": values,
        "moving_avg": moving_avg
    })

@app.route('/api/history/parameters')
def parameter_history():
    """Get historical data for multiple parameters."""
    hours = request.args.get('hours', default=24, type=int)
    db = DatabaseHandler()
    
    # Get Steiel data (pH, ORP, chlorine)
    steiel_data = db.get_steiel_history(hours)
    
    # Format for frontend charts
    timestamps = [entry['timestamp'] for entry in steiel_data]
    
    ph_values = [entry['ph'] for entry in steiel_data]
    orp_values = [entry['orp'] for entry in steiel_data]
    free_cl_values = [entry['free_cl'] for entry in steiel_data]
    comb_cl_values = [entry['comb_cl'] for entry in steiel_data]
    
    return jsonify({
        "timestamps": timestamps,
        "parameters": {
            "ph": ph_values,
            "orp": orp_values,
            "freeChlorine": free_cl_values,
            "combinedChlorine": comb_cl_values
        }
    })

@app.route('/api/history/events')
def events_history():
    """Get system and dosing events history."""
    hours = request.args.get('hours', default=24, type=int)
    event_type = request.args.get('type', default=None)
    db = DatabaseHandler()
    
    # Get dosing events
    dosing_events = db.get_dosing_events(hours)
    
    # Format events for frontend
    events = []
    for event in dosing_events:
        formatted_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(event['timestamp']))
        events.append({
            "timestamp": formatted_time,
            "type": "Dosing",
            "description": f"{event['event_type']} dosing",
            "parameter": "Turbidity",
            "value": f"{event['turbidity']:.3f} NTU"
        })
    
    return jsonify(events)

@app.route('/api/dosing/status')
def dosing_status():
    """Get the current status of the dosing controller."""
    return jsonify(dosing_controller.get_status())

# Update your set_dosing_mode endpoint to use the emit_dosing_update function
@app.route('/api/dosing/mode', methods=['POST'])
def set_dosing_mode():
    """Set the dosing controller mode."""
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    data = request.json
    mode_str = data.get('mode', '').upper()
    
    try:
        mode = DosingMode[mode_str]
    except (KeyError, ValueError):
        return jsonify({"error": f"Invalid mode: {mode_str}"}), 400
    
    dosing_controller.set_mode(mode)
    
    # Use the new emit function instead of direct socketio.emit
    emit_dosing_update('mode_changed')
    
    # Log the event
    emit_system_event('dosing_mode_changed', f"Dosing mode changed to {mode_str}")
    
    return jsonify({"success": True, "mode": mode_str})

# Add health check route for Socket.IO
@app.route('/socket.io-test')
def socket_io_test():
    return jsonify({"status": "Socket.IO server is running", 
                    "async_mode": socketio.async_mode})

# Update your manual_dosing endpoint to use the emit functions
@app.route('/api/dosing/manual', methods=['POST'])
def manual_dosing():
    """Trigger manual dosing."""
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    data = request.json
    duration = data.get('duration', 30)  # Default to 30 seconds if not specified
    flow_rate = data.get('flow_rate')
    
    success = dosing_controller.manual_dose(duration, flow_rate)
    
    if success:
        # Get current turbidity for the event
        current_turbidity = mock_turbidity_sensor.get_reading()
        
        # Emit dosing update
        emit_dosing_update('manual_dose_started', {
            'duration': duration,
            'flow_rate': mock_pac_pump.get_flow_rate()
        })
        
        # Emit system event
        event_desc = f"Manual dosing started (duration: {duration}s, flow rate: {mock_pac_pump.get_flow_rate()} mL/h)"
        emit_system_event('manual_dose_started', event_desc, 'turbidity', str(current_turbidity))
        
        return jsonify({
            "success": True, 
            "message": f"Manual dosing started for {duration} seconds"
        })
    else:
        return jsonify({
            "success": False, 
            "message": "Manual dosing failed. Controller must be in MANUAL mode."
        }), 400
    
@app.route('/api/dosing/reset-pid', methods=['POST'])
def reset_pid():
    """Reset the PID controller."""
    if dosing_controller:
        success = dosing_controller.reset_pid()
        emit_system_event('pid_reset', "PID controller reset")
        return jsonify({"success": success})
    return jsonify({"error": "Dosing controller not initialized"}), 500

# Add a simpler debugging route without version references
@app.route('/socket-debug')
def socket_debug():
    """Debugging info for Socket.IO configuration"""
    # Log headers for debugging
    headers = dict(request.headers)
    
    # Return configuration and headers without version info
    return jsonify({
        "socket_config": {
            "transports": socketio.eio.transports if hasattr(socketio, 'eio') else "Unknown",
            "cors_allowed_origins": socketio.cors_allowed_origins if hasattr(socketio, 'cors_allowed_origins') else "Unknown",
            "async_mode": socketio.async_mode if hasattr(socketio, 'async_mode') else "Unknown"
        },
        "request_headers": headers,
        "server_info": {
            "flask_version": app.version if hasattr(app, 'version') else "Unknown"
        }
    })

@app.route('/api/init')
def initialize_database():
    """Initialize the database with sample data (for development)."""
    try:
        db = DatabaseHandler()
        
        # Generate historical data using the system simulator
        days = 7  # Generate a week of data
        hours_per_day = 24
        samples_per_hour = 12  # Every 5 minutes
        
        logger.info(f"Generating {days} days of simulated data")
        
        # Save current simulator state to restore later
        original_params = simulator.parameters.copy()
        original_time_scale = simulator.time_scale
        
        # Use accelerated time for data generation
        simulator.time_scale = 1.0
        
        current_time = time.time() - (days * 24 * 3600)  # Start from days ago
        sample_interval = 3600 / samples_per_hour  # Seconds between samples
        
        # Generate data points
        for day in range(days):
            for hour in range(hours_per_day):
                for sample in range(samples_per_hour):
                    # Calculate timestamp for this sample
                    sample_time = current_time + ((day * 24 + hour) * 3600 + sample * sample_interval)
                    
                    # Simulate parameter values based on time of day patterns
                    time_of_day = hour / 24.0
                    day_factor = math.sin((time_of_day - 0.25) * 2 * math.pi)
                    
                    # Set parameters with realistic daily patterns
                    simulator.parameters['turbidity'] = 0.15 + day_factor * 0.02 + random.uniform(-0.02, 0.02)
                    simulator.parameters['ph'] = 7.4 + day_factor * 0.1 + random.uniform(-0.1, 0.1)
                    simulator.parameters['orp'] = 720 + day_factor * 10 + random.uniform(-10, 10)
                    simulator.parameters['free_chlorine'] = 1.2 + day_factor * 0.1 + random.uniform(-0.1, 0.1)
                    simulator.parameters['combined_chlorine'] = 0.2 + day_factor * 0.05 + random.uniform(-0.05, 0.05)
                    simulator.parameters['temperature'] = 28.0 + day_factor * 0.5 + random.uniform(-0.2, 0.2)
                    
                    # Keep values within realistic bounds
                    simulator._apply_constraints()
                    
                    # Calculate moving average for turbidity
                    moving_avg = simulator.parameters['turbidity'] - random.uniform(-0.01, 0.01)
                    
                    # Log to database with the simulated timestamp
                    db.log_turbidity(simulator.parameters['turbidity'], moving_avg)
                    db.log_steiel_readings(
                        simulator.parameters['ph'],
                        simulator.parameters['orp'],
                        simulator.parameters['free_chlorine'],
                        simulator.parameters['combined_chlorine']
                    )
                    
                    # Occasionally generate dosing events (when turbidity gets high)
                    if simulator.parameters['turbidity'] > 0.20 and random.random() < 0.2:
                        duration = random.choice([30, 60, 120])
                        flow_rate = random.uniform(60, 150)
                        db.log_dosing_event("PAC", duration, flow_rate, simulator.parameters['turbidity'])
                        
                        # After dosing, turbidity should decrease
                        simulator.parameters['turbidity'] = max(0.12, simulator.parameters['turbidity'] - 0.02)
        
        # Restore original simulator state
        simulator.parameters = original_params
        simulator.time_scale = original_time_scale
        
        return jsonify({"success": True, "message": f"Database initialized with {days} days of sample data"})
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    
# Add to app.py
@app.route('/api/notifications/settings', methods=['POST'])
def update_notification_settings():
    """Update notification settings."""
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    data = request.json
    
    # Save notification settings
    email = data.get('email')
    alert_types = data.get('alertTypes', [])
    
    # Update the database
    db = DatabaseHandler()
    db.save_notification_settings(email, alert_types)
    
    return jsonify({
        "success": True,
        "message": "Notification settings updated"
    })

@app.route('/api/notifications/test', methods=['POST'])
def test_notification():
    """Send a test notification."""
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({"error": "Email address required"}), 400
    
    # Send test notification
    try:
        send_notification(
            email, 
            "Pool Automation System - Test Notification", 
            "This is a test notification from your Pool Automation System."
        )
        
        return jsonify({
            "success": True,
            "message": "Test notification sent"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to send notification: {str(e)}"
        }), 500

def send_notification(email, subject, message):
    """Send an email notification."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    # Get email settings from config
    smtp_server = config.get('notifications', {}).get('smtp_server', '')
    smtp_port = config.get('notifications', {}).get('smtp_port', 587)
    smtp_user = config.get('notifications', {}).get('smtp_username', '')
    smtp_pass = config.get('notifications', {}).get('smtp_password', '')
    
    if not smtp_server or not smtp_user or not smtp_pass:
        raise ValueError("SMTP settings not configured")
    
    # Create message
    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = email
    msg['Subject'] = subject
    
    # Add body
    msg.attach(MIMEText(message, 'plain'))
    
    # Send email
    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)

@app.route('/api/simulator/events', methods=['GET'])
def get_simulator_events():
    """Get recent simulator events."""
    if simulator:
        events = simulator.get_recent_events(10)
        return jsonify(events)
    return jsonify({"error": "Simulator not initialized"}), 500

@app.route('/api/simulator/trigger-event', methods=['POST'])
def trigger_simulator_event():
    """Manually trigger a simulator event."""
    data = request.json or {}
    event_type = data.get('type')
    
    if simulator:
        success = simulator.trigger_event(event_type)
        return jsonify({"success": success})
    return jsonify({"error": "Simulator not initialized"}), 500

@app.route('/api/dosing/schedule', methods=['POST'])
def schedule_dose():
    """Schedule a future dose."""
    data = request.json or {}
    timestamp = data.get('timestamp')
    duration = data.get('duration')
    flow_rate = data.get('flow_rate')
    
    if dosing_controller:
        success = dosing_controller.schedule_dose(timestamp, duration, flow_rate)
        return jsonify({"success": success})
    return jsonify({"error": "Dosing controller not initialized"}), 500

@app.route('/api/dosing/scheduled', methods=['GET'])
def get_scheduled_doses():
    """Get scheduled doses."""
    if dosing_controller:
        scheduled = dosing_controller.get_scheduled_doses()
        return jsonify(scheduled)
    return jsonify({"error": "Dosing controller not initialized"}), 500

# WebSocket events
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    # Send initial data upon connection
    socketio.emit('connection_confirmed', {
        'status': 'connected',
        'clientId': request.sid
    })
    
    # Send current parameters
    send_status_update()

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('request_params')
def handle_request_params():
    """Handle client request for current parameters."""
    send_status_update()

@socketio.on('request_system_state')
def handle_system_state_request():
    """Handle client request for complete system state."""
    logger.info(f"System state requested by client: {request.sid}")
    
    if simulator:
        # Get all current parameters and pump states
        params = simulator.get_all_parameters()
        pump_states = simulator.get_pump_states()
        
        # Combine into a complete status update
        complete_state = {
            "ph": round(params['ph'], 2),
            "orp": round(params['orp']),
            "freeChlorine": round(params['free_chlorine'], 2),
            "combinedChlorine": round(params['combined_chlorine'], 2),
            "turbidity": round(params['turbidity'], 3),
            "temperature": round(params['temperature'], 1),
            "phPumpRunning": pump_states.get('acid', False),
            "clPumpRunning": pump_states.get('chlorine', False),
            "pacPumpRunning": pump_states.get('pac', False),
            "pacDosingRate": mock_pac_pump.get_flow_rate(),
            "dosingMode": dosing_controller.mode.name,
            "timestamp": time.time(),
            "systemStatus": "normal"
        }
        
        # Send the complete state to the requesting client only
        emit('complete_system_state', complete_state)

# Main entry point
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)