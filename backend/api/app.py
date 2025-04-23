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
from backend.models.database import DatabaseHandler
from backend.utils.simulator import DataSimulator

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

@app.route('/api/dashboard')
def dashboard_data():
    """Get all dashboard data."""
    # Create a simulated data response that matches the frontend expectations
    turbidity_value = round(random.uniform(0.12, 0.18), 3)
    
    return jsonify({
        "ph": round(random.uniform(7.2, 7.6), 1),
        "orp": random.randint(680, 760),
        "freeChlorine": round(random.uniform(1.0, 1.4), 2),
        "combinedChlorine": round(random.uniform(0.1, 0.3), 1),
        "turbidity": turbidity_value,
        "temperature": round(random.uniform(27.0, 29.0), 1),
        "uvIntensity": random.randint(90, 96),
        "phPumpRunning": False,
        "clPumpRunning": False,
        "pacPumpRunning": False,
        "pacDosingRate": 75  # Default value in ml/h
    })

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

@app.route('/api/init')
def initialize_database():
    """Initialize the database with sample data (for development)."""
    try:
        db = DatabaseHandler()
        simulator = DataSimulator(db)
        simulator.generate_historical_data(days=7)
        return jsonify({"success": True, "message": "Database initialized with sample data"})
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

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