"""
Mock implementations of pumps and actuators for testing without hardware.
"""

import time
import threading
import logging

logger = logging.getLogger(__name__)

class MockPump:
    """Mock implementation of a dosing pump."""
    
    def __init__(self, config, simulator=None):
        """Initialize the mock pump.
        
        Args:
            config (dict): Configuration dictionary
            simulator (SystemSimulator, optional): Reference to the system simulator
        """
        self.config = config
        self.simulator = simulator
        
        # Pump type (for the simulator)
        self.pump_type = config.get('type', 'pac')
        
        # Flow rate for variable speed pumps
        self.flow_rate = config.get('default_flow_rate', 75)  # ml/h
        
        # State
        self.running = False
        self.stop_time = None
        self.timer = None
        
        logger.info(f"Mock {self.pump_type} pump initialized")
    
    def start(self, duration=None):
        """Start the pump.
        
        Args:
            duration (int, optional): Run duration in seconds
        """
        self.running = True
        
        # Update simulator
        if self.simulator:
            self.simulator.set_pump_state(self.pump_type, True, self.flow_rate)
        
        # Set up auto-stop timer if duration specified
        if duration:
            if self.timer:
                self.timer.cancel()
            
            self.stop_time = time.time() + duration
            self.timer = threading.Timer(duration, self.stop)
            self.timer.daemon = True
            self.timer.start()
            
            logger.info(f"Mock {self.pump_type} pump started for {duration} seconds at {self.flow_rate} ml/h")
        else:
            logger.info(f"Mock {self.pump_type} pump started at {self.flow_rate} ml/h")
        
        return True
    
    def stop(self):
        """Stop the pump."""
        self.running = False
        
        # Cancel timer if exists
        if self.timer:
            self.timer.cancel()
            self.timer = None
        
        # Update simulator
        if self.simulator:
            self.simulator.set_pump_state(self.pump_type, False)
        
        logger.info(f"Mock {self.pump_type} pump stopped")
        return True
    
    def set_flow_rate(self, rate):
        """Set the pump flow rate.
        
        Args:
            rate (float): Flow rate in ml/h
        """
        self.flow_rate = float(rate)
        
        # Update simulator if pump is running
        if self.running and self.simulator:
            self.simulator.set_pump_state(self.pump_type, True, self.flow_rate)
        
        logger.info(f"Mock {self.pump_type} pump flow rate set to {self.flow_rate} ml/h")
        return True
    
    def is_running(self):
        """Check if the pump is running."""
        return self.running
    
    def get_flow_rate(self):
        """Get the current flow rate."""
        return self.flow_rate