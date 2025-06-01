# hardware/sensors/turbidity.py
import logging
import time
import random
import math

logger = logging.getLogger('turbidity_sensor')

class ChemitecTurbiditySensor:
    """Simulated interface for Chemitec S461LT turbidity sensor."""
    
    def __init__(self, config):
        """Initialize the sensor in simulation mode."""
        self.config = config
        self.last_reading = 0.15  # Default value
        self.readings_buffer = []  # For moving average
        logger.info("Initialized turbidity sensor in simulation mode")
    
    def get_reading(self):
        """Simulate a turbidity reading."""
        # Simulate a realistic turbidity reading with some drift
        hour = time.localtime().tm_hour
        # Turbidity often increases during day with activity
        hour_factor = math.sin((hour - 6) / 24 * 2 * math.pi)  
        base_value = 0.15 + hour_factor * 0.03
        
        # Add some random noise 
        noise = random.uniform(-0.01, 0.01)
        turbidity = max(0.05, min(0.5, base_value + noise))
        
        self.last_reading = turbidity
        self.readings_buffer.append(turbidity)
        
        # Keep buffer to a fixed size
        if len(self.readings_buffer) > 10:
            self.readings_buffer.pop(0)
            
        return turbidity
    
    def get_moving_average(self):
        """Calculate moving average of recent readings."""
        if not self.readings_buffer:
            return self.last_reading
            
        return sum(self.readings_buffer) / len(self.readings_buffer)
    
    def close(self):
        """Simulation cleanup (no-op)."""
        pass

# Add a note for when hardware arrives
"""
IMPORTANT: When hardware arrives:
1. Install required packages: pip install pyserial pymodbus minimalmodbus
2. Replace this file with the full hardware-compatible version
"""