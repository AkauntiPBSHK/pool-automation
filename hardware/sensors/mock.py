"""Mock sensors for simulation mode."""
import time
import random
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class MockTurbiditySensor:
    """Mock implementation of a turbidity sensor for simulation."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the mock turbidity sensor.
        
        Args:
            config: Configuration dictionary
        """
        self.moving_avg_samples = config.get('moving_avg_samples', 10)
        self.readings: List[float] = []
        self.base_value = 0.15
        self.min_value = 0.05
        self.max_value = 0.35
        self.variation = 0.02
        self.trend_factor = 0.0  # -1.0 to 1.0
        self.last_reading_time = time.time()
        self.connected = True
        self.last_error = None
        
        logger.info("Initialized mock turbidity sensor")
    
    def get_reading(self, retries: int = 3) -> float:
        """Get simulated turbidity reading.
        
        Args:
            retries: Number of retries (ignored in mock)
            
        Returns:
            float: Simulated turbidity reading in NTU
        """
        # Update reading time
        self.last_reading_time = time.time()
        
        # Generate reading with small random variations and trend
        reading = self.base_value
        
        # Add trend component
        self.trend_factor += (random.random() - 0.5) * 0.05
        self.trend_factor = max(-1.0, min(1.0, self.trend_factor))
        reading += self.trend_factor * 0.01
        
        # Add random variation
        reading += (random.random() - 0.5) * self.variation
        
        # Clamp to allowed range
        reading = max(self.min_value, min(self.max_value, reading))
        
        # Update base value slightly
        self.base_value = 0.95 * self.base_value + 0.05 * reading
        self.base_value = max(self.min_value, min(self.max_value, self.base_value))
        
        # Add to readings list for moving average
        self.readings.append(reading)
        if len(self.readings) > self.moving_avg_samples:
            self.readings.pop(0)
        
        return reading
    
    def get_moving_average(self) -> float:
        """Get moving average of turbidity readings.
        
        Returns:
            float: Moving average of turbidity in NTU
        """
        if not self.readings:
            return self.get_reading()
        
        return sum(self.readings) / len(self.readings)
    
    def get_status(self) -> Dict[str, Any]:
        """Get sensor status information.
        
        Returns:
            Dict[str, Any]: Status information
        """
        return {
            "connected": self.connected,
            "last_reading": self.readings[-1] if self.readings else None,
            "last_reading_time": self.last_reading_time,
            "moving_average": self.get_moving_average(),
            "samples_collected": len(self.readings),
            "last_error": self.last_error
        }