"""Mock actuators for simulation mode."""
import time
import logging
import threading

logger = logging.getLogger(__name__)

class MockPump:
    """Mock implementation of a dosing pump."""
    
    def __init__(self, config):
        """Initialize the mock pump."""
        self.config = config
        self.connected = True
        self.running = False
        self.flow_rate = 0.0  # ml/min
        self.direction = 'forward'
        self.start_time = None
        self.stop_time = None
        self.thread = None
        self.run_duration = 0  # seconds
        
        # Extract flow rate limits from config
        self.min_flow_ml_h = float(config.get('min_flow_ml_h', 60))
        self.max_flow_ml_h = float(config.get('max_flow_ml_h', 150))
        
        logger.info("Mock pump initialized")
    
    def start(self, duration=None):
        """Start the pump for a specified duration (in seconds)."""
        if self.running:
            logger.warning("Pump already running, ignoring start command")
            return False
        
        self.running = True
        self.start_time = time.time()
        
        if duration:
            self.run_duration = duration
            self.thread = threading.Thread(target=self._auto_stop, daemon=True)
            self.thread.start()
            logger.info(f"Pump started for {duration} seconds at {self.flow_rate:.1f} ml/min")
        else:
            self.run_duration = 0
            logger.info(f"Pump started at {self.flow_rate:.1f} ml/min")
        
        return True
    
    def stop(self):
        """Stop the pump."""
        if not self.running:
            logger.warning("Pump already stopped, ignoring stop command")
            return False
        
        self.running = False
        self.stop_time = time.time()
        
        if self.start_time:
            runtime = self.stop_time - self.start_time
            logger.info(f"Pump stopped after running for {runtime:.1f} seconds")
        else:
            logger.info("Pump stopped")
        
        return True
    
    def _auto_stop(self):
        """Automatically stop the pump after the duration."""
        if self.run_duration <= 0:
            return
        
        time.sleep(self.run_duration)
        
        if self.running:
            self.stop()
    
    def set_flow_rate(self, flow_rate_ml_min):
        """Set the flow rate in ml/min."""
        # Convert to ml/h for comparison with limits
        flow_rate_ml_h = flow_rate_ml_min * 60
        
        # Ensure flow rate is within limits
        if flow_rate_ml_h < self.min_flow_ml_h:
            flow_rate_ml_h = self.min_flow_ml_h
            logger.warning(f"Flow rate adjusted to minimum: {self.min_flow_ml_h:.1f} ml/h")
        elif flow_rate_ml_h > self.max_flow_ml_h:
            flow_rate_ml_h = self.max_flow_ml_h
            logger.warning(f"Flow rate adjusted to maximum: {self.max_flow_ml_h:.1f} ml/h")
        
        # Convert back to ml/min for storage
        self.flow_rate = flow_rate_ml_h / 60
        
        logger.info(f"Pump flow rate set to {self.flow_rate:.1f} ml/min ({flow_rate_ml_h:.1f} ml/h)")
        return True
    
    def get_flow_rate(self):
        """Get the current flow rate in ml/min."""
        return self.flow_rate
    
    def set_direction(self, direction):
        """Set the pump direction (forward/reverse)."""
        if direction.lower() not in ['forward', 'reverse']:
            logger.warning(f"Invalid direction: {direction}")
            return False
        
        self.direction = direction.lower()
        logger.info(f"Pump direction set to {self.direction}")
        return True
    
    def get_direction(self):
        """Get the current pump direction."""
        return self.direction
    
    def is_running(self):
        """Check if the pump is running."""
        return self.running
    
    def get_status(self):
        """Get the current pump status."""
        return {
            "running": self.running,
            "flow_rate": self.flow_rate,
            "direction": self.direction,
            "start_time": self.start_time,
            "connected": self.connected
        }
    
    def connect(self):
        """Connect to the pump (mock implementation)."""
        self.connected = True
        return True
    
    def disconnect(self):
        """Disconnect from the pump (mock implementation)."""
        self.connected = False
        return True
    
    def is_connected(self):
        """Check if the pump is connected."""
        return self.connected