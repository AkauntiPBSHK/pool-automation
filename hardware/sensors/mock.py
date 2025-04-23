"""Mock sensors for simulation mode."""
import time
import random
import logging
import threading
from collections import deque

logger = logging.getLogger(__name__)

class MockTurbiditySensor:
    """Mock implementation of the Chemitec S461LT turbidity sensor."""
    
    def __init__(self, config):
        """Initialize the mock turbidity sensor."""
        self.config = config
        self.connected = True
        self.current_value = 0.15  # Initial NTU value
        self.history = deque(maxlen=100)  # Store last 100 readings
        self.running = False
        self.thread = None
        self.reading_interval = 1.0  # seconds
        
        # Store moving average samples
        self.moving_avg_samples = int(config.get('moving_avg_samples', 10))
        self.readings = deque(maxlen=self.moving_avg_samples)
        self.readings.append(self.current_value)
        
        # Start the simulation thread
        self.start_simulation()
        
        logger.info("Mock turbidity sensor initialized")
    
    def start_simulation(self):
        """Start the simulation thread to generate readings."""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._simulate_readings, daemon=True)
        self.thread.start()
        logger.info("Mock turbidity sensor simulation started")
    
    def stop_simulation(self):
        """Stop the simulation thread."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
            self.thread = None
        logger.info("Mock turbidity sensor simulation stopped")
    
    def _simulate_readings(self):
        """Simulate turbidity readings."""
        while self.running:
            # Generate a realistic turbidity value with small fluctuations
            # and occasional trends up or down
            
            # Small random fluctuation
            fluctuation = (random.random() - 0.5) * 0.01
            
            # Occasional trend changes
            if random.random() < 0.05:  # 5% chance of trend change
                trend = (random.random() - 0.5) * 0.05
            else:
                trend = 0
            
            # Update current value with constraints
            self.current_value = max(0.05, min(0.5, self.current_value + fluctuation + trend))
            
            # Add to readings for moving average
            self.readings.append(self.current_value)
            
            # Add to history with timestamp
            self.history.append((time.time(), self.current_value))
            
            # Log occasionally
            if random.random() < 0.01:  # 1% chance of logging
                logger.debug(f"Mock turbidity reading: {self.current_value:.3f} NTU")
            
            # Sleep until next reading
            time.sleep(self.reading_interval)
    
    def get_reading(self):
        """Get the current turbidity reading."""
        return self.current_value
    
    def get_moving_average(self):
        """Get the moving average of turbidity readings."""
        if not self.readings:
            return 0
        return sum(self.readings) / len(self.readings)
    
    def get_history(self, count=None):
        """Get historical readings."""
        if count is None:
            return list(self.history)
        return list(self.history)[-count:]
    
    def connect(self):
        """Connect to the sensor (mock implementation)."""
        self.connected = True
        return True
    
    def disconnect(self):
        """Disconnect from the sensor (mock implementation)."""
        self.connected = False
        return True
    
    def is_connected(self):
        """Check if the sensor is connected."""
        return self.connected