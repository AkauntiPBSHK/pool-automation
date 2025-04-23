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
from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO
from flask_cors import CORS
from dotenv import load_dotenv

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
    static_folder='../frontend/static',
    template_folder='../frontend/templates'
)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key')
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")

# Load configuration
def load_config():
    env = os.getenv('FLASK_ENV', 'development')
    config_path = os.path.join(os.path.dirname(__file__), f'../config/{env}/config.json')
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        return {"system": {"simulation_mode": True}}

config = load_config()

# Simulated data generator
def get_simulated_data():
    """Generate simulated sensor data for development/testing"""
    return {
        "turbidity": {
            "current": round(random.uniform(0.05, 0.35), 3),
            "average": round(random.uniform(0.10, 0.25), 3),
            "high_threshold": 0.25,
            "low_threshold": 0.12,
            "target": 0.15,
            "pump_status": "stopped"
        },
        "ph": round(random.uniform(7.0, 7.4), 1),
        "orp": int(random.uniform(650, 750)),
        "free_chlorine": round(random.uniform(0.8, 1.2), 2),
        "combined_chlorine": round(random.uniform(0.1, 0.3), 2),
        "temperature": round(random.uniform(26.0, 29.0), 1),
        "ph_pump_status": "stopped",
        "cl_pump_status": "stopped",
        "system_status": {
            "running": True,
            "simulation": True,
            "last_update": time.time()
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

@app.route('/api/dashboard')
def dashboard_data():
    """Get all dashboard data for the frontend."""
    # This is the endpoint your frontend was trying to call
    if config.get('system', {}).get('simulation_mode', True):
        return jsonify(get_simulated_data())
    else:
        # In production, this would fetch real data from sensors
        # For now, return simulated data anyway
        return jsonify(get_simulated_data())

@app.route('/api/turbidity')
def turbidity_data():
    """Get turbidity-specific data."""
    data = get_simulated_data()
    return jsonify(data["turbidity"])

@app.route('/api/dosing/status')
def dosing_status():
    """Get current dosing status."""
    return jsonify({
        "mode": "auto",
        "running": False,
        "last_dose": time.time() - 3600,
        "pump_status": "stopped"
    })

@app.route('/api/dosing/mode', methods=['POST'])
def set_dosing_mode():
    """Set the dosing mode (auto/manual)."""
    data = request.json
    mode = data.get('mode', 'auto')
    return jsonify({"success": True, "mode": mode})

@app.route('/api/dosing/start', methods=['POST'])
def start_dosing():
    """Start manual dosing."""
    return jsonify({"success": True, "message": "Dosing started"})

@app.route('/api/dosing/stop', methods=['POST'])
def stop_dosing():
    """Stop dosing."""
    return jsonify({"success": True, "message": "Dosing stopped"})

# WebSocket events
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    socketio.emit('status', {'connected': True})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

# Main entry point
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)