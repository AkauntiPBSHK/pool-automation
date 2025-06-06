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
import sqlite3
import uuid
import traceback
from flask import Flask, jsonify, render_template, request, redirect, url_for, session, flash
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms, disconnect
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
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

# Import configuration from main config module
from config import get_config

# Import validation utilities
from backend.utils.validation import validate_request_json, SCHEMAS, ValidationError, validate_pump_control
from backend.utils.rate_limiter import rate_limit, check_global_rate_limit, get_rate_limit_status
from backend.utils.auth_middleware import (
    init_auth_middleware, require_auth, require_csrf_protection, 
    require_pool_access, secure_api_endpoint, audit_log
)
from backend.utils.error_handler import (
    init_error_handling, setup_structured_logging, handle_exceptions,
    raise_validation_error, raise_not_found_error, raise_auth_error,
    ErrorContext, ValidationError, ResourceNotFoundError
)

# Load application configuration
app_config = get_config()
app.config.from_object(app_config)

# Set secret key
app.config['SECRET_KEY'] = app_config.SECRET_KEY
logger.info(f"Configuration loaded for environment: {app.config['FLASK_ENV']}")

# Add global rate limiting middleware
@app.before_request
def apply_global_rate_limiting():
    """Apply global rate limiting to all API requests"""
    # Skip rate limiting for static files and certain paths
    if request.path.startswith('/static/') or request.path in ['/', '/login', '/register']:
        return None
    
    # Apply global rate limits to API endpoints
    if request.path.startswith('/api/'):
        rate_limit_response = check_global_rate_limit()
        if rate_limit_response:
            return rate_limit_response
    
    return None

CORS(app)  # Enable CORS for all routes

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Initialize authentication middleware
init_auth_middleware(app)

# Initialize error handling
init_error_handling(app)
setup_structured_logging(app)

# Consistent exception handling function
def handle_exception(e, operation_name, log_error=True, reraise=False):
    """Handle exceptions consistently throughout the application."""
    error_message = f"Error during {operation_name}: {str(e)}"
    error_details = {
        "error": str(e),
        "type": type(e).__name__,
        "operation": operation_name
    }
    
    if log_error:
        logger.error(error_message)
        logger.debug(traceback.format_exc())
    
    if reraise:
        raise e
    
    return error_details

# Decorators for role-based access control
from functools import wraps

def admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin():
            flash("Admin access required", "error")
            return redirect(url_for('pools'))
        return f(*args, **kwargs)
    return decorated_function

# User model for Flask-Login
class User(UserMixin):
    def __init__(self, id, email, password_hash, name=None, role='customer'):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.name = name
        self.role = role
    
    def is_admin(self):
        return self.role == 'admin'

# Create user-related tables
def create_auth_tables():
    """Create tables for user authentication."""
    try:
        with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
            cursor = conn.cursor()
            
            # Create users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create pools table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pools (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    location TEXT,
                    volume_m3 REAL,
                    FOREIGN KEY (owner_id) REFERENCES users (id)
                )
            ''')
            
            # Create devices table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS devices (
                    device_id TEXT PRIMARY KEY,
                    pool_id TEXT,
                    status TEXT DEFAULT 'inactive',
                    last_seen DATETIME,
                    FOREIGN KEY (pool_id) REFERENCES pools (id)
                )
            ''')
            
            conn.commit()
            logger.info("Authentication tables created successfully")
    except Exception as e:
        handle_exception(e, "creating authentication tables")

# User loader callback for Flask-Login
@login_manager.user_loader
def load_user(user_id):
    """Load a user by ID for Flask-Login."""
    try:
        with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user_data = cursor.fetchone()
            
            if user_data:
                return User(
                    id=user_data['id'],
                    email=user_data['email'],
                    password_hash=user_data['password_hash'],
                    name=user_data['name'] if 'name' in user_data.keys() else None,
                    role=user_data['role'] if 'role' in user_data.keys() else 'customer'
                )
    except Exception as e:
        handle_exception(e, "loading user")
    
    return None

# Helper functions for pool operations
def get_user_pools(user_id):
    """Get all pools owned by a user."""
    try:
        with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM pools WHERE owner_id = ?", (user_id,))
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        handle_exception(e, "getting user pools")
        return []

def get_pool(pool_id, user_id=None):
    """Get a specific pool, optionally checking ownership."""
    try:
        with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if user_id:
                # Check ownership through customer relationship
                cursor.execute("""
                    SELECT p.* FROM pools p
                    JOIN customers c ON p.customer_id = c.id
                    WHERE p.id = ? AND c.user_id = ?
                """, (pool_id, user_id))
            else:
                # Just get the pool
                cursor.execute("SELECT * FROM pools WHERE id = ?", (pool_id,))
            
            pool = cursor.fetchone()
            return dict(pool) if pool else None
    except Exception as e:
        handle_exception(e, "getting pool details")
        return None

def get_last_reading(pool_id):
    """Get the last sensor readings for a pool."""
    # In a real implementation, this would query the database
    # For now, return simulated values
    return {
        "temperature": round(random.uniform(26, 29), 1),
        "ph": round(random.uniform(7.2, 7.6), 1),
        "orp": round(random.uniform(680, 750)),
        "turbidity": round(random.uniform(0.12, 0.18), 3),
        "free_chlorine": round(random.uniform(1.0, 1.4), 2),
        "combined_chlorine": round(random.uniform(0.1, 0.3), 2)
    }

def get_pool_status(pool_id):
    """Get the current status of a pool."""
    # In a real implementation, this would check sensor values against thresholds
    # For now, randomly return 'ok' or 'alert'
    return random.choice(['ok', 'ok', 'ok', 'alert'])  # 75% chance of 'ok'

async_mode = None  # Let Flask-SocketIO choose the best async mode

# Update your Socket.IO configuration to allow both websocket and polling
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    ping_timeout=app.config['SOCKETIO_PING_TIMEOUT'],
    ping_interval=app.config['SOCKETIO_PING_INTERVAL'],
    transports=["websocket", "polling"],    # Allow both transports
    async_mode='threading'  # Use threading for better compatibility
)

# Create a global instance of the system simulator
simulator = EnhancedPoolSimulator(app.config.get('SIMULATOR', {}))

# Create mock hardware using the simulator
mock_turbidity_sensor = MockTurbiditySensor(app.config.get('HARDWARE', {}).get('turbidity_sensor', {}), simulator)
mock_pac_pump = MockPump({'type': 'pac', **app.config.get('HARDWARE', {}).get('pac_pump', {})}, simulator)

# Background task to send periodic WebSocket updates
def periodic_websocket_updates():
    """Send periodic parameter updates via WebSocket."""
    while True:
        try:
            with app.app_context():
                send_status_update()
            time.sleep(2)  # Send updates every 2 seconds
        except Exception as e:
            logger.error(f"Error in periodic WebSocket updates: {e}")
            time.sleep(5)  # Wait longer if there's an error

# Start background thread for WebSocket updates
websocket_thread = threading.Thread(target=periodic_websocket_updates, daemon=True)
websocket_thread.start()
logger.info("Started periodic WebSocket update thread")

# Create an event logger function
def log_dosing_event(event_type, duration, flow_rate, turbidity):
    try:
        db = DatabaseHandler()
        db.log_dosing_event(event_type, duration, flow_rate, turbidity)
        logger.info(f"Dosing event logged: {event_type}, {duration}s, {flow_rate}ml/h, {turbidity}NTU")
    except Exception as e:
        handle_exception(e, "logging dosing event")

# Add your new adapter function right here, after log_dosing_event
def event_logger_adapter(*args, **kwargs):
    """Adapter function to handle different event logger formats."""
    try:
        # Handle system events (just logging, no database entry)
        if len(args) >= 1 and args[0] == 'system':
            message = args[1] if len(args) > 1 else "System event"
            logger.info(f"System event: {message}")
            return
        
        # For dosing events
        if len(args) >= 2 and args[0] == 'dosing':
            # Second argument is event subtype
            event_subtype = args[1]
            duration = kwargs.get('duration', 0)
            flow_rate = kwargs.get('flow_rate', 0)
            turbidity = kwargs.get('turbidity', 0)
            
            # Call original logger with combined event type
            log_dosing_event(f"PAC-{event_subtype}", duration, flow_rate, turbidity)
            return
        
        # Handle basic calls with minimal arguments (fallback)
        event_type = args[0] if args else "unknown"
        duration = args[1] if len(args) > 1 else 0
        flow_rate = args[2] if len(args) > 2 else 0
        turbidity = args[3] if len(args) > 3 else 0
        
        # Log with whatever we have
        log_dosing_event(event_type, duration, flow_rate, turbidity)
    except Exception as e:
        handle_exception(e, "adapting event logger")

def send_status_update(pool_id=None):
    """Send parameter updates to clients.
    
    Args:
        pool_id (str, optional): The specific pool ID to send updates for.
            If None, sends general updates to all connected clients.
    """
    if not simulator:
        logger.warning("Simulator not initialized, skipping status update")
        return
    
    try:
        # If no pool_id provided, send general updates to all clients
        if pool_id is None:
            # Get general parameters from simulator
            params = simulator.get_all_parameters()
            pump_states = simulator.get_pump_states()
            
            # Get status from dosing controller
            dosing_status = dosing_controller.get_status()
            
            # Create status update
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
                "dosingMode": dosing_status['mode'],
                "timestamp": time.time(),
                "turbidityLimits": {
                    "highThreshold": dosing_status['high_threshold'],
                    "lowThreshold": dosing_status['low_threshold'],
                    "target": dosing_status['target']
                },
                "dosingController": {
                    "lastDoseTime": dosing_status['last_dose_time'],
                    "doseCounter": dosing_status['dose_counter'],
                    "pumpRunning": dosing_status['pump_status'],
                    "pidLastError": dosing_controller.pid.last_error if hasattr(dosing_controller, 'pid') else 0,
                    "pidIntegral": dosing_controller.pid.integral if hasattr(dosing_controller, 'pid') else 0
                }
            }
            
            # Send to all connected clients
            socketio.emit('parameter_update', status_data)
            
        else:
            # For pool-specific updates, send to the pool's room
            try:
                # Get parameters for this specific pool (simulator doesn't support pool-specific data yet)
                params = simulator.get_all_parameters()
                pump_states = simulator.get_pump_states()
                dosing_status = dosing_controller.get_status()
                
                # Create a pool-specific status update
                status_data = {
                    "pool_id": pool_id,
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
                    "dosingMode": dosing_status['mode'],
                    "timestamp": time.time(),
                    "turbidityLimits": {
                        "highThreshold": dosing_status['high_threshold'],
                        "lowThreshold": dosing_status['low_threshold'],
                        "target": dosing_status['target']
                    }
                }
                
                # Send update to the specific pool's room
                socketio.emit('parameter_update', status_data, room=pool_id)
                
            except Exception as e:
                handle_exception(e, f"sending pool-specific update for pool {pool_id}")
    
    except Exception as e:
        handle_exception(e, "send_status_update")

# Add these functions for emitting dosing and system events
def emit_dosing_update(event_type, details=None):
    """Emit dosing controller update to all clients."""
    try:
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
    except Exception as e:
        handle_exception(e, "emitting dosing update")

def emit_system_event(event_type, description, parameter=None, value=None):
    """Emit system event to all clients."""
    try:
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
    except Exception as e:
        handle_exception(e, "emitting system event")

# Modify your start_background_tasks function
def start_background_tasks():
    """Start background tasks for real-time updates."""
    def send_updates():
        while True:
            try:
                send_status_update()
                time.sleep(2)  # Update every 2 seconds
            except Exception as e:
                handle_exception(e, "background update task")
                time.sleep(5)  # Delay on error
    
    thread = threading.Thread(target=send_updates, daemon=True)
    thread.start()
    logger.info("Background tasks started")

# Create authentication tables
create_auth_tables()

# Initialize the dosing controller with the simulator components
dosing_controller = AdvancedDosingController(
    mock_turbidity_sensor, 
    mock_pac_pump,
    {
        'high_threshold_ntu': app.config.get('DOSING_HIGH_THRESHOLD', 0.25),
        'low_threshold_ntu': app.config.get('DOSING_LOW_THRESHOLD', 0.12),
        'target_ntu': app.config.get('DOSING_TARGET', 0.15),
        'min_dose_interval_sec': app.config.get('DOSING_MIN_INTERVAL', 300),
        'dose_duration_sec': app.config.get('DOSING_DURATION', 30),
        'pid_kp': app.config.get('DOSING_PID_KP', 1.0),
        'pid_ki': app.config.get('DOSING_PID_KI', 0.1),
        'pid_kd': app.config.get('DOSING_PID_KD', 0.05)
    },
    event_logger_adapter  # Use the adapter here
)

# Start the controller in automatic mode
dosing_controller.start(DosingMode.AUTOMATIC)

# Call this after initializing the Flask app
start_background_tasks()

# Simulated data generator
def get_simulated_data():
    """Generate simulated sensor data in camelCase format for the frontend"""
    return {
        "turbidity": {
            "current": round(random.uniform(0.05, 0.35), 3),
            "average": round(random.uniform(0.10, 0.25), 3),
            "highThreshold": app.config.get('DOSING_HIGH_THRESHOLD', 0.25),
            "lowThreshold": app.config.get('DOSING_LOW_THRESHOLD', 0.12),
            "target": app.config.get('DOSING_TARGET', 0.15),
            "pumpStatus": "stopped"
        },
        "ph": round(random.uniform(7.0, 7.4), 1),
        "orp": int(random.uniform(650, 750)),
        "freeChlorine": round(random.uniform(0.8, 1.2), 2),
        "combinedChlorine": round(random.uniform(0.1, 0.3), 1),  # Note: using camelCase here
        "temperature": round(random.uniform(26.0, 29.0), 1),
        "systemStatus": {
            "running": True,
            "simulation": app.config.get('SIMULATION_MODE', True),
            "lastUpdate": time.time()
        }
    }

# Routes
# Authentication routes
@app.route('/login', methods=['GET', 'POST'])
@rate_limit('login_attempts', auto_block=True, block_duration=600)  # Auto-block for 10 minutes
def login():
    """Handle user login."""
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        try:
            with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
                user_data = cursor.fetchone()
                
                if user_data and check_password_hash(user_data['password_hash'], password):
                    user = User(
                        id=user_data['id'],
                        email=user_data['email'],
                        password_hash=user_data['password_hash'],
                        name=user_data['name'] if 'name' in user_data.keys() else None,
                        role=user_data['role'] if 'role' in user_data.keys() else 'customer'
                    )
                    login_user(user)
                    return redirect(url_for('pools'))
        except Exception as e:
            handle_exception(e, "user login")
        
        flash("Invalid email or password", "error")
        return render_template('login.html', error="Invalid email or password")
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
@rate_limit('register_attempts', auto_block=True, block_duration=1800)  # Auto-block for 30 minutes
def register():
    """Handle user registration."""
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        name = request.form.get('name')
        
        try:
            with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
                cursor = conn.cursor()
                
                # Check if email already exists
                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                existing_user = cursor.fetchone()
                
                if existing_user:
                    flash("Email already registered", "error")
                    return render_template('register.html', error="Email already registered")
                
                # Create new user
                user_id = str(uuid.uuid4())
                password_hash = generate_password_hash(password)
                
                cursor.execute(
                    "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
                    (user_id, email, password_hash, name)
                )
                conn.commit()
                
                # Log in the new user
                user = User(id=user_id, email=email, password_hash=password_hash, name=name)
                login_user(user)
                
                flash("Account created successfully", "success")
                return redirect(url_for('pools'))
        except Exception as e:
            handle_exception(e, "user registration")
            flash("An error occurred during registration", "error")
            return render_template('register.html', error="Registration failed")
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    """Handle user logout."""
    logout_user()
    flash("Logged out successfully", "success")
    return redirect(url_for('login'))

# Customer management routes (admin only)
@app.route('/customers')
@admin_required
def customers():
    """Show list of all customers."""
    try:
        with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.*, u.email, u.role, 
                       COUNT(p.id) as pool_count
                FROM customers c
                JOIN users u ON c.user_id = u.id
                LEFT JOIN pools p ON c.id = p.customer_id
                GROUP BY c.id
                ORDER BY c.created_at DESC
            """)
            customers = [dict(row) for row in cursor.fetchall()]
        return render_template('customers.html', customers=customers)
    except Exception as e:
        handle_exception(e, "getting customers")
        return render_template('customers.html', customers=[])

@app.route('/customers/add', methods=['GET', 'POST'])
@admin_required
def add_customer():
    """Add a new customer."""
    if request.method == 'POST':
        # Customer details
        name = request.form.get('name')
        email = request.form.get('email')
        phone = request.form.get('phone')
        address = request.form.get('address')
        pool_install_date = request.form.get('pool_install_date')
        
        # Generate temporary password
        temp_password = f"BioPool{str(uuid.uuid4())[:8]}"
        
        try:
            with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
                cursor = conn.cursor()
                
                # Check if email already exists
                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    flash("Email already registered", "error")
                    return render_template('add_customer.html')
                
                # Create user account
                user_id = str(uuid.uuid4())
                password_hash = generate_password_hash(temp_password)
                
                cursor.execute("""
                    INSERT INTO users (id, email, password_hash, name, role)
                    VALUES (?, ?, ?, ?, 'customer')
                """, (user_id, email, password_hash, name))
                
                # Create customer record
                customer_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO customers (id, user_id, name, phone, address, pool_install_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (customer_id, user_id, name, phone, address, pool_install_date))
                
                conn.commit()
                
                # TODO: Send email with temporary password
                flash(f"Customer created successfully. Temporary password: {temp_password}", "success")
                return redirect(url_for('customers'))
                
        except Exception as e:
            handle_exception(e, "creating customer")
            flash("Error creating customer", "error")
    
    return render_template('add_customer.html')

@app.route('/customers/<customer_id>/pools', methods=['GET', 'POST'])
@admin_required
def manage_customer_pools(customer_id):
    """Manage pools for a specific customer."""
    if request.method == 'POST':
        # Add pool to customer
        pool_name = request.form.get('pool_name')
        device_serial = request.form.get('device_serial')
        location = request.form.get('location')
        
        try:
            with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
                cursor = conn.cursor()
                
                # Create new pool
                pool_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO pools (id, customer_id, name, device_serial, location, status)
                    VALUES (?, ?, ?, ?, ?, 'active')
                """, (pool_id, customer_id, pool_name, device_serial, location))
                
                conn.commit()
                flash("Pool added successfully", "success")
                
        except Exception as e:
            handle_exception(e, "adding pool to customer")
            flash("Error adding pool", "error")
    
    # Get customer info and pools
    try:
        with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get customer info
            cursor.execute("""
                SELECT c.*, u.email
                FROM customers c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = ?
            """, (customer_id,))
            customer = dict(cursor.fetchone())
            
            # Get customer's pools
            cursor.execute("""
                SELECT * FROM pools
                WHERE customer_id = ?
                ORDER BY created_at DESC
            """, (customer_id,))
            pools = [dict(row) for row in cursor.fetchall()]
            
        return render_template('customer_pools.html', customer=customer, pools=pools)
        
    except Exception as e:
        handle_exception(e, "getting customer pools")
        flash("Error loading customer data", "error")
        return redirect(url_for('customers'))

@app.route('/pools')
@login_required
def pools():
    """Show list of pools based on user role."""
    if current_user.is_admin():
        # Admin sees all pools with customer info
        try:
            with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT p.*, c.name as customer_name, u.email as customer_email
                    FROM pools p
                    LEFT JOIN customers c ON p.customer_id = c.id
                    LEFT JOIN users u ON c.user_id = u.id
                    ORDER BY p.created_at DESC
                """)
                all_pools = [dict(row) for row in cursor.fetchall()]
            return render_template('pools.html', pools=all_pools, is_admin=True)
        except Exception as e:
            handle_exception(e, "getting all pools")
            return render_template('pools.html', pools=[], is_admin=True)
    else:
        # Customer sees only their pools
        try:
            with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT p.*
                    FROM pools p
                    JOIN customers c ON p.customer_id = c.id
                    WHERE c.user_id = ?
                    ORDER BY p.created_at DESC
                """, (current_user.id,))
                user_pools = [dict(row) for row in cursor.fetchall()]
            return render_template('pools.html', pools=user_pools, is_admin=False)
        except Exception as e:
            handle_exception(e, "getting user pools")
            return render_template('pools.html', pools=[], is_admin=False)

@app.route('/pools/add', methods=['GET', 'POST'])
@login_required
def add_pool():
    """Add a new pool."""
    if request.method == 'POST':
        name = request.form.get('name')
        location = request.form.get('location')
        volume = request.form.get('volume')
        device_id = request.form.get('device_id')
        
        try:
            with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
                cursor = conn.cursor()
                
                # Create new pool
                pool_id = str(uuid.uuid4())
                
                cursor.execute(
                    "INSERT INTO pools (id, name, owner_id, location, volume_m3) VALUES (?, ?, ?, ?, ?)",
                    (pool_id, name, current_user.id, location, volume)
                )
                
                # Associate device with pool if provided
                if device_id:
                    cursor.execute(
                        "INSERT INTO devices (device_id, pool_id, status) VALUES (?, ?, 'active')",
                        (device_id, pool_id)
                    )
                
                conn.commit()
                
                flash("Pool added successfully", "success")
                return redirect(url_for('pools'))
        except Exception as e:
            handle_exception(e, "adding pool")
            flash("An error occurred while adding the pool", "error")
    
    return render_template('add_pool.html')

@app.route('/pool/<pool_id>')
@login_required
def pool_dashboard(pool_id):
    """Show dashboard for a specific pool."""
    # Verify user has access to this pool
    pool = get_pool(pool_id, current_user.id)
    
    if not pool:
        flash("You don't have access to this pool", "error")
        return redirect(url_for('pools'))
    
    # Set the current pool ID in session for API calls
    session['current_pool_id'] = pool_id
    
    # Render the main dashboard for this pool
    return render_template('index.html', pool=pool)

@app.route('/')
@app.route('/dashboard/<pool_id>')
def index(pool_id=None):
    """Render the main dashboard page or redirect to login."""
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    
    # If pool_id is provided, validate access
    if pool_id:
        if current_user.is_admin():
            # Admin can view any pool
            pool = get_pool(pool_id)
        else:
            # Customer can only view their pools
            pool = get_pool(pool_id, current_user.id)
        
        if pool:
            session['current_pool_id'] = pool_id
            return render_template('index.html', pool=pool)
        else:
            flash("You don't have access to this pool", "error")
            return redirect(url_for('pools'))
    
    # If user is logged in but no pool is selected, show pool selection
    if not session.get('current_pool_id'):
        return redirect(url_for('pools'))
    
    # Verify user still has access to the selected pool
    if current_user.is_admin():
        pool = get_pool(session['current_pool_id'])
    else:
        pool = get_pool(session['current_pool_id'], current_user.id)
    
    if not pool:
        del session['current_pool_id']
        return redirect(url_for('pools'))
    
    return render_template('index.html', pool=pool)

@app.route('/api/status')
def status():
    """Get the current system status."""
    simulation_mode = app.config.get('SIMULATION_MODE', True)
    return jsonify({
        "status": "ok",
        "simulation_mode": simulation_mode,
        "version": "0.1.0",
        "environment": app.config.get('FLASK_ENV')
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
@login_required
@rate_limit('api_general')
def dashboard_data():
    """Get all dashboard data for the current pool."""
    try:
        pool_id = session.get('current_pool_id')
        
        if not pool_id:
            logger.error(f"No pool selected in session. Session keys: {list(session.keys())}")
            return jsonify({"error": "No pool selected"}), 400
        
        # Check if user has access to this pool
        with sqlite3.connect(app.config['DATABASE_PATH']) as conn:
            cursor = conn.cursor()
            
            # Admin can access any pool
            if current_user.is_admin():
                cursor.execute("SELECT id FROM pools WHERE id = ?", (pool_id,))
            else:
                # Regular users access through customer relationship
                cursor.execute("""
                    SELECT p.id FROM pools p
                    JOIN customers c ON p.customer_id = c.id
                    WHERE p.id = ? AND c.user_id = ?
                """, (pool_id, current_user.id))
            
            pool = cursor.fetchone()
            
            if not pool:
                return jsonify({"error": "Pool not found or access denied"}), 404

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
    except Exception as e:
        logger.error(f"Error in dashboard_data: {str(e)}")
        return jsonify({"error": "Internal server error", "message": str(e)}), 500
    
# Update your control_pac_pump endpoint to use emit_system_event
@app.route('/api/pumps/pac', methods=['POST'])
@secure_api_endpoint(require_pool=True, audit_action='pump_control')
@rate_limit('pump_control', auto_block=True, block_duration=300)  # Auto-block for 5 minutes
@validate_request_json(SCHEMAS['pump_control'])
def control_pac_pump():
    """Control the PAC dosing pump."""
    data = request.validated_data
    command = data['command']
    
    try:
        if command == 'start':
            duration = data.get('duration', 30)
            flow_rate = data.get('flow_rate')
            
            # Validate pump control parameters
            validated_duration, validated_flow_rate = validate_pump_control(
                'pac', duration, flow_rate
            )
            
            if validated_flow_rate:
                mock_pac_pump.set_flow_rate(validated_flow_rate)
            
            success = mock_pac_pump.start(duration=validated_duration)
            
            # Emit system event
            emit_system_event('pac_pump_started', 
                            f"PAC pump started manually for {validated_duration}s at {mock_pac_pump.get_flow_rate()} mL/h")
            
            return jsonify({
                "success": success,
                "message": f"PAC pump started for {validated_duration} seconds at {mock_pac_pump.get_flow_rate()} ml/h"
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
            
            # Validate flow rate
            _, validated_flow_rate = validate_pump_control('pac', None, flow_rate)
            
            success = mock_pac_pump.set_flow_rate(validated_flow_rate)
            
            # Emit system event
            emit_system_event('pac_flow_rate_changed', f"PAC pump flow rate set to {validated_flow_rate} mL/h")
            
            return jsonify({
                "success": success,
                "message": f"PAC pump flow rate set to {validated_flow_rate} ml/h"
            })
        
        else:
            return jsonify({"error": "Invalid command"}), 400
    except Exception as e:
        error_details = handle_exception(e, "controlling PAC pump")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/pumps/ph', methods=['POST'])
@secure_api_endpoint(require_pool=True, audit_action='pump_control')
@rate_limit('pump_control', auto_block=True, block_duration=300)
@validate_request_json(SCHEMAS['pump_control'])
def control_ph_pump():
    """Control the pH dosing pump."""
    data = request.validated_data
    command = data['command']
    
    try:
        if command == 'start':
            duration = data.get('duration', 30)
            
            # Validate pump control parameters
            validated_duration, _ = validate_pump_control('ph', duration, None)
            
            # For pH pump, we'll simulate starting it through the simulator
            simulator.set_pump_state('acid', True)
            
            # Emit system event
            emit_system_event('ph_pump_started', f"pH pump started manually for {validated_duration}s")
            
            return jsonify({
                "success": True,
                "message": f"pH pump started for {validated_duration} seconds"
            })
        
        elif command == 'stop':
            # Stop pH pump
            simulator.set_pump_state('acid', False)
            
            # Emit system event
            emit_system_event('ph_pump_stopped', "pH pump stopped manually")
            
            return jsonify({
                "success": True,
                "message": "pH pump stopped"
            })
        
        else:
            return jsonify({"error": "Invalid command"}), 400
    except Exception as e:
        error_details = handle_exception(e, "controlling pH pump")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/pumps/chlorine', methods=['POST'])
@secure_api_endpoint(require_pool=True, audit_action='pump_control')
@rate_limit('pump_control', auto_block=True, block_duration=300)
@validate_request_json(SCHEMAS['pump_control'])
def control_chlorine_pump():
    """Control the chlorine dosing pump."""
    data = request.validated_data
    command = data['command']
    
    try:
        if command == 'start':
            duration = data.get('duration', 30)
            
            # Validate pump control parameters
            validated_duration, _ = validate_pump_control('chlorine', duration, None)
            
            # For chlorine pump, we'll simulate starting it through the simulator
            simulator.set_pump_state('chlorine', True)
            
            # Emit system event
            emit_system_event('chlorine_pump_started', f"Chlorine pump started manually for {validated_duration}s")
            
            return jsonify({
                "success": True,
                "message": f"Chlorine pump started for {validated_duration} seconds"
            })
        
        elif command == 'stop':
            # Stop chlorine pump
            simulator.set_pump_state('chlorine', False)
            
            # Emit system event
            emit_system_event('chlorine_pump_stopped', "Chlorine pump stopped manually")
            
            return jsonify({
                "success": True,
                "message": "Chlorine pump stopped"
            })
        
        else:
            return jsonify({"error": "Invalid command"}), 400
    except Exception as e:
        error_details = handle_exception(e, "controlling chlorine pump")
        return jsonify({"error": error_details["error"]}), 500
    
@app.route('/api/simulator/control', methods=['POST'])
def control_simulator():
    """Control the system simulator."""
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    data = request.json
    command = data.get('command')
    
    try:
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
    except Exception as e:
        error_details = handle_exception(e, "controlling simulator")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/history/turbidity')
def turbidity_history():
    """Get historical turbidity data for charts."""
    try:
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
    except Exception as e:
        error_details = handle_exception(e, "retrieving turbidity history")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/history/parameters')
@rate_limit('history_request')
def parameter_history():
    """Get historical data for multiple parameters."""
    try:
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
    except Exception as e:
        error_details = handle_exception(e, "retrieving parameter history")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/history/events')
def events_history():
    """Get system and dosing events history."""
    try:
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
    except Exception as e:
        error_details = handle_exception(e, "retrieving events history")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/dosing/status')
def dosing_status():
    """Get the current status of the dosing controller."""
    try:
        if not dosing_controller:
            return jsonify({"error": "Dosing controller not initialized"}), 500
        return jsonify(dosing_controller.get_status())
    except Exception as e:
        error_details = handle_exception(e, "getting dosing status")
        return jsonify({"error": error_details["error"]}), 500

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
    
    try:
        dosing_controller.set_mode(mode)
        
        # Use the new emit function instead of direct socketio.emit
        emit_dosing_update('mode_changed')
        
        # Log the event
        emit_system_event('dosing_mode_changed', f"Dosing mode changed to {mode_str}")
        
        return jsonify({"success": True, "mode": mode_str})
    except Exception as e:
        error_details = handle_exception(e, "setting dosing mode")
        return jsonify({"error": error_details["error"]}), 500

# Add health check route for Socket.IO
@app.route('/socket.io-test')
def socket_io_test():
    return jsonify({"status": "Socket.IO server is running", 
                    "async_mode": socketio.async_mode})

@app.route('/api/rate-limit-status')
@rate_limit('api_general')
def rate_limit_status():
    """Get rate limiting status for debugging (development only)"""
    if not app.config.get('DEBUG', False):
        return jsonify({"error": "Not available in production"}), 403
    
    limit_type = request.args.get('type', 'api_general')
    status = get_rate_limit_status(limit_type)
    return jsonify(status)

# Update your manual_dosing endpoint to use the emit functions
@app.route('/api/dosing/manual', methods=['POST'])
@secure_api_endpoint(require_pool=True, audit_action='manual_dosing')
@rate_limit('dosing_control', auto_block=True, block_duration=600)  # Auto-block for 10 minutes  
@validate_request_json(SCHEMAS['pac_dosing'])
def manual_dosing():
    """Trigger manual dosing."""
    data = request.validated_data
    duration = data['duration']
    flow_rate = data['flow_rate']
    
    try:
        # Additional validation for PAC dosing
        validated_duration, validated_flow_rate = validate_pump_control('pac', duration, flow_rate)
        
        success = dosing_controller.manual_dose(validated_duration, validated_flow_rate)
        
        if success:
            # Get current turbidity for the event
            current_turbidity = mock_turbidity_sensor.get_reading()
            
            # Emit dosing update
            emit_dosing_update('manual_dose_started', {
                'duration': validated_duration,
                'flow_rate': validated_flow_rate
            })
            
            # Emit system event
            event_desc = f"Manual dosing started (duration: {validated_duration}s, flow rate: {validated_flow_rate} mL/h)"
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
    except Exception as e:
        error_details = handle_exception(e, "triggering manual dosing")
        return jsonify({"error": error_details["error"]}), 500
    
@app.route('/api/dosing/reset-pid', methods=['POST'])
def reset_pid():
    """Reset the PID controller."""
    try:
        if dosing_controller:
            success = dosing_controller.reset_pid()
            emit_system_event('pid_reset', "PID controller reset")
            return jsonify({"success": success})
        return jsonify({"error": "Dosing controller not initialized"}), 500
    except Exception as e:
        error_details = handle_exception(e, "resetting PID controller")
        return jsonify({"error": error_details["error"]}), 500

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
        error_details = handle_exception(e, "initializing database")
        return jsonify({"success": False, "message": error_details["error"]}), 500
    
# Add to app.py
@app.route('/api/notifications/settings', methods=['POST'])
def update_notification_settings():
    """Update notification settings."""
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    data = request.json
    
    try:
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
    except Exception as e:
        error_details = handle_exception(e, "updating notification settings")
        return jsonify({"error": error_details["error"]}), 500

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
        error_details = handle_exception(e, "sending test notification")
        return jsonify({
            "success": False,
            "message": error_details["error"]
        }), 500

def send_notification(email, subject, message):
    """Send an email notification."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    # Get email settings from config
    smtp_server = app.config.get('SMTP_SERVER', '')
    smtp_port = app.config.get('SMTP_PORT', 587)
    smtp_user = app.config.get('SMTP_USERNAME', '')
    smtp_pass = app.config.get('SMTP_PASSWORD', '')
    
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
    try:
        if simulator:
            events = simulator.get_recent_events(10)
            return jsonify(events)
        return jsonify({"error": "Simulator not initialized"}), 500
    except Exception as e:
        error_details = handle_exception(e, "getting simulator events")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/simulator/trigger-event', methods=['POST'])
def trigger_simulator_event():
    """Manually trigger a simulator event."""
    try:
        data = request.json or {}
        event_type = data.get('type')
        
        if simulator:
            success = simulator.trigger_event(event_type)
            return jsonify({"success": success})
        return jsonify({"error": "Simulator not initialized"}), 500
    except Exception as e:
        error_details = handle_exception(e, "triggering simulator event")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/dosing/schedule', methods=['POST'])
def schedule_dose():
    """Schedule a future dose."""
    try:
        data = request.json or {}
        timestamp = data.get('timestamp')
        duration = data.get('duration')
        flow_rate = data.get('flow_rate')
        
        if dosing_controller:
            success = dosing_controller.schedule_dose(timestamp, duration, flow_rate)
            return jsonify({"success": success})
        return jsonify({"error": "Dosing controller not initialized"}), 500
    except Exception as e:
        error_details = handle_exception(e, "scheduling dose")
        return jsonify({"error": error_details["error"]}), 500

@app.route('/api/dosing/scheduled', methods=['GET'])
def get_scheduled_doses():
    """Get scheduled doses."""
    try:
        if dosing_controller:
            scheduled = dosing_controller.get_scheduled_doses()
            return jsonify(scheduled)
        return jsonify({"error": "Dosing controller not initialized"}), 500
    except Exception as e:
        error_details = handle_exception(e, "getting scheduled doses")
        return jsonify({"error": error_details["error"]}), 500

# WebSocket room management
@socketio.on('join')
def on_join(data):
    """Join a room for a specific pool."""
    if not current_user.is_authenticated:
        logger.warning(f"Unauthenticated client {request.sid} attempted to join a pool room")
        return {'error': 'Authentication required', 'status': 'error'}
    
    pool_id = data.get('pool_id')
    
    if not pool_id:
        return {'error': 'Pool ID required', 'status': 'error'}
    
    try:
        # Verify user has access to this pool
        pool = get_pool(pool_id, current_user.id)
        
        if not pool:
            logger.warning(f"User {current_user.id} attempted to access unauthorized pool {pool_id}")
            return {'error': 'Access denied', 'status': 'error'}
        
        # Join the room for this pool
        join_room(pool_id)
        logger.info(f"User {current_user.id} joined room for pool {pool_id}")
        emit('room_joined', {'pool_id': pool_id, 'status': 'connected'})
    except Exception as e:
        handle_exception(e, "joining room")
        return {'error': 'Server error', 'status': 'error'}

@app.route('/api/history/parameters')
@login_required
@rate_limit('history_request')
def get_parameter_history():
    """Get historical parameter data."""
    try:
        # Get query parameters
        hours = request.args.get('hours', '24')
        try:
            hours = int(hours)
        except ValueError:
            hours = 24
        
        # Generate simulated historical data for now
        # In a real implementation, this would query the database
        current_time = time.time()
        data_points = []
        
        # Generate data points every 5 minutes for the requested period
        interval = 300  # 5 minutes in seconds
        num_points = (hours * 3600) // interval
        
        for i in range(num_points):
            timestamp = current_time - (i * interval)
            
            # Get current parameters and add some variation for history
            if simulator:
                params = simulator.get_all_parameters()
                # Add some historical variation
                variation = (i % 20) / 100  # Small cyclical variation
                
                data_points.append({
                    'timestamp': timestamp,
                    'ph': round(params['ph'] + (variation * 0.2), 2),
                    'orp': round(params['orp'] + (variation * 20), 0),
                    'freeChlorine': round(params['free_chlorine'] + (variation * 0.1), 2),
                    'combinedChlorine': round(params['combined_chlorine'] + (variation * 0.05), 2),
                    'turbidity': round(params['turbidity'] + (variation * 0.02), 3),
                    'temperature': round(params['temperature'] + (variation * 1.0), 1)
                })
        
        # Sort by timestamp (oldest first)
        data_points.sort(key=lambda x: x['timestamp'])
        
        return jsonify({
            'success': True,
            'data': data_points,
            'hours': hours,
            'count': len(data_points)
        })
        
    except Exception as e:
        error_details = handle_exception(e, "getting parameter history")
        return jsonify({"error": error_details["error"]}), 500

# WebSocket events
@socketio.on('connect')
def handle_connect():
    """Handle Socket.IO connection with authentication."""
    if not current_user.is_authenticated:
        # Anonymous access allowed for now, but could be restricted
        logger.info(f"Anonymous client connected: {request.sid}")
    else:
        logger.info(f"Authenticated client connected: {request.sid}, user: {current_user.id}")
    
    # Send initial data upon connection
    socketio.emit('connection_confirmed', {
        'status': 'connected',
        'clientId': request.sid,
        'authenticated': current_user.is_authenticated
    }, to=request.sid)
    
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
    
    try:
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
    except Exception as e:
        handle_exception(e, "handling system state request")

# Main entry point
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug_mode = app.config.get('DEBUG', False)
    logger.info(f"Starting application on port {port} with debug={debug_mode}")
    socketio.run(app, host='0.0.0.0', port=port, debug=debug_mode)