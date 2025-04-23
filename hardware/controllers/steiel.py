# hardware/controllers/steiel.py
import logging
import time
import random
from datetime import datetime

logger = logging.getLogger(__name__)

class SteielController:
    """Interface for Steiel MCO14 EVO controller via Modbus RTU."""
    
    def __init__(self, port='/dev/ttyUSB1', modbus_address=1):
        """Initialize the Steiel controller interface."""
        self.port = port
        self.address = modbus_address
        self.instrument = None
        self.last_readings = {
            'ph': 7.4,
            'orp': 720,
            'free_cl': 1.2,
            'comb_cl': 0.2,
            'acid_pump_status': False,
            'cl_pump_status': False,
            'timestamp': datetime.now()
        }
        
        # Try to import required modules
        try:
            import serial
            import minimalmodbus
            self.minimalmodbus = minimalmodbus
        except ImportError as e:
            logger.error(f"Required modules not available: {e}")
            logger.warning("Steiel controller will operate in fallback mode with simulated readings")
            self.minimalmodbus = None
        
        if self.minimalmodbus:
            self.connect()
    
    def connect(self):
        """Connect to the controller via Modbus RTU."""
        if not self.minimalmodbus:
            logger.warning("Cannot connect to Steiel controller - minimalmodbus not available")
            return False
            
        try:
            self.instrument = self.minimalmodbus.Instrument(self.port, self.address)
            self.instrument.serial.baudrate = 9600
            self.instrument.serial.timeout = 1.0
            self.instrument.mode = self.minimalmodbus.MODE_RTU
            logger.info(f"Connected to Steiel controller on {self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Steiel controller: {e}")
            return False
    
    def get_readings(self):
        """Get all sensor readings from the controller."""
        if not self.minimalmodbus or not self.instrument:
            # Fall back to simulated readings
            return self._generate_simulated_readings()
        
        try:
            # Read registers for pH, ORP, free chlorine, combined chlorine
            # Note: Register addresses need to be confirmed from Steiel documentation
            # These are placeholders and should be adjusted based on actual documentation
            
            # Read pH value from registers 100-101
            ph_registers = self.instrument.read_registers(100, 2)
            ph = self._convert_registers_to_float(ph_registers)
            
            # Read ORP value from registers 102-103
            orp_registers = self.instrument.read_registers(102, 2)
            orp = self._convert_registers_to_float(orp_registers)
            
            # Read free chlorine value from registers 104-105
            free_cl_registers = self.instrument.read_registers(104, 2)
            free_cl = self._convert_registers_to_float(free_cl_registers)
            
            # Read combined chlorine value from registers 106-107
            comb_cl_registers = self.instrument.read_registers(106, 2)
            comb_cl = self._convert_registers_to_float(comb_cl_registers)
            
            # Read pump statuses
            acid_pump_status = self.instrument.read_register(200) == 1
            cl_pump_status = self.instrument.read_register(201) == 1
            
            # Update readings dict
            self.last_readings = {
                'ph': ph,
                'orp': orp,
                'free_cl': free_cl,
                'comb_cl': comb_cl,
                'acid_pump_status': acid_pump_status,
                'cl_pump_status': cl_pump_status,
                'timestamp': datetime.now()
            }
            
            logger.debug(f"Steiel readings: pH={ph:.2f}, ORP={orp}, Cl={free_cl:.2f}, Combined Cl={comb_cl:.2f}")
            return self.last_readings
        
        except Exception as e:
            logger.error(f"Error reading from Steiel controller: {e}")
            # Fall back to simulated readings after error
            return self._generate_simulated_readings()
    
    def _convert_registers_to_float(self, registers):
        """Convert two registers to a float value according to Steiel protocol."""
        if len(registers) != 2:
            return 0.0
        
        # For illustration - actual conversion depends on Steiel's data format
        # Assuming IEEE 754 float format
        import struct
        combined = (registers[0] << 16) | registers[1]
        packed = struct.pack('>I', combined)
        return struct.unpack('>f', packed)[0]
    
    def _generate_simulated_readings(self):
        """Generate simulated readings for fallback mode."""
        # Generate random variations for each parameter
        ph_variation = (random.random() - 0.5) * 0.2
        orp_variation = (random.random() - 0.5) * 30
        free_cl_variation = (random.random() - 0.5) * 0.3
        comb_cl_variation = (random.random() - 0.5) * 0.1
        
        # Random pump status changes (5% chance)
        if random.random() < 0.05:
            self.last_readings['acid_pump_status'] = not self.last_readings['acid_pump_status']
        
        if random.random() < 0.05:
            self.last_readings['cl_pump_status'] = not self.last_readings['cl_pump_status']
        
        # Update readings with variations
        self.last_readings.update({
            'ph': max(6.8, min(8.0, self.last_readings['ph'] + ph_variation)),
            'orp': max(600, min(800, self.last_readings['orp'] + orp_variation)),
            'free_cl': max(0.5, min(3.0, self.last_readings['free_cl'] + free_cl_variation)),
            'comb_cl': max(0.0, min(0.5, self.last_readings['comb_cl'] + comb_cl_variation)),
            'timestamp': datetime.now()
        })
        
        logger.debug("Generated simulated Steiel readings (fallback mode)")
        return self.last_readings

class MockSteielController:
    """Mock implementation for simulation mode."""
    
    def __init__(self, port=None, modbus_address=None, simulation_env=None):
        """Initialize the mock Steiel controller."""
        self.simulation_env = simulation_env
        
        # Initialize with defaults if no simulation environment
        self.last_readings = {
            'ph': 7.4,
            'orp': 720,
            'free_cl': 1.2,
            'comb_cl': 0.2,
            'acid_pump_status': False,
            'cl_pump_status': False,
            'timestamp': datetime.now()
        }
    
    def get_readings(self):
        """Generate simulated readings."""
        if self.simulation_env:
            # Get readings from simulation environment
            self.last_readings = {
                'ph': self.simulation_env.get_parameter('ph'),
                'orp': self.simulation_env.get_parameter('orp'),
                'free_cl': self.simulation_env.get_parameter('free_cl'),
                'comb_cl': self.simulation_env.get_parameter('comb_cl'),
                'acid_pump_status': self.simulation_env.get_parameter('acid_pump_active'),
                'cl_pump_status': self.simulation_env.get_parameter('chlorine_pump_active'),
                'timestamp': datetime.now()
            }
        else:
            # Generate random variations for each parameter
            ph_variation = (random.random() - 0.5) * 0.2
            orp_variation = (random.random() - 0.5) * 30
            free_cl_variation = (random.random() - 0.5) * 0.3
            comb_cl_variation = (random.random() - 0.5) * 0.1
            
            # Random pump status changes (5% chance)
            if random.random() < 0.05:
                self.last_readings['acid_pump_status'] = not self.last_readings['acid_pump_status']
            
            if random.random() < 0.05:
                self.last_readings['cl_pump_status'] = not self.last_readings['cl_pump_status']
            
            # Update readings with variations
            self.last_readings.update({
                'ph': max(6.8, min(8.0, self.last_readings['ph'] + ph_variation)),
                'orp': max(600, min(800, self.last_readings['orp'] + orp_variation)),
                'free_cl': max(0.5, min(3.0, self.last_readings['free_cl'] + free_cl_variation)),
                'comb_cl': max(0.0, min(0.5, self.last_readings['comb_cl'] + comb_cl_variation)),
                'timestamp': datetime.now()
            })
        
        return self.last_readings
    """Mock implementation for simulation mode."""
    
    def __init__(self, port=None, modbus_address=None):
        """Initialize the mock Steiel controller."""
        self.last_readings = {
            'ph': 7.4,
            'orp': 720,
            'free_cl': 1.2,
            'comb_cl': 0.2,
            'acid_pump_status': False,
            'cl_pump_status': False,
            'timestamp': datetime.now()
        }
    
    def get_readings(self):
        """Generate simulated readings."""
        # Generate random variations for each parameter
        ph_variation = (random.random() - 0.5) * 0.2
        orp_variation = (random.random() - 0.5) * 30
        free_cl_variation = (random.random() - 0.5) * 0.3
        comb_cl_variation = (random.random() - 0.5) * 0.1
        
        # Random pump status changes (5% chance)
        if random.random() < 0.05:
            self.last_readings['acid_pump_status'] = not self.last_readings['acid_pump_status']
        
        if random.random() < 0.05:
            self.last_readings['cl_pump_status'] = not self.last_readings['cl_pump_status']
        
        # Update readings with variations
        self.last_readings.update({
            'ph': max(6.8, min(8.0, self.last_readings['ph'] + ph_variation)),
            'orp': max(600, min(800, self.last_readings['orp'] + orp_variation)),
            'free_cl': max(0.5, min(3.0, self.last_readings['free_cl'] + free_cl_variation)),
            'comb_cl': max(0.0, min(0.5, self.last_readings['comb_cl'] + comb_cl_variation)),
            'timestamp': datetime.now()
        })
        
        return self.last_readings