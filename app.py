"""Main entry point for Pool Automation System."""
import os
import time
import logging
import argparse
from flask import Flask, jsonify, request, render_template
from flask_socketio import SocketIO

# Import our modules
from config import settings
from models import db, init_db, SensorReading, DosingEvent, SystemEvent
from hardware import initialize_hardware
from services.dosing import DosingController, DosingMode

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, 
    static_folder='static',
    template_folder='templates')

# Configure the app
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'pool_automation_secret')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///pool_automation.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize database
init_db(app)

# Command line arguments
parser = argparse.ArgumentParser(description='Pool Automation System')
parser.add_argument('--simulate', action='store_true', help='Run in simulation mode')
args = parser.parse_args()

# Override simulation setting if command-line flag is provided
if args.simulate:
    settings.set('system.simulation_mode', True)

# Initialize hardware
hardware = initialize_hardware()
simulation_mode = hardware['simulation_mode']

# Initialize controllers
turbidity_sensor = hardware['sensors'].get('turbidity')
pac_pump = hardware['actuators'].get('pac_pump')

if turbidity_sensor and pac_pump:
    dosing_controller = DosingController(
        turbidity_sensor, 
        pac_pump,
        settings.get('dosing', {})
    )
    # Start in AUTO mode if not in simulation mode
    if not simulation_mode:
        dosing_controller.set_mode(DosingMode.AUTO)
else:
    logger.error("Failed to initialize dosing controller - missing hardware components")
    dosing_controller = None

# Current system state
system_state = {
    "ph": 7.4,
    "orp": 720,
    "freeChlorine": 1.2,
    "combinedChlorine": 0.2,
    "turbidity": turbidity_sensor.get_reading() if turbidity_sensor else 0.14,
    "temperature": 28.2,
    "uvIntensity": 94,
    "phPumpRunning": False,
    "clPumpRunning": False,
    "pacPumpRunning": pac_pump.is_running() if pac_pump else False,
    "pacDosingRate": pac_pump.get_flow_rate() * 60 if pac_pump else 75,  # Convert ml/min to ml/h
    "version": "0.1.0",
    "simulation_mode": simulation_mode
}

# Function to update system state
def update_system_state():
    """Update the system state with current values."""
    # Only update attributes with hardware readings
    if turbidity_sensor:
        system_state["turbidity"] = turbidity_sensor.get_reading()
    
    if pac_pump:
        system_state["pacPumpRunning"] = pac_pump.is_running()
        system_state["pacDosingRate"] = pac_pump.get_flow_rate() * 60  # Convert ml/min to ml/h

# Routes
@app.route('/')
def index():
    """Render the main dashboard page."""
    return render_template('index.html')

@app.route('/api/status')
def status():
    """Get current system status."""
    update_system_state()
    
    return jsonify({
        "status": "ok",
        "simulation_mode": system_state["simulation_mode"],
        "version": system_state["version"]
    })

@app.route('/api/dashboard')
def dashboard():
    """Get current dashboard data."""
    update_system_state()
    
    return jsonify(system_state)

@app.route('/api/turbidity')
def turbidity():
    """Get turbidity data."""
    if not turbidity_sensor:
        return jsonify({"error": "Turbidity sensor not available"}), 503
    
    data = {
        "current": turbidity_sensor.get_reading(),
        "average": turbidity_sensor.get_moving_average()
    }
    
    # Add dosing controller data if available
    if dosing_controller:
        dosing_status = dosing_controller.get_status()
        data.update({
            "mode": dosing_status["mode"],
            "high_threshold": dosing_status["high_threshold"],
            "low_threshold": dosing_status["low_threshold"],
            "target": dosing_status["target"]
        })
    
    return jsonify(data)

@app.route('/api/dosing/status')
def dosing_status():
    """Get dosing controller status."""
    if not dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    return jsonify(dosing_controller.get_status())

@app.route('/api/dosing/mode', methods=['POST'])
def set_dosing_mode():
    """Set the dosing mode."""
    if not dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    data = request.json
    mode = data.get('mode')
    
    if not mode:
        return jsonify({"error": "Mode parameter is required"}), 400
    
    try:
        result = dosing_controller.set_mode(mode)
        if result:
            return jsonify({"success": True, "mode": dosing_controller.get_mode().name})
        else:
            return jsonify({"error": f"Failed to set mode to {mode}"}), 400
    except Exception as e:
        logger.error(f"Error setting dosing mode: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/dosing/start', methods=['POST'])
def start_dosing():
    """Start manual dosing."""
    if not dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    data = request.json
    flow_rate = float(data.get('flow_rate', 75))  # ml/h
    duration = int(data.get('duration', 30))  # seconds
    
    # Ensure flow rate is within limits
    min_flow = pac_pump.min_flow_ml_h if pac_pump else 60
    max_flow = pac_pump.max_flow_ml_h if pac_pump else 150
    
    if flow_rate < min_flow:
        flow_rate = min_flow
    elif flow_rate > max_flow:
        flow_rate = max_flow
    
    # Set to manual mode first
    dosing_controller.set_mode(DosingMode.MANUAL)
    
    # Start dosing
    result = dosing_controller.manual_dose(flow_rate, duration)
    
    if result:
        # Log the event
        event = DosingEvent(
            pump_type='pac',
            parameter='turbidity',
            duration_seconds=duration,
            flow_rate=flow_rate,
            is_automatic=False,
            parameter_value_before=turbidity_sensor.get_reading() if turbidity_sensor else None
        )
        db.session.add(event)
        db.session.commit()
        
        # Notify clients
        socketio.emit('pump_status', {
            'pump': 'pac',
            'status': True,
            'flow_rate': flow_rate,
            'duration': duration
        })
        
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Failed to start dosing"}), 500

@app.route('/api/dosing/stop', methods=['POST'])
def stop_dosing():
    """Stop dosing."""
    if not dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    result = dosing_controller.stop_dosing()
    
    if result:
        # Notify clients
        socketio.emit('pump_status', {
            'pump': 'pac',
            'status': False
        })
        
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Failed to stop dosing"}), 500

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    logger.info('Client connected')
    socketio.emit('parameter_update', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    logger.info('Client disconnected')

# Main loop function
def main_loop():
    """Main processing loop for the system."""
    logger.info("Main processing loop started")
    
    update_interval = 1.0  # seconds
    while True:
        try:
            # Update dosing controller
            if dosing_controller:
                dosing_controller.update()
            
            # Update system state
            update_system_state()
            
            # Sleep until next update
            time.sleep(update_interval)
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            time.sleep(1.0)  # Brief delay before retrying

# Main entry point
if __name__ == '__main__':
    logger.info(f"Starting Pool Automation System in {'SIMULATION' if simulation_mode else 'PRODUCTION'} mode")
    
    # Start the main loop in a separate thread
    import threading
    main_thread = threading.Thread(target=main_loop, daemon=True)
    main_thread.start()
    
    # Start the web server
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)