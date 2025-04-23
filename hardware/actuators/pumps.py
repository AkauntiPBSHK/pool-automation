"""Pump controller implementation for Chonry WP110 and other pumps."""
import time
import struct
import logging
from enum import Enum
from typing import Dict, Any, Optional
try:
    from pymodbus.client import ModbusSerialClient
except ImportError:
from pymodbus.exceptions import ModbusException, ConnectionException

logger = logging.getLogger(__name__)

class PumpStatus(Enum):
    """Pump status enumeration."""
    STOPPED = 0
    RUNNING = 1
    ERROR = 2

class ChonryPump:
    """Controller for Chonry WP110/BW100 pump via Modbus RTU."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the pump controller.
        
        Args:
            config: Configuration dictionary with the following keys:
                - port: Serial port for RS485 converter
                - modbus_address: Modbus address of the pump (default: 1)
                - baud_rate: Baud rate for communication (default: 9600)
                - min_flow_ml_h: Minimum flow rate in ml/h (default: 60)
                - max_flow_ml_h: Maximum flow rate in ml/h (default: 150)
                - tube_type: Tube type code (default: 12 for 1x1mm tube)
                - control_pin: GPIO pin for relay control (if relay mode is used)
        """
        self.port = config.get('port', '/dev/ttyUSB1')
        self.modbus_address = config.get('modbus_address', 1)
        self.baud_rate = config.get('baud_rate', 9600)
        
        # Flow rate limits (ml/h)
        self.min_flow_ml_h = float(config.get('min_flow_ml_h', 60))
        self.max_flow_ml_h = float(config.get('max_flow_ml_h', 150))
        
        # Tube configuration
        self.tube_type = int(config.get('tube_type', 12))  # Default: 1x1mm tube
        
        # Relay control (alternative control method)
        self.control_pin = config.get('control_pin')
        self.use_relay = self.control_pin is not None
        
        # State tracking
        self._current_flow_rate = 0.0  # ml/min
        self._status = PumpStatus.STOPPED
        self._last_error = None
        self._last_command_time = 0
        
        # Initialize relay if used
        if self.use_relay:
            try:
                import RPi.GPIO as GPIO
                GPIO.setmode(GPIO.BCM)
                GPIO.setup(self.control_pin, GPIO.OUT)
                GPIO.output(self.control_pin, GPIO.LOW)
                logger.info(f"Initialized relay control on GPIO {self.control_pin}")
            except ImportError:
                logger.error("RPi.GPIO module not available. Relay control disabled.")
                self.use_relay = False
        
        # Create Modbus client if not using relay
        if not self.use_relay:
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
        else:
            self.client = None
            self.connected = True
        
        logger.info(f"Initialized Chonry WP110 pump controller on {self.port if not self.use_relay else f'GPIO {self.control_pin}'}")
    
    def connect(self) -> bool:
        """Connect to the pump via Modbus.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        if self.use_relay:
            return True
            
        try:
            self.connected = self.client.connect()
            if self.connected:
                logger.info(f"Connected to pump at address {self.modbus_address}")
                # Enable RS485 control
                self.enable_rs485_control()
                # Set tube type
                self.set_tube_type(self.tube_type)
            else:
                logger.error("Failed to connect to pump")
            return self.connected
        except Exception as e:
            logger.error(f"Error connecting to pump: {e}")
            self.connected = False
            self._last_error = str(e)
            return False
    
    def disconnect(self):
        """Close the connection to the pump."""
        if self.client and not self.use_relay:
            self.client.close()
            self.connected = False
    
    def enable_rs485_control(self) -> bool:
        """Enable RS485 control mode - required before other commands.
        
        Returns:
            bool: True if successful, False otherwise
        """
        if self.use_relay:
            return True
            
        if not self.connected:
            logger.error("Not connected to pump")
            return False
        
        try:
            result = self.client.write_register(
                address=0,  # Register 0 - RS485 control enable
                value=1,    # Enable (1)
                unit=self.modbus_address
            )
            success = not result.isError() if result else False
            if success:
                logger.info("RS485 control mode enabled")
            else:
                logger.error("Failed to enable RS485 control mode")
            return success
        except Exception as e:
            logger.error(f"Error enabling RS485 control: {e}")
            self._last_error = str(e)
            return False
    
    def set_tube_type(self, tube_type: int = 12) -> bool:
        """Set the pump tube type.
        
        Args:
            tube_type: Tube type code (12=1*1mm, 13=2*1mm)
            
        Returns:
            bool: True if successful, False otherwise
        """
        if self.use_relay:
            # Not applicable in relay mode
            return True
            
        if not self.connected:
            logger.error("Not connected to pump")
            return False
        
        try:
            result = self.client.write_register(
                address=3,  # Register 3 - Pump tube
                value=tube_type,
                unit=self.modbus_address
            )
            success = not result.isError() if result else False
            if success:
                logger.info(f"Tube type set to {tube_type}")
            else:
                logger.error(f"Failed to set tube type to {tube_type}")
            
            # Check for error code
            error_code = self._check_error()
            if error_code:
                logger.error(f"Tube type error: {error_code}")
                return False
                
            return success
        except Exception as e:
            logger.error(f"Error setting tube type: {e}")
            self._last_error = str(e)
            return False
    
    def set_flow_rate(self, flow_rate_ml_min: float) -> bool:
        """Set the pump flow rate in mL/min.
        
        Args:
            flow_rate_ml_min: Flow rate in milliliters per minute
        
        Returns:
            bool: True if successful, False otherwise
        """
        # Convert ml/h to ml/min
        flow_rate_ml_h = flow_rate_ml_min * 60
        
        # Clamp flow rate to allowed range
        flow_rate_ml_h = max(self.min_flow_ml_h, min(self.max_flow_ml_h, flow_rate_ml_h))
        flow_rate_ml_min = flow_rate_ml_h / 60
        
        # Store the current flow rate
        self._current_flow_rate = flow_rate_ml_min
        
        # If using relay, we just store the value (actual control via start/stop)
        if self.use_relay:
            return True
            
        if not self.connected:
            logger.error("Not connected to pump")
            return False
        
        try:
            # Convert float to IEEE 754 format as two 16-bit registers
            flow_bytes = struct.pack('>f', flow_rate_ml_min)
            flow_registers = [
                (flow_bytes[0] << 8) | flow_bytes[1],
                (flow_bytes[2] << 8) | flow_bytes[3]
            ]
            
            # Write to registers 5-6 (flow rate)
            result = self.client.write_registers(
                address=5,
                values=flow_registers,
                unit=self.modbus_address
            )
            
            success = not result.isError() if result else False
            if success:
                logger.info(f"Flow rate set to {flow_rate_ml_min:.2f} mL/min ({flow_rate_ml_h:.1f} mL/h)")
            else:
                logger.error(f"Failed to set flow rate to {flow_rate_ml_min:.2f} mL/min")
            
            # Check for error code
            error_code = self._check_error()
            if error_code:
                logger.error(f"Flow rate error: {error_code}")
                return False
                
            return success
        except Exception as e:
            logger.error(f"Error setting flow rate: {e}")
            self._last_error = str(e)
            return False
    
    def start(self, duration: Optional[int] = None) -> bool:
        """Start the pump.
        
        Args:
            duration: Optional duration in seconds, after which the pump will automatically stop
            
        Returns:
            bool: True if successful, False otherwise
        """
        self._last_command_time = time.time()
        
        if self.use_relay:
            try:
                import RPi.GPIO as GPIO
                GPIO.output(self.control_pin, GPIO.HIGH)
                logger.info(f"Started pump via relay on GPIO {self.control_pin}")
                self._status = PumpStatus.RUNNING
                
                # If duration provided, schedule stop
                if duration:
                    import threading
                    stop_thread = threading.Timer(duration, self.stop)
                    stop_thread.daemon = True
                    stop_thread.start()
                    
                return True
            except Exception as e:
                logger.error(f"Error starting pump via relay: {e}")
                self._last_error = str(e)
                return False
            
        if not self.connected:
            if not self.connect():
                logger.error("Failed to connect to pump")
                return False
        
        try:
            # Write to coil 1 (start/stop)
            result = self.client.write_coil(
                address=1,
                value=True,  # True = Start
                unit=self.modbus_address
            )
            
            success = not result.isError() if result else False
            if success:
                logger.info(f"Pump started at {self._current_flow_rate:.2f} mL/min")
                self._status = PumpStatus.RUNNING
            else:
                logger.error("Failed to start pump")
                
            # Check for error code
            error_code = self._check_error()
            if error_code:
                logger.error(f"Start error: {error_code}")
                return False
                
            # If duration provided, schedule stop
            if duration and success:
                import threading
                stop_thread = threading.Timer(duration, self.stop)
                stop_thread.daemon = True
                stop_thread.start()
                
            return success
        except Exception as e:
            logger.error(f"Error starting pump: {e}")
            self._last_error = str(e)
            return False
    
    def stop(self) -> bool:
        """Stop the pump.
        
        Returns:
            bool: True if successful, False otherwise
        """
        self._last_command_time = time.time()
        
        if self.use_relay:
            try:
                import RPi.GPIO as GPIO
                GPIO.output(self.control_pin, GPIO.LOW)
                logger.info(f"Stopped pump via relay on GPIO {self.control_pin}")
                self._status = PumpStatus.STOPPED
                return True
            except Exception as e:
                logger.error(f"Error stopping pump via relay: {e}")
                self._last_error = str(e)
                return False
            
        if not self.connected:
            logger.error("Not connected to pump")
            return False
        
        try:
            # Write to coil 1 (start/stop)
            result = self.client.write_coil(
                address=1,
                value=False,  # False = Stop
                unit=self.modbus_address
            )
            
            success = not result.isError() if result else False
            if success:
                logger.info("Pump stopped")
                self._status = PumpStatus.STOPPED
            else:
                logger.error("Failed to stop pump")
                
            # Check for error code
            error_code = self._check_error()
            if error_code:
                logger.error(f"Stop error: {error_code}")
                return False
                
            return success
        except Exception as e:
            logger.error(f"Error stopping pump: {e}")
            self._last_error = str(e)
            return False
    
    def is_running(self) -> bool:
        """Check if the pump is currently running.
        
        Returns:
            bool: True if pump is running, False otherwise
        """
        if self.use_relay:
            return self._status == PumpStatus.RUNNING
            
        if not self.connected:
            logger.debug("Not connected to pump, assuming stopped")
            return False
            
        try:
            # Read coil 1 to check if running
            result = self.client.read_coils(
                address=1,
                count=1,
                unit=self.modbus_address
            )
            
            if result.isError():
                logger.error(f"Error checking pump status: {result}")
                return self._status == PumpStatus.RUNNING
                
            is_running = result.bits[0]
            self._status = PumpStatus.RUNNING if is_running else PumpStatus.STOPPED
            return is_running
            
        except Exception as e:
            logger.error(f"Error checking if pump is running: {e}")
            # Return the last known status
            return self._status == PumpStatus.RUNNING
    
    def get_flow_rate(self) -> float:
        """Get the current flow rate in mL/min.
        
        Returns:
            float: Current flow rate in mL/min
        """
        if self.use_relay:
            # In relay mode, we can only return the stored value
            return self._current_flow_rate if self.is_running() else 0.0
            
        if not self.connected:
            logger.debug("Not connected to pump, returning stored flow rate")
            return self._current_flow_rate if self.is_running() else 0.0
            
        try:
            # Read input registers 4-5 (current flow rate)
            result = self.client.read_input_registers(
                address=4,
                count=2,
                unit=self.modbus_address
            )
            
            if result.isError():
                logger.error(f"Error reading flow rate: {result}")
                return self._current_flow_rate if self.is_running() else 0.0
                
            # Convert the two registers to a float value
            flow_bytes = struct.pack('>HH', result.registers[0], result.registers[1])
            flow_rate = struct.unpack('>f', flow_bytes)[0]
            
            self._current_flow_rate = flow_rate
            return flow_rate
            
        except Exception as e:
            logger.error(f"Error getting flow rate: {e}")
            # Return the last known flow rate
            return self._current_flow_rate if self.is_running() else 0.0
    
    def get_status(self) -> Dict[str, Any]:
        """Get current pump status information.
        
        Returns:
            Dict[str, Any]: Status information
        """
        is_running = self.is_running()
        flow_rate = self.get_flow_rate()
        
        return {
            "connected": self.connected,
            "running": is_running,
            "flow_rate_ml_min": flow_rate,
            "flow_rate_ml_h": flow_rate * 60,
            "last_command_time": self._last_command_time,
            "last_error": self._last_error,
            "mode": "relay" if self.use_relay else "modbus",
            "min_flow_ml_h": self.min_flow_ml_h,
            "max_flow_ml_h": self.max_flow_ml_h
        }
    
    def _check_error(self) -> int:
        """Check if there was an error in the last command.
        
        Returns:
            int: Error code (0 if no error)
        """
        if self.use_relay:
            return 0
            
        try:
            # Read input register 50 (error code)
            result = self.client.read_input_registers(
                address=50,
                count=1,
                unit=self.modbus_address
            )
            
            if result.isError():
                return 0
                
            return result.registers[0]
        except Exception:
            return 0