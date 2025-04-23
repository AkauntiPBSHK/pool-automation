"""Mock controller implementations for simulation."""
import time
import random
import logging
from typing import Dict, Any, Tuple, List

logger = logging.getLogger(__name__)

class MockSteielController:
    """Mock implementation of Steiel controller for simulation."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the mock Steiel controller.
        
        Args:
            config: Configuration dictionary
        """
        self.last_readings = {
            'ph': 7.4,
            'orp': 720,
            'free_cl': 1.2,
            'total_cl': 1.4,
            'combined_cl': 0.2,
            'temperature': 28.5,
            'acid_pump_status': 0,
            'cl_pump_status': 0,
            'acid_pump_running': False,
            'cl_pump_running': False,
            'timestamp': time.time()
        }
        
        self.setpoints = {
            'ph': (7.2, 7.6),
            'orp': (680, 750),
            'free_cl': (1.0, 2.0)
        }
        
        self.history = []
        self.max_history = 1000
        self.last_error = None
        self.last_reading_time = time.time()
        self.connected = True
        
        # Simulation parameters
        self.trend_factors = {
            'ph': 0.0,
            'orp': 0.0,
            'free_cl': 0.0,
            'total_cl': 0.0,
            'temperature': 0.0
        }
        
        logger.info("Initialized mock Steiel controller")
    
    def connect(self) -> bool:
        """Connect to the controller.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        self.connected = True
        return True
    
    def disconnect(self):
        """Close the connection to the controller."""
        pass
    
    def read_register(self, register_name: str, retries: int = 3) -> Any:
        """Read a specific register from the controller.
        
        Args:
            register_name: Name of the register to read
            retries: Number of retries on communication error
            
        Returns:
            Any: Register value (float, int, or None if error)
        """
        if register_name in self.last_readings:
            return self.last_readings[register_name]
        elif register_name.endswith('_setpoint_min'):
            param = register_name.split('_')[0]
            if param in self.setpoints:
                return self.setpoints[param][0]
        elif register_name.endswith('_setpoint_max'):
            param = register_name.split('_')[0]
            if param in self.setpoints:
                return self.setpoints[param][1]
        
        return None
    
    def write_register(self, register_name: str, value: Any, retries: int = 3) -> bool:
        """Write a value to a register in the controller.
        
        Args:
            register_name: Name of the register to write
            value: Value to write (float or int)
            retries: Number of retries on communication error
            
        Returns:
            bool: True if successful, False otherwise
        """
        if register_name.endswith('_setpoint_min'):
            param = register_name.split('_')[0]
            if param in self.setpoints:
                self.setpoints[param] = (float(value), self.setpoints[param][1])
                return True
        elif register_name.endswith('_setpoint_max'):
            param = register_name.split('_')[0]
            if param in self.setpoints:
                self.setpoints[param] = (self.setpoints[param][0], float(value))
                return True
        
        return False
    
    def get_readings(self) -> Dict[str, Any]:
        """Get all sensor readings from the controller.
        
        Returns:
            Dict[str, Any]: Readings for all parameters
        """
        # Update simulated readings
        self._update_simulated_readings()
        
        # Update timestamp
        self.last_readings['timestamp'] = time.time()
        self.last_reading_time = time.time()
        
        # Add to history
        self.history.append(dict(self.last_readings))
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]
        
        return self.last_readings
    
    def _update_simulated_readings(self):
        """Update simulated sensor readings."""
        # Update trend factors
        for param in self.trend_factors:
            self.trend_factors[param] += (random.random() - 0.5) * 0.05
            self.trend_factors[param] = max(-1.0, min(1.0, self.trend_factors[param]))
        
        # Update pH
        self.last_readings['ph'] += self.trend_factors['ph'] * 0.02 + (random.random() - 0.5) * 0.05
        self.last_readings['ph'] = max(6.8, min(8.0, self.last_readings['ph']))
        
        # Update ORP
        self.last_readings['orp'] += self.trend_factors['orp'] * 5 + (random.random() - 0.5) * 10
        self.last_readings['orp'] = max(600, min(800, self.last_readings['orp']))
        
        # Update chlorine
        self.last_readings['free_cl'] += self.trend_factors['free_cl'] * 0.05 + (random.random() - 0.5) * 0.1
        self.last_readings['free_cl'] = max(0.5, min(3.0, self.last_readings['free_cl']))
        
        self.last_readings['total_cl'] = self.last_readings['free_cl'] + 0.2 + (random.random() - 0.5) * 0.05
        self.last_readings['total_cl'] = max(self.last_readings['free_cl'], min(4.0, self.last_readings['total_cl']))
        
        self.last_readings['combined_cl'] = self.last_readings['total_cl'] - self.last_readings['free_cl']
        
        # Update temperature
        self.last_readings['temperature'] += self.trend_factors['temperature'] * 0.1 + (random.random() - 0.5) * 0.1
        self.last_readings['temperature'] = max(20, min(35, self.last_readings['temperature']))
        
        # Update pump status based on setpoints
        # pH pump
        if self.last_readings['ph'] > self.setpoints['ph'][1]:
            self.last_readings['acid_pump_status'] = 1
            self.last_readings['acid_pump_running'] = True
        elif self.last_readings['ph'] < self.setpoints['ph'][0]:
            self.last_readings['acid_pump_status'] = 0
            self.last_readings['acid_pump_running'] = False
            
        # Chlorine pump
        if self.last_readings['free_cl'] < self.setpoints['free_cl'][0]:
            self.last_readings['cl_pump_status'] = 1
            self.last_readings['cl_pump_running'] = True
        elif self.last_readings['free_cl'] > self.setpoints['free_cl'][1]:
            self.last_readings['cl_pump_status'] = 0
            self.last_readings['cl_pump_running'] = False
    
    def get_setpoints(self) -> Dict[str, Tuple[float, float]]:
        """Get all setpoint ranges from the controller.
        
        Returns:
            Dict[str, Tuple[float, float]]: Setpoint ranges for parameters
        """
        return self.setpoints
    
    def set_setpoints(self, param: str, min_value: float, max_value: float) -> bool:
        """Set setpoint range for a parameter.
        
        Args:
            param: Parameter name ('ph', 'orp', or 'free_cl')
            min_value: Minimum setpoint value
            max_value: Maximum setpoint value
            
        Returns:
            bool: True if successful, False otherwise
        """
        if param not in ['ph', 'orp', 'free_cl']:
            logger.error(f"Unknown parameter for setpoint: {param}")
            return False
            
        # Validate min < max
        if min_value >= max_value:
            logger.error(f"Invalid setpoint range: min ({min_value}) must be less than max ({max_value})")
            return False
        
        # Set setpoints
        self.setpoints[param] = (float(min_value), float(max_value))
        logger.info(f"Mock controller setpoints for {param} set to {min_value} - {max_value}")
        return True
    
    def get_status(self) -> Dict[str, Any]:
        """Get controller status information.
        
        Returns:
            Dict[str, Any]: Status information
        """
        return {
            "connected": self.connected,
            "last_readings": self.last_readings,
            "last_reading_time": self.last_reading_time,
            "last_error": self.last_error,
            "history_entries": len(self.history)
        }