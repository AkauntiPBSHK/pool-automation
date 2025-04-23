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

class ChemitecTurbiditySensor(TurbiditySensor):
    """Interface for Chemitec S461LT turbidity sensor via Modbus RTU."""
    
    def __init__(self, config):
        super().__init__(config)
        self.port = config.get('port', '/dev/ttyUSB0')
        self.address = config.get('modbus_address', 1)
        self.baud_rate = config.get('baud_rate', 9600)
        self.instrument = None
        
        # Import required modules
        try:
            import serial
            import minimalmodbus
            self.minimalmodbus = minimalmodbus
        except ImportError as e:
            logger.error(f"Required modules not available: {e}")
            logger.warning("Chemitec sensor will operate in fallback mode with simulated readings")
            self.minimalmodbus = None
        
        if self.minimalmodbus:
            self.connect()
    
    def connect(self):
        """Connect to the sensor via Modbus RTU."""
        if not self.minimalmodbus:
            logger.warning("Cannot connect to sensor - minimalmodbus not available")
            return False
            
        try:
            self.instrument = self.minimalmodbus.Instrument(self.port, self.address)
            self.instrument.serial.baudrate = self.baud_rate
            self.instrument.serial.timeout = 1.0
            self.instrument.mode = self.minimalmodbus.MODE_RTU
            logger.info(f"Connected to turbidity sensor on {self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to turbidity sensor: {e}")
            return False
    
    def get_reading(self):
        """Get the current turbidity reading from the sensor."""
        if not self.minimalmodbus or not self.instrument:
            # Fall back to simulated reading if hardware connection not available
            reading = self.last_reading + (random.random() - 0.5) * 0.03
            reading = max(0.05, min(0.5, reading))
            self.last_reading = reading
            self.last_reading_time = datetime.now()
            self._add_to_buffer(reading)
            logger.debug(f"Simulated turbidity reading: {reading:.3f} NTU (fallback mode)")
            return reading
        
        try:
            # Read the turbidity value from register 40001 (adjust based on actual register)
            # The register address and data format depend on the sensor specifications
            reading = self.instrument.read_float(0, functioncode=3, number_of_registers=2)
            
            # Update last reading
            self.last_reading = reading
            self.last_reading_time = datetime.now()
            
            # Add to buffer for moving average
            self._add_to_buffer(reading)
            
            logger.debug(f"Turbidity reading: {reading:.3f} NTU")
            return reading
        
        except Exception as e:
            logger.error(f"Error reading turbidity sensor: {e}")
            
            # Fall back to simulated reading after error
            reading = self.last_reading + (random.random() - 0.5) * 0.01
            reading = max(0.05, min(0.5, reading))
            self.last_reading = reading
            self._add_to_buffer(reading)
            
            return reading

class MockTurbiditySensor(TurbiditySensor):
    """Mock implementation for simulation mode."""
    
    def __init__(self, config=None, simulation_env=None):
        super().__init__(config)
        self.simulation_env = simulation_env
        
        # If no simulation environment, fall back to simple random values
        if not simulation_env:
            self.target_value = 0.15
            self.variation = 0.03
            self.trend_direction = 0  # -1: decreasing, 0: stable, 1: increasing
            self.trend_chance = 0.1   # Probability of changing trend
            self.last_reading = self.target_value + (random.random() - 0.5) * self.variation
            self._add_to_buffer(self.last_reading)
    
    def get_reading(self):
        """Get simulated turbidity reading."""
        if self.simulation_env:
            # Get reading from simulation environment
            reading = self.simulation_env.get_parameter('turbidity')
            self.last_reading = reading
            self.last_reading_time = datetime.now()
            self._add_to_buffer(reading)
            return reading
        else:
            # Fall back to simple simulation if no environment
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