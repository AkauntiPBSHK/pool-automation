# app.py
from flask import Flask, jsonify, request, render_template
from flask_socketio import SocketIO
import os
import json
import logging
from datetime import datetime
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("pool_automation.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, 
    static_folder='static',
    template_folder='templates')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'pool_automation_secret')

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*")

# Simulation mode flag (True when hardware is not connected)
SIMULATION_MODE = os.environ.get('SIMULATION_MODE', 'True').lower() == 'true'

# Current system state (will be expanded)
system_state = {
    "ph": 7.4,
    "orp": 720,
    "freeChlorine": 1.2,
    "combinedChlorine": 0.2,
    "turbidity": 0.14,
    "temperature": 28.2,
    "uvIntensity": 94,
    "phPumpRunning": False,
    "clPumpRunning": False,
    "pacPumpRunning": False,
    "pacDosingRate": 75,
    "version": "0.1.0",
    "simulation_mode": SIMULATION_MODE
}

# Basic routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status')
def status():
    """Get current system status"""
    return jsonify({
        "status": "ok",
        "simulation_mode": system_state["simulation_mode"],
        "version": system_state["version"]
    })

@app.route('/api/dashboard')
def dashboard():
    """Get current dashboard data"""
    return jsonify(system_state)

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    logger.info('Client connected')
    socketio.emit('parameter_update', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info('Client disconnected')

# Main entry point
if __name__ == '__main__':
    logger.info(f"Starting Pool Automation System in {'SIMULATION' if SIMULATION_MODE else 'PRODUCTION'} mode")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)