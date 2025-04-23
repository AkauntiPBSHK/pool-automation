"""Turbidity sensor implementation for Chemitec S461LT."""
import time
import logging
from typing import Dict, Any, Optional, List
from pymodbus.client.sync import ModbusSerialClient
from pymodbus.exceptions import ModbusException, ConnectionException

logger = logging.getLogger(__name__)

class ChemitecTurbiditySensor:
    """Interface for Chemitec S461LT turbidity sensor via Modbus RTU."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the turbidity sensor.
        
        Args:
            config: Configuration dictionary with the following keys:
                - port: Serial port for RS485 converter
                - modbus_address: Modbus address of the sensor (default: 1)
                - baud_rate: Baud rate for communication (default: 9600)
                - moving_avg_samples: Number of samples for moving average (default: 10)
        """
        self.port = config.get('port', '/dev/ttyUSB0')
        self.modbus_address = config.get('modbus_address', 1)
        self.baud_rate = config.get('baud_rate', 9600)
        
        # Data collection
        self.readings: List[float] = []
        self.moving_avg_samples = config.get('moving_avg_samples', 10)
        self.last_reading_time = 0
        self.last_reading = 0.0
        self.last_error = None
        
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
        
        logger.info(f"Initialized Chemitec S461LT turbidity sensor on {self.port}")
    
    def connect(self) -> bool:
        """Connect to the sensor.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            self.connected = self.client.connect()
            if self.connected:
                logger.info(f"Connected to turbidity sensor at address {self.modbus_address}")
            else:
                logger.error("Failed to connect to turbidity sensor")
            return self.connected
        except Exception as e:
            logger.error(f"Error connecting to turbidity sensor: {e}")
            self.connected = False
            self.last_error = str(e)
            return False
    
    def disconnect(self):
        """Close the connection to the sensor."""
        if self.client:
            self.client.close()
            self.connected = False
    
    def get_reading(self, retries: int = 3) -> float:
        """Get current turbidity reading from sensor.
        
        Args:
            retries: Number of retries on communication error
            
        Returns:
            float: Current turbidity reading in NTU
        """
        # Check if we need to reconnect
        if not self.connected:
            if not self.connect():
                # If reconnection fails, return last reading
                logger.warning("Using last known turbidity value due to connection failure")
                return self.last_reading
        
        for attempt in range(retries + 1):
            try:
                # Chemitec S461LT stores turbidity value in input registers 0-1 as float
                result = self.client.read_input_registers(
                    address=0,
                    count=2,
                    unit=self.modbus_address
                )
                
                if result.isError():
                    logger.error(f"Error reading turbidity: {result}")
                    # Wait before retry
                    time.sleep(0.5)
                    continue
                
                # Convert the two registers to a float value
                # The registers are in IEEE 754 format
                import struct
                turbidity_bytes = struct.pack('>HH', result.registers[0], result.registers[1])
                turbidity = struct.unpack('>f', turbidity_bytes)[0]
                
                # Store the reading
                self.last_reading = turbidity
                self.last_reading_time = time.time()
                
                # Add to readings list for moving average
                self.readings.append(turbidity)
                if len(self.readings) > self.moving_avg_samples:
                    self.readings.pop(0)
                
                logger.debug(f"Turbidity reading: {turbidity:.3f} NTU")
                return turbidity
                
            except ConnectionException:
                logger.warning(f"Connection error on attempt {attempt+1}/{retries+1}, trying to reconnect...")
                self.connected = False
                self.connect()
                
            except Exception as e:
                logger.error(f"Error reading turbidity on attempt {attempt+1}/{retries+1}: {e}")
                self.last_error = str(e)
                time.sleep(0.5)  # Wait before retry
        
        # If all retries failed, return last known reading
        logger.warning("All turbidity reading attempts failed, using last known value")
        return self.last_reading
    
    def get_moving_average(self) -> float:
        """Get moving average of turbidity readings.
        
        Returns:
            float: Moving average of turbidity in NTU
        """
        if not self.readings:
            return self.last_reading
        
        return sum(self.readings) / len(self.readings)
    
    def get_status(self) -> Dict[str, Any]:
        """Get sensor status information.
        
        Returns:
            Dict[str, Any]: Status information
        """
        return {
            "connected": self.connected,
            "last_reading": self.last_reading,
            "last_reading_time": self.last_reading_time,
            "moving_average": self.get_moving_average(),
            "samples_collected": len(self.readings),
            "last_error": self.last_error
        }