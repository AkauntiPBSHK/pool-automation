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
        logging.StreamHandler(),
        logging.FileHandler('pool_automation.log')
    ]
)
logger = logging.getLogger(__name__)

# Import our modules
from config import settings
from models import db, init_db, SensorReading, DosingEvent, SystemEvent
from hardware import initialize_hardware
from services.dosing import DosingController, DosingMode
from services.notification import NotificationManager
from api.history import history_api

# Initialize Flask app
app = Flask(__name__,
    static_folder='static',
    template_folder='templates')

# Configure the app
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'pool_automation_secret')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///pool_automation.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Register blueprints
app.register_blueprint(history_api)

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

# System class
class PoolAutomationSystem:
    """Main system class for pool automation."""
    
    def __init__(self, simulation_mode=False):
        """Initialize the pool automation system."""
        # Set simulation mode
        self.simulation_mode = simulation_mode or settings.get('system.simulation_mode', False)
        
        # Initialize notification manager
        self.notification_manager = NotificationManager(
            settings.get('notifications', {})
        )
        
        # Initialize hardware
        self.hardware = initialize_hardware()
        
        # Store components
        self.sensors = self.hardware['sensors']
        self.actuators = self.hardware['actuators']
        self.controllers = self.hardware['controllers']
        
        # Initialize controllers
        self._init_controllers()
        
        # System state
        self.system_state = {
            "ph": 7.4,
            "orp": 720,
            "freeChlorine": 1.2,
            "combinedChlorine": 0.2,
            "turbidity": self.sensors.get('turbidity').get_reading() if 'turbidity' in self.sensors else 0.14,
            "temperature": 28.2,
            "uvIntensity": 94,
            "phPumpRunning": False,
            "clPumpRunning": False,
            "pacPumpRunning": self.actuators.get('pac_pump').is_running() if 'pac_pump' in self.actuators else False,
            "pacDosingRate": self.actuators.get('pac_pump').get_flow_rate() * 60 if 'pac_pump' in self.actuators else 75,
            "version": "0.1.0",
            "simulation_mode": self.simulation_mode
        }
        
        # Variables for main loop
        self.running = False
        self.main_thread = None
        
        logger.info(f"Pool automation system initialized (simulation: {self.simulation_mode})")
    
    def _init_controllers(self):
        """Initialize system controllers."""
        # Initialize dosing controller
        if 'turbidity' in self.sensors and 'pac_pump' in self.actuators:
            self.dosing_controller = DosingController(
                self.sensors['turbidity'],
                self.actuators['pac_pump'],
                settings.get('dosing', {}),
                self
            )
            logger.info("Dosing controller initialized")
        else:
            logger.error("Failed to initialize dosing controller - missing hardware components")
            self.dosing_controller = None
        
        # Store controllers in a dictionary
        self.controllers['dosing'] = self.dosing_controller
    
    def start(self):
        """Start the system."""
        if self.running:
            logger.warning("System already running")
            return False
        
        self.running = True
        
        # Start the main loop in a separate thread
        self.main_thread = threading.Thread(target=self._main_loop, daemon=True)
        self.main_thread.start()
        
        # Set dosing controller to AUTO mode if not in simulation mode
        if self.dosing_controller and not self.simulation_mode:
            self.dosing_controller.set_mode(DosingMode.AUTO)
        
        logger.info("System started")
        
        # Add system start event
        SystemEvent.add_event(
            'info',
            f"System started in {'SIMULATION' if self.simulation_mode else 'PRODUCTION'} mode"
        )
        
        return True
    
    def stop(self):
        """Stop the system."""
        if not self.running:
            logger.warning("System not running")
            return False
        
        self.running = False
        
        # Stop all pumps
        for name, pump in self.actuators.items():
            if pump.is_running():
                pump.stop()
                logger.info(f"Stopped {name}")
        
        # Wait for main thread to finish
        if self.main_thread and self.main_thread.is_alive():
            self.main_thread.join(timeout=2.0)
        
        logger.info("System stopped")
        
        # Add system stop event
        SystemEvent.add_event('info', "System stopped")
        
        return True
    
    def _main_loop(self):
        """Main processing loop."""
        logger.info("Main processing loop started")
        
        update_interval = 1.0  # seconds
        sensor_log_interval = 60.0  # log data every minute
        last_sensor_log_time = 0.0
        
        while self.running:
            try:
                current_time = time.time()
                
                # Update controllers
                if self.dosing_controller:
                    self.dosing_controller.update()
                
                # Update system state
                self._update_system_state()
                
                # Log sensor data periodically
                if current_time - last_sensor_log_time >= sensor_log_interval:
                    self._log_sensor_data()
                    last_sensor_log_time = current_time
                
                # Sleep for the update interval
                time.sleep(update_interval)
                
            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)
                time.sleep(1.0)  # Sleep briefly before retrying
    
    def _update_system_state(self):
        """Update the system state with current values."""
        # Update from turbidity sensor
        if 'turbidity' in self.sensors:
            self.system_state["turbidity"] = self.sensors['turbidity'].get_reading()
        
        # Update from PAC pump
        if 'pac_pump' in self.actuators:
            self.system_state["pacPumpRunning"] = self.actuators['pac_pump'].is_running()
            self.system_state["pacDosingRate"] = self.actuators['pac_pump'].get_flow_rate() * 60
        
        # Update from Steiel controller
        if 'steiel' in self.controllers:
            steiel_readings = self.controllers['steiel'].get_readings()
            if steiel_readings:
                self.system_state["ph"] = steiel_readings.get('ph', self.system_state["ph"])
                self.system_state["orp"] = steiel_readings.get('orp', self.system_state["orp"])
                self.system_state["freeChlorine"] = steiel_readings.get('free_cl', self.system_state["freeChlorine"])
                self.system_state["combinedChlorine"] = steiel_readings.get('comb_cl', self.system_state["combinedChlorine"])
                self.system_state["phPumpRunning"] = steiel_readings.get('acid_pump_status', self.system_state["phPumpRunning"])
                self.system_state["clPumpRunning"] = steiel_readings.get('cl_pump_status', self.system_state["clPumpRunning"])
        
        # Emit state via WebSocket
        socketio.emit('system_state', self.system_state)
    
    def _log_sensor_data(self):
        """Log sensor data to database."""
        try:
            # Log turbidity
            if 'turbidity' in self.sensors:
                reading = SensorReading(
                    sensor_type='turbidity',
                    value=self.system_state["turbidity"],
                    unit='NTU',
                    status=self._get_status('turbidity', self.system_state["turbidity"])
                )
                db.session.add(reading)
            
            # Log other parameters if Steiel controller is available
            if 'steiel' in self.controllers:
                # pH
                reading = SensorReading(
                    sensor_type='ph',
                    value=self.system_state["ph"],
                    unit='pH',
                    status=self._get_status('ph', self.system_state["ph"])
                )
                db.session.add(reading)
                
                # ORP
                reading = SensorReading(
                    sensor_type='orp',
                    value=self.system_state["orp"],
                    unit='mV',
                    status=self._get_status('orp', self.system_state["orp"])
                )
                db.session.add(reading)
                
                # Free chlorine
                reading = SensorReading(
                    sensor_type='free_chlorine',
                    value=self.system_state["freeChlorine"],
                    unit='mg/L',
                    status=self._get_status('free_chlorine', self.system_state["freeChlorine"])
                )
                db.session.add(reading)
                
                # Combined chlorine
                reading = SensorReading(
                    sensor_type='combined_chlorine',
                    value=self.system_state["combinedChlorine"],
                    unit='mg/L',
                    status=self._get_status('combined_chlorine', self.system_state["combinedChlorine"])
                )
                db.session.add(reading)
            
            # Commit all readings
            db.session.commit()
            logger.debug("Sensor data logged")
            
        except Exception as e:
            logger.error(f"Error logging sensor data: {e}")
            db.session.rollback()
    
    def _get_status(self, parameter, value):
        """Determine the status of a parameter based on its value."""
        if parameter == 'ph':
            if 7.2 <= value <= 7.6:
                return 'good'
            elif 6.8 <= value < 7.2 or 7.6 < value <= 8.0:
                return 'fair'
            else:
                return 'poor'
        
        elif parameter == 'orp':
            if 650 <= value <= 750:
                return 'good'
            elif 600 <= value < 650 or 750 < value <= 800:
                return 'fair'
            else:
                return 'poor'
        
        elif parameter == 'free_chlorine':
            if 1.0 <= value <= 2.0:
                return 'good'
            elif 0.5 <= value < 1.0 or 2.0 < value <= 3.0:
                return 'fair'
            else:
                return 'poor'
        
        elif parameter == 'combined_chlorine':
            if value <= 0.3:
                return 'good'
            elif 0.3 < value <= 0.5:
                return 'fair'
            else:
                return 'poor'
        
        elif parameter == 'turbidity':
            if 0.12 <= value <= 0.25:
                return 'good'
            elif 0.05 <= value < 0.12 or 0.25 < value <= 0.3:
                return 'fair'
            else:
                return 'poor'
        
        # Default
        return 'unknown'

# Initialize system
system = PoolAutomationSystem(simulation_mode=args.simulate)

# Routes
@app.route('/')
def index():
    """Render the main dashboard page."""
    return render_template('index.html')

@app.route('/api/status')
def status():
    """Get current system status."""
    return jsonify({
        "status": "ok" if system.running else "stopped",
        "simulation_mode": system.simulation_mode,
        "version": system.system_state["version"]
    })

@app.route('/api/dashboard')
def dashboard():
    """Get current dashboard data."""
    return jsonify(system.system_state)

@app.route('/api/turbidity')
def turbidity():
    """Get turbidity data."""
    if 'turbidity' not in system.sensors:
        return jsonify({"error": "Turbidity sensor not available"}), 503
    
    sensor = system.sensors['turbidity']
    
    data = {
        "current": sensor.get_reading(),
        "average": sensor.get_moving_average()
    }
    
    # Add dosing controller data if available
    if system.dosing_controller:
        dosing_status = system.dosing_controller.get_status()
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
    if not system.dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    return jsonify(system.dosing_controller.get_status())

@app.route('/api/dosing/mode', methods=['POST'])
def set_dosing_mode():
    """Set the dosing mode."""
    if not system.dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    data = request.json
    mode = data.get('mode')
    
    if not mode:
        return jsonify({"error": "Mode parameter is required"}), 400
    
    try:
        result = system.dosing_controller.set_mode(mode)
        if result:
            # Add event
            SystemEvent.add_event(
                'info',
                f"Dosing mode changed to {mode.upper()}",
                'dosing_mode',
                mode
            )
            
            return jsonify({"success": True, "mode": system.dosing_controller.get_mode().name})
        else:
            return jsonify({"error": f"Failed to set mode to {mode}"}), 400
    except Exception as e:
        logger.error(f"Error setting dosing mode: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/dosing/start', methods=['POST'])
def start_dosing():
    """Start manual dosing."""
    if not system.dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    data = request.json
    flow_rate = float(data.get('flow_rate', 75))  # ml/h
    duration = int(data.get('duration', 30))  # seconds
    
    # Set to manual mode first
    system.dosing_controller.set_mode(DosingMode.MANUAL)
    
    # Start dosing
    result = system.dosing_controller.manual_dose(flow_rate, duration)
    
    if result:
        # Notify clients
        socketio.emit('dosing_event', {
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
    if not system.dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    result = system.dosing_controller.stop_dosing()
    
    if result:
        # Notify clients
        socketio.emit('dosing_event', {
            'pump': 'pac',
            'status': False
        })
        
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Failed to stop dosing"}), 500

@app.route('/api/dosing/thresholds', methods=['POST'])
def set_dosing_thresholds():
    """Set dosing thresholds."""
    if not system.dosing_controller:
        return jsonify({"error": "Dosing controller not available"}), 503
    
    data = request.json
    high_threshold = data.get('high_threshold')
    low_threshold = data.get('low_threshold')
    target = data.get('target')
    
    if not any([high_threshold, low_threshold, target]):
        return jsonify({"error": "At least one threshold parameter is required"}), 400
    
    try:
        # Convert string values to float if needed
        if high_threshold is not None:
            high_threshold = float(high_threshold)
        if low_threshold is not None:
            low_threshold = float(low_threshold)
        if target is not None:
            target = float(target)
        
        result = system.dosing_controller.set_thresholds(
            high_threshold=high_threshold,
            low_threshold=low_threshold,
            target=target
        )
        
        # Add event
        SystemEvent.add_event(
            'info',
            f"Dosing thresholds updated: high={result['high_threshold']}, low={result['low_threshold']}, target={result['target']}",
            'dosing_thresholds',
            f"{result['low_threshold']}-{result['high_threshold']}"
        )
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error setting dosing thresholds: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Get current settings."""
    # Filter out sensitive information
    filtered_settings = {
        'system': settings.get('system'),
        'dosing': settings.get('dosing'),
        'network': {
            'enable_api': settings.get('network.enable_api'),
            'api_port': settings.get('network.api_port')
        },
        'notifications': {
            'enabled': settings.get('notifications.enabled'),
            'email': {
                'enabled': settings.get('notifications.email.enabled'),
                'smtp_server': settings.get('notifications.email.smtp_server'),
                'smtp_port': settings.get('notifications.email.smtp_port'),
                'use_tls': settings.get('notifications.email.use_tls'),
                'username': settings.get('notifications.email.username'),
                # Password is not included for security
                'from_address': settings.get('notifications.email.from_address'),
                'to_address': settings.get('notifications.email.to_address')
            }
        }
    }
    
    return jsonify(filtered_settings)

@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Update settings."""
    data = request.json
    updated = []
    
    try:
        # Update settings
        for section in data:
            if isinstance(data[section], dict):
                for key, value in data[section].items():
                    path = f"{section}.{key}"
                    if settings.set(path, value):
                        updated.append(path)
            else:
                path = section
                if settings.set(path, data[section]):
                    updated.append(path)
        
        # Save settings
        settings.save_settings()
        
        # Add event
        SystemEvent.add_event(
            'info',
            f"Settings updated: {', '.join(updated)}",
            'settings',
            'updated'
        )
        
        return jsonify({"success": True, "updated": updated})
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        return jsonify({"error": str(e)}), 500

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    logger.info('Client connected')
    socketio.emit('system_state', system.system_state)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    logger.info('Client disconnected')

# Main entry point
if __name__ == '__main__':
    # Start the system
    system.start()
    
    try:
        # Start the web server
        logger.info(f"Starting web server on port {settings.get('network.api_port', 5000)}")
        socketio.run(app, 
                    debug=not settings.get('system.production_mode', False),
                    host='0.0.0.0', 
                    port=settings.get('network.api_port', 5000))
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, shutting down")
        system.stop()
    except Exception as e:
        logger.error(f"Error starting web server: {e}")
        system.stop()