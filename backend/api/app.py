#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Pool Automation System - Main API Application
"""

import os
import json
import logging
from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO
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
    static_folder='../../frontend/static',
    template_folder='../../frontend/templates'
)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key')
socketio = SocketIO(app)

# Load configuration
def load_config():
    env = os.getenv('FLASK_ENV', 'development')
    config_path = os.path.join(os.path.dirname(__file__), f'../../config/{env}/config.json')
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        return {}

config = load_config()

# Routes
@app.route('/')
def index():
    """Render the main dashboard page."""
    return render_template('index.html')

@app.route('/api/status')
def status():
    """Get the current system status."""
    # In a real implementation, this would fetch actual data
    return jsonify({
        "status": "ok",
        "simulation_mode": config.get('system', {}).get('simulation_mode', True),
        "version": "0.1.0"
    })

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