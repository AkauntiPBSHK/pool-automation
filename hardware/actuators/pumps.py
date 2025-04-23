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

class MockPump(Pump):
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