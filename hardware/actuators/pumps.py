# hardware/actuators/pumps.py
import logging
import time
import random
import threading

logger = logging.getLogger(__name__)

class Pump:
    """Base class for dosing pumps."""
    
    def __init__(self, config=None):
        self.config = config or {}
        self.running = False
        self.start_time = None
        self.duration = 0
        self.flow_rate = 0  # ml/min
        self.min_flow_ml_h = self.config.get('min_flow_ml_h', 60)  # Default min flow rate ml/h
        self.max_flow_ml_h = self.config.get('max_flow_ml_h', 150)  # Default max flow rate ml/h
    
    def start(self, duration=30):
        """Start the pump for a specified duration in seconds."""
        raise NotImplementedError("Subclasses must implement start()")
    
    def stop(self):
        """Stop the pump."""
        raise NotImplementedError("Subclasses must implement stop()")
    
    def is_running(self):
        """Check if the pump is running."""
        return self.running
    
    def get_flow_rate(self):
        """Get the current flow rate in ml/min."""
        return self.flow_rate
    
    def set_flow_rate(self, flow_rate_ml_h):
        """Set the flow rate in ml/h."""
        # Convert ml/h to ml/min
        flow_rate_ml_min = flow_rate_ml_h / 60.0
        
        # Ensure flow rate is within limits
        if flow_rate_ml_h < self.min_flow_ml_h:
            flow_rate_ml_h = self.min_flow_ml_h
            flow_rate_ml_min = flow_rate_ml_h / 60.0
        elif flow_rate_ml_h > self.max_flow_ml_h:
            flow_rate_ml_h = self.max_flow_ml_h
            flow_rate_ml_min = flow_rate_ml_h / 60.0
        
        self.flow_rate = flow_rate_ml_min
        return True

class ChonryPump(Pump):
    """Interface for Chonry WP110 peristaltic pump via GPIO."""
    
    def __init__(self, config):
        super().__init__(config)
        self.control_pin = config.get('control_pin', 17)  # GPIO pin for pump control
        self.timer = None
        
        # Try to import GPIO library
        try:
            import RPi.GPIO as GPIO
            self.GPIO = GPIO
            
            # Set up GPIO
            self.GPIO.setmode(self.GPIO.BCM)
            self.GPIO.setup(self.control_pin, self.GPIO.OUT)
            self.GPIO.output(self.control_pin, self.GPIO.LOW)  # Ensure pump is off
            logger.info(f"Initialized Chonry pump on GPIO pin {self.control_pin}")
        except ImportError:
            logger.warning("RPi.GPIO library not available - pump will operate in simulation mode")
            self.GPIO = None
    
    def start(self, duration=30):
        """Start the pump for a specified duration in seconds."""
        if self.running:
            logger.warning("Pump already running. Stopping current operation before starting new one.")
            self.stop()
        
        try:
            # Start the pump
            if self.GPIO:
                self.GPIO.output(self.control_pin, self.GPIO.HIGH)
            
            self.running = True
            self.start_time = time.time()
            self.duration = duration
            
            # Set a timer to stop the pump after the duration
            if self.timer:
                self.timer.cancel()
            
            self.timer = threading.Timer(duration, self.stop)
            self.timer.daemon = True
            self.timer.start()
            
            logger.info(f"Started pump for {duration} seconds at {self.flow_rate:.2f} ml/min")
            return True
        
        except Exception as e:
            logger.error(f"Error starting pump: {e}")
            return False
    
    def stop(self):
        """Stop the pump."""
        if not self.running:
            return True
        
        try:
            # Stop the pump
            if self.GPIO:
                self.GPIO.output(self.control_pin, self.GPIO.LOW)
            
            self.running = False
            
            # Cancel the timer if it exists
            if self.timer:
                self.timer.cancel()
                self.timer = None
            
            logger.info("Stopped pump")
            return True
        
        except Exception as e:
            logger.error(f"Error stopping pump: {e}")
            return False
    
    def cleanup(self):
        """Clean up GPIO resources."""
        if self.GPIO:
            self.GPIO.cleanup(self.control_pin)
            logger.info("Cleaned up GPIO resources for pump")

class MockPump(Pump):class MockPump(Pump):
    """Mock implementation for simulation mode."""
    
    def __init__(self, config=None, pump_type='pac', simulation_env=None):
        super().__init__(config)
        self.timer = None
        self.pump_type = pump_type
        self.simulation_env = simulation_env
    
    def start(self, duration=30):
        """Simulate starting the pump."""
        if self.running:
            logger.warning("Mock pump already running. Stopping current operation before starting new one.")
            self.stop()
        
        self.running = True
        self.start_time = time.time()
        self.duration = duration
        
        # Interact with simulation environment if available
        if self.simulation_env:
            flow_rate = self.flow_rate * 60  # Convert to ml/h
            self.simulation_env.simulate_dosing(self.pump_type, duration, flow_rate)
        
        # Set a timer to stop the pump after the duration
        if self.timer:
            self.timer.cancel()
        
        self.timer = threading.Timer(duration, self.stop)
        self.timer.daemon = True
        self.timer.start()
        
        logger.info(f"Started mock pump for {duration} seconds at {self.flow_rate:.2f} ml/min")
        return True
    
    def stop(self):
        """Simulate stopping the pump."""
        if not self.running:
            return True
        
        self.running = False
        
        # Cancel the timer if it exists
        if self.timer:
            self.timer.cancel()
            self.timer = None
        
        logger.info("Stopped mock pump")
        return True
    """Mock implementation for simulation mode."""
    
    def __init__(self, config=None):
        super().__init__(config)
        self.timer = None
    
    def start(self, duration=30):
        """Simulate starting the pump."""
        if self.running:
            logger.warning("Mock pump already running. Stopping current operation before starting new one.")
            self.stop()
        
        self.running = True
        self.start_time = time.time()
        self.duration = duration
        
        # Set a timer to stop the pump after the duration
        if self.timer:
            self.timer.cancel()
        
        self.timer = threading.Timer(duration, self.stop)
        self.timer.daemon = True
        self.timer.start()
        
        logger.info(f"Started mock pump for {duration} seconds at {self.flow_rate:.2f} ml/min")
        return True
    
    def stop(self):
        """Simulate stopping the pump."""
        if not self.running:
            return True
        
        self.running = False
        
        # Cancel the timer if it exists
        if self.timer:
            self.timer.cancel()
            self.timer = None
        
        logger.info("Stopped mock pump")
        return True