"""Steiel MCO14 EVO controller interface using Modbus RTU."""
import time
import struct
import logging
from typing import Dict, Any, Optional, List, Tuple

# Import our compatibility modules
from hardware.utils.modbus_compat import ModbusSerialClient, ModbusException, ConnectionException

logger = logging.getLogger(__name__)

class SteielController:
    """Interface for Steiel MCO14 EVO controller via Modbus RTU."""
    
    # Modbus register addresses for MCO14 EVO
    # These would need to be adjusted based on actual documentation
    REGISTERS = {
        # Input registers (read-only)
        'ph': {'addr': 100, 'count': 2, 'type': 'float'},
        'orp': {'addr': 102, 'count': 2, 'type': 'float'},
        'free_cl': {'addr': 104, 'count': 2, 'type': 'float'},
        'total_cl': {'addr': 106, 'count': 2, 'type': 'float'},
        'combined_cl': {'addr': 108, 'count': 2, 'type': 'float'},
        'temperature': {'addr': 110, 'count': 2, 'type': 'float'},
        
        # Status registers
        'acid_pump_status': {'addr': 200, 'count': 1, 'type': 'int'},
        'cl_pump_status': {'addr': 201, 'count': 1, 'type': 'int'},
        
        # Control registers (read-write)
        'ph_setpoint_min': {'addr': 300, 'count': 2, 'type': 'float'},
        'ph_setpoint_max': {'addr': 302, 'count': 2, 'type': 'float'},
        'orp_setpoint_min': {'addr': 304, 'count': 2, 'type': 'float'},
        'orp_setpoint_max': {'addr': 306, 'count': 2, 'type': 'float'},
        'free_cl_setpoint_min': {'addr': 308, 'count': 2, 'type': 'float'},
        'free_cl_setpoint_max': {'addr': 310, 'count': 2, 'type': 'float'},
    }
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the Steiel controller interface.
        
        Args:
            config: Configuration dictionary with the following keys:
                - port: Serial port for RS485 converter
                - modbus_address: Modbus address of the controller (default: 1)
                - baud_rate: Baud rate for communication (default: 9600)
        """
        self.port = config.get('port', '/dev/ttyUSB2')
        self.modbus_address = config.get('modbus_address', 1)
        self.baud_rate = config.get('baud_rate', 9600)
        
        # Data tracking
        self.last_readings = {}
        self.history = []
        self.max_history = 1000
        self.last_error = None
        self.last_reading_time = 0
        
        # Create Modbus client
        self.client = ModbusSerialClient(
            method='rtu',
            port=self.port,
            baudrate=self.baud_rate,
            parity='N',
            stopbits=1,
            bytesize=8,
            timeout=1.0
        )
        
        self.connected = False
        self.connect()
        
        logger.info(f"Initialized Steiel MCO14 EVO controller on {self.port}")
    
    def connect(self) -> bool:
        """Connect to the controller.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            self.connected = self.client.connect()
            if self.connected:
                logger.info(f"Connected to Steiel controller at address {self.modbus_address}")
            else:
                logger.error("Failed to connect to Steiel controller")
            return self.connected
        except Exception as e:
            logger.error(f"Error connecting to Steiel controller: {e}")
            self.connected = False
            self.last_error = str(e)
            return False
    
    def disconnect(self):
        """Close the connection to the controller."""
        if self.client:
            self.client.close()
            self.connected = False
    
    def read_register(self, register_name: str, retries: int = 3) -> Any:
        """Read a specific register from the controller.
        
        Args:
            register_name: Name of the register to read
            retries: Number of retries on communication error
            
        Returns:
            Any: Register value (float, int, or None if error)
        """
        if register_name not in self.REGISTERS:
            logger.error(f"Unknown register: {register_name}")
            return None
            
        register = self.REGISTERS[register_name]
        
        # Check if we need to reconnect
        if not self.connected:
            if not self.connect():
                # If reconnection fails, return None
                logger.warning(f"Using last known value for {register_name} due to connection failure")
                return self.last_readings.get(register_name)
        
        for attempt in range(retries + 1):
            try:
                # Read register
                result = self.client.read_holding_registers(
                    address=register['addr'],
                    count=register['count'],
                    unit=self.modbus_address
                )
                
                if result.isError():
                    logger.error(f"Error reading {register_name}: {result}")
                    # Wait before retry
                    time.sleep(0.5)
                    continue
                
                # Parse value based on type
                value = None
                if register['type'] == 'float' and register['count'] == 2:
                    # Convert two registers to float
                    try:
                        value_bytes = struct.pack('>HH', result.registers[0], result.registers[1])
                        value = struct.unpack('>f', value_bytes)[0]
                    except Exception as e:
                        logger.error(f"Error converting registers to float: {e}")
                        time.sleep(0.5)
                        continue
                elif register['type'] == 'int':
                    # Single register integer
                    value = result.registers[0]
                
                # Store reading
                self.last_readings[register_name] = value
                return value
                
            except ConnectionException:
                logger.warning(f"Connection error on attempt {attempt+1}/{retries+1}, trying to reconnect...")
                self.connected = False
                self.connect()
                
            except Exception as e:
                logger.error(f"Error reading {register_name} on attempt {attempt+1}/{retries+1}: {e}")
                self.last_error = str(e)
                time.sleep(0.5)  # Wait before retry
        
        # If all retries failed, return last known value
        logger.warning(f"All attempts to read {register_name} failed, using last known value")
        return self.last_readings.get(register_name)
    
    def write_register(self, register_name: str, value: Any, retries: int = 3) -> bool:
        """Write a value to a register in the controller.
        
        Args:
            register_name: Name of the register to write
            value: Value to write (float or int)
            retries: Number of retries on communication error
            
        Returns:
            bool: True if successful, False otherwise
        """
        if register_name not in self.REGISTERS:
            logger.error(f"Unknown register: {register_name}")
            return False
            
        register = self.REGISTERS[register_name]
        
        # Check if we need to reconnect
        if not self.connected:
            if not self.connect():
                # If reconnection fails, return False
                logger.error("Failed to connect to controller for write operation")
                return False
        
        for attempt in range(retries + 1):
            try:
                # Prepare value based on type
                if register['type'] == 'float' and register['count'] == 2:
                    # Convert float to two registers
                    try:
                        value_bytes = struct.pack('>f', float(value))
                        value_registers = [
                            struct.unpack('>H', value_bytes[0:2])[0],
                            struct.unpack('>H', value_bytes[2:4])[0]
                        ]
                    except Exception as e:
                        logger.error(f"Error converting float to registers: {e}")
                        return False
                    
                    # Write to registers
                    result = self.client.write_registers(
                        address=register['addr'],
                        values=value_registers,
                        unit=self.modbus_address
                    )
                elif register['type'] == 'int':
                    # Write single register
                    result = self.client.write_register(
                        address=register['addr'],
                        value=int(value),
                        unit=self.modbus_address
                    )
                else:
                    logger.error(f"Unsupported register type for writing: {register['type']}")
                    return False
                
                if result.isError():
                    logger.error(f"Error writing {register_name}: {result}")
                    # Wait before retry
                    time.sleep(0.5)
                    continue
                
                logger.info(f"Successfully wrote {value} to {register_name}")
                return True
                
            except ConnectionException:
                logger.warning(f"Connection error on attempt {attempt+1}/{retries+1}, trying to reconnect...")
                self.connected = False
                self.connect()
                
            except Exception as e:
                logger.error(f"Error writing {register_name} on attempt {attempt+1}/{retries+1}: {e}")
                self.last_error = str(e)
                time.sleep(0.5)  # Wait before retry
        
        # If all retries failed
        logger.error(f"All attempts to write {register_name} failed")
        return False
    
    def get_readings(self) -> Dict[str, Any]:
        """Get all sensor readings from the controller.
        
        Returns:
            Dict[str, Any]: Readings for all parameters
        """
        # Only attempt to read if connected or can connect
        if not self.connected and not self.connect():
            logger.error("Not connected to controller and failed to connect")
            return self.last_readings
        
        try:
            # Read each parameter
            parameters = ['ph', 'orp', 'free_cl', 'total_cl', 'temperature', 
                         'acid_pump_status', 'cl_pump_status']
            
            for param in parameters:
                value = self.read_register(param)
                if value is not None:
                    self.last_readings[param] = value
            
            # Calculate combined chlorine
            if 'free_cl' in self.last_readings and 'total_cl' in self.last_readings:
                free_cl = self.last_readings['free_cl']
                total_cl = self.last_readings['total_cl']
                if free_cl is not None and total_cl is not None:
                    self.last_readings['combined_cl'] = max(0, total_cl - free_cl)
            
            # Convert pump status indicators
            if 'acid_pump_status' in self.last_readings:
                self.last_readings['acid_pump_running'] = self.last_readings['acid_pump_status'] == 1
            
            if 'cl_pump_status' in self.last_readings:
                self.last_readings['cl_pump_running'] = self.last_readings['cl_pump_status'] == 1
            
            # Add timestamp
            self.last_readings['timestamp'] = time.time()
            self.last_reading_time = time.time()
            
            # Add to history
            self.history.append(dict(self.last_readings))
            if len(self.history) > self.max_history:
                self.history = self.history[-self.max_history:]
            
            return self.last_readings
        except Exception as e:
            logger.error(f"Error getting readings: {e}")
            self.last_error = str(e)
            return self.last_readings
    
    def get_setpoints(self) -> Dict[str, Tuple[float, float]]:
        """Get all setpoint ranges from the controller.
        
        Returns:
            Dict[str, Tuple[float, float]]: Setpoint ranges for parameters
        """
        setpoints = {}
        
        # Read setpoint registers
        try:
            ph_min = self.read_register('ph_setpoint_min')
            ph_max = self.read_register('ph_setpoint_max')
            if ph_min is not None and ph_max is not None:
                setpoints['ph'] = (ph_min, ph_max)
            
            orp_min = self.read_register('orp_setpoint_min')
            orp_max = self.read_register('orp_setpoint_max')
            if orp_min is not None and orp_max is not None:
                setpoints['orp'] = (orp_min, orp_max)
            
            cl_min = self.read_register('free_cl_setpoint_min')
            cl_max = self.read_register('free_cl_setpoint_max')
            if cl_min is not None and cl_max is not None:
                setpoints['free_cl'] = (cl_min, cl_max)
                
            return setpoints
        except Exception as e:
            logger.error(f"Error getting setpoints: {e}")
            self.last_error = str(e)
            return {}
    
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
        
        # Write setpoints
        try:
            min_success = self.write_register(f'{param}_setpoint_min', min_value)
            if not min_success:
                logger.error(f"Failed to write minimum setpoint for {param}")
                return False
                
            max_success = self.write_register(f'{param}_setpoint_max', max_value)
            if not max_success:
                logger.error(f"Failed to write maximum setpoint for {param}")
                return False
                
            logger.info(f"Successfully set {param} setpoints to {min_value} - {max_value}")
            return True
        except Exception as e:
            logger.error(f"Error setting setpoints for {param}: {e}")
            self.last_error = str(e)
            return False
    
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