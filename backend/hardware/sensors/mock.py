"""
Mock implementations of sensors for testing without hardware.
"""

import time
import logging

logger = logging.getLogger(__name__)

class MockTurbiditySensor:
    """Mock implementation of a turbidity sensor."""
    
    def __init__(self, config, simulator=None):
        """Initialize the mock turbidity sensor.
        
        Args:
            config (dict): Configuration dictionary
            simulator (SystemSimulator, optional): Reference to the system simulator
        """
        self.config = config
        self.simulator = simulator
        
        # Buffer for moving average calculation
        self.readings_buffer = []
        self.max_buffer_size = config.get('moving_avg_samples', 10)
        
        logger.info("Mock turbidity sensor initialized")
    
    def get_reading(self):
        """Get the current turbidity reading."""
        if self.simulator:
            # Get reading from system simulator
            turbidity = self.simulator.get_parameter('turbidity')
        else:
            # Generate random reading if no simulator provided
            import random
            turbidity = 0.15 + random.uniform(-0.03, 0.03)
        
        # Add to readings buffer for moving average
        self.readings_buffer.append(turbidity)
        if len(self.readings_buffer) > self.max_buffer_size:
            self.readings_buffer.pop(0)  # Remove oldest reading
        
        return turbidity
    
    def get_moving_average(self):
        """Get the moving average of recent turbidity readings."""
        if not self.readings_buffer:
            return None
        
        return sum(self.readings_buffer) / len(self.readings_buffer)
    
    def get_status(self):
        """Get the sensor status."""
        return {
            'error': False,
            'calibration_needed': False,
            'measurement_valid': True
        }
    
    def close(self):
        """Close the sensor connection."""
        logger.info("Mock turbidity sensor closed")