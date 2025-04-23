# app.py
import os
import time
import logging
import argparse
import threading
from flask import Flask, jsonify, request, render_template
from flask_socketio import SocketIO
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Import our modules
from config import settings
from models import db, init_db, SensorReading, DosingEvent, SystemEvent
from hardware import initialize_hardware
from services.dosing import DosingController, DosingMode

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

# Main entry point
if __name__ == '__main__':
    logger.info(f"Starting Pool Automation System in {'SIMULATION' if simulation_mode else 'PRODUCTION'} mode")
    
    # Start the web server
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)