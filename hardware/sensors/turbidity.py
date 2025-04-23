# hardware/sensors/turbidity.py
import logging
import time
import random
from datetime import datetime

logger = logging.getLogger(__name__)

class TurbiditySensor:
    """Base class for turbidity sensors."""
    
    def __init__(self, config=None):
        self.config = config or {}
        self.last_reading = 0.15  # Default value
        self.last_reading_time = datetime.now()
        self.readings_buffer = []  # For moving average
        self.max_buffer_size = self.config.get('moving_avg_samples', 10)
        
    def get_reading(self):
        """Get the current turbidity reading (NTU)."""
        raise NotImplementedError("Subclasses must implement get_reading()")
    
    def get_moving_average(self):
        """Get the moving average of recent readings."""
        if not self.readings_buffer:
            return self.last_reading
        return sum(self.readings_buffer) / len(self.readings_buffer)
    
    def _add_to_buffer(self, reading):
        """Add a reading to the moving average buffer."""
        self.readings_buffer.append(reading)
        if len(self.readings_buffer) > self.max_buffer_size:
            self.readings_buffer.pop(0)

class MockTurbiditySensor(TurbiditySensor):
    """Mock implementation for simulation mode."""
    
    def __init__(self, config=None):
        super().__init__(config)
        self.target_value = 0.15
        self.variation = 0.03
        self.trend_direction = 0  # -1: decreasing, 0: stable, 1: increasing
        self.trend_chance = 0.1   # Probability of changing trend
        self.last_reading = self.target_value + (random.random() - 0.5) * self.variation
        self._add_to_buffer(self.last_reading)
    
    def get_reading(self):
        """Generate a simulated turbidity reading."""
        # Randomly change trend
        if random.random() < self.trend_chance:
            self.trend_direction = random.choice([-1, 0, 1])
        
        # Apply trend and random variation
        trend_effect = self.trend_direction * 0.005
        random_effect = (random.random() - 0.5) * self.variation * 0.5
        
        # Calculate new reading
        new_reading = self.last_reading + trend_effect + random_effect
        
        # Ensure it stays within reasonable bounds (0.05 - 0.5 NTU)
        new_reading = max(0.05, min(0.5, new_reading))
        
        # Update last reading
        self.last_reading = new_reading
        self.last_reading_time = datetime.now()
        
        # Add to buffer for moving average
        self._add_to_buffer(new_reading)
        
        return new_reading