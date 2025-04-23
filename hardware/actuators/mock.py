"""Mock actuators for simulation mode."""
import time
import logging
from enum import Enum
from typing import Dict, Any, Optional
import threading

logger = logging.getLogger(__name__)

class PumpStatus(Enum):
    """Pump status enumeration."""
    STOPPED = 0
    RUNNING = 1
    ERROR = 2

class MockPump:
    """Mock implementation of a pump for simulation."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the mock pump.
        
        Args:
            config: Configuration dictionary
        """
        self.min_flow_ml_h = float(config.get('min_flow_ml_h', 60))
        self.max_flow_ml_h = float(config.get('max_flow_ml_h', 150))
        
        self._current_flow_rate = 0.0  # ml/min
        self._status = PumpStatus.STOPPED
        self._last_error = None
        self._last_command_time = 0
        self._stop_timer = None
        
        self.connected = True
        
        logger.info("Initialized mock pump")
    
    def connect(self) -> bool:
        """Connect to the pump.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        self.connected = True
        return True
    
    def disconnect(self):
        """Close the connection to the pump."""
        pass
    
    def set_flow_rate(self, flow_rate_ml_min: float) -> bool:
        """Set the pump flow rate in mL/min.
        
        Args:
            flow_rate_ml_min: Flow rate in milliliters per minute
        
        Returns:
            bool: True if successful, False otherwise
        """
        # Convert ml/h to ml/min
        flow_rate_ml_h = flow_rate_ml_min * 60
        
        # Clamp flow rate to allowed range
        flow_rate_ml_h = max(self.min_flow_ml_h, min(self.max_flow_ml_h, flow_rate_ml_h))
        flow_rate_ml_min = flow_rate_ml_h / 60
        
        # Store the current flow rate
        self._current_flow_rate = flow_rate_ml_min
        
        logger.info(f"Mock pump flow rate set to {flow_rate_ml_min:.2f} mL/min ({flow_rate_ml_h:.1f} mL/h)")
        return True
    
    def start(self, duration: Optional[int] = None) -> bool:
        """Start the pump.
        
        Args:
            duration: Optional duration in seconds, after which the pump will automatically stop
            
        Returns:
            bool: True if successful, False otherwise
        """
        self._last_command_time = time.time()
        self._status = PumpStatus.RUNNING
        
        logger.info(f"Mock pump started at {self._current_flow_rate:.2f} mL/min")
        
        # If duration is provided, schedule stop
        if duration:
            # Cancel any existing timer
            if self._stop_timer:
                self._stop_timer.cancel()
                
            self._stop_timer = threading.Timer(duration, self.stop)
            self._stop_timer.daemon = True
            self._stop_timer.start()
            
            logger.info(f"Mock pump will stop after {duration} seconds")
        
        return True
    
    def stop(self) -> bool:
        """Stop the pump.
        
        Returns:
            bool: True if successful, False otherwise
        """
        self._last_command_time = time.time()
        self._status = PumpStatus.STOPPED
        
        # Cancel any existing timer
        if self._stop_timer:
            self._stop_timer.cancel()
            self._stop_timer = None
        
        logger.info("Mock pump stopped")
        return True
    
    def is_running(self) -> bool:
        """Check if the pump is currently running.
        
        Returns:
            bool: True if pump is running, False otherwise
        """
        return self._status == PumpStatus.RUNNING
    
    def get_flow_rate(self) -> float:
        """Get the current flow rate in mL/min.
        
        Returns:
            float: Current flow rate in mL/min
        """
        return self._current_flow_rate if self.is_running() else 0.0
    
    def get_status(self) -> Dict[str, Any]:
        """Get current pump status information.
        
        Returns:
            Dict[str, Any]: Status information
        """
        is_running = self.is_running()
        flow_rate = self.get_flow_rate()
        
        return {
            "connected": self.connected,
            "running": is_running,
            "flow_rate_ml_min": flow_rate,
            "flow_rate_ml_h": flow_rate * 60,
            "last_command_time": self._last_command_time,
            "last_error": self._last_error,
            "mode": "mock",
            "min_flow_ml_h": self.min_flow_ml_h,
            "max_flow_ml_h": self.max_flow_ml_h
        }