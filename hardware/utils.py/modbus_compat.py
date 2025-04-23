"""Compatibility module for pymodbus different versions."""
import logging

logger = logging.getLogger(__name__)

# Check which pymodbus version we're using
try:
    # Attempt to import from the new location (3.0.0+)
    from pymodbus.client import ModbusSerialClient
    PYMODBUS_VERSION = ">=3.0.0"
except ImportError:
    # If that fails, try the older location
    try:
        from pymodbus.client import ModbusSerialClient
        PYMODBUS_VERSION = "<3.0.0"
    except ImportError:
        logger.error("Failed to import ModbusSerialClient. Please install pymodbus: pip install pymodbus")
        raise ImportError("Pymodbus library not found")

# Import exceptions
try:
    from pymodbus.exceptions import ModbusException, ConnectionException
except ImportError:
    logger.error("Failed to import pymodbus exceptions")
    
    # Define placeholder exceptions
    class ModbusException(Exception):
        pass
        
    class ConnectionException(ModbusException):
        pass

logger.info(f"Using pymodbus version {PYMODBUS_VERSION}")