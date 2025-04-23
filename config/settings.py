"""Configuration and settings module for pool automation system."""
import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Default settings
DEFAULT_SETTINGS = {
    "system": {
        "name": "Pool Automation System",
        "simulation_mode": True
    },
    "hardware": {
        "turbidity_sensor": {
            "type": "ChemitecS461LT",
            "port": "COM3",  # Change to /dev/ttyUSB0 on Raspberry Pi
            "modbus_address": 1,
            "baud_rate": 9600
        },
        "pac_pump": {
            "type": "ChonryWP110",
            "port": "COM4",  # Change to /dev/ttyUSB1 on Raspberry Pi
            "modbus_address": 1,
            "baud_rate": 9600,
            "min_flow_ml_h": 60,
            "max_flow_ml_h": 150
        },
        "steiel_controller": {
            "port": "COM5",  # Change to /dev/ttyUSB2 on Raspberry Pi
            "modbus_address": 1,
            "baud_rate": 9600
        }
    },
    "dosing": {
        "high_threshold_ntu": 0.25,
        "low_threshold_ntu": 0.12,
        "target_ntu": 0.15,
        "moving_avg_samples": 10
    }
}

# In-memory settings
_settings = DEFAULT_SETTINGS.copy()

def load_settings(filename: str = 'settings.json') -> Dict[str, Any]:
    """Load settings from file.
    
    Args:
        filename: Settings filename
        
    Returns:
        Dict[str, Any]: Loaded settings
    """
    global _settings
    
    if os.path.exists(filename):
        try:
            with open(filename, 'r') as f:
                loaded_settings = json.load(f)
                
            # Merge with default settings
            _settings = merge_dicts(DEFAULT_SETTINGS, loaded_settings)
            logger.info(f"Settings loaded from {filename}")
        except Exception as e:
            logger.error(f"Error loading settings: {e}")
            _settings = DEFAULT_SETTINGS.copy()
    else:
        logger.warning(f"Settings file {filename} not found, using defaults")
        _settings = DEFAULT_SETTINGS.copy()
        
    return _settings

def save_settings(filename: str = 'settings.json') -> bool:
    """Save current settings to file.
    
    Args:
        filename: Settings filename
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        with open(filename, 'w') as f:
            json.dump(_settings, f, indent=2)
            
        logger.info(f"Settings saved to {filename}")
        return True
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        return False

def get(path: str, default: Any = None) -> Any:
    """Get a setting value by path.
    
    Args:
        path: Setting path (e.g., 'system.name')
        default: Default value if path not found
        
    Returns:
        Any: Setting value
    """
    parts = path.split('.')
    value = _settings
    
    for part in parts:
        if isinstance(value, dict) and part in value:
            value = value[part]
        else:
            return default
            
    return value

def set(path: str, value: Any) -> bool:
    """Set a setting value by path.
    
    Args:
        path: Setting path (e.g., 'system.name')
        value: Value to set
        
    Returns:
        bool: True if successful, False otherwise
    """
    global _settings
    
    parts = path.split('.')
    current = _settings
    
    # Navigate to the parent of the target key
    for i, part in enumerate(parts[:-1]):
        if part not in current:
            current[part] = {}
        current = current[part]
        
    # Set the value
    current[parts[-1]] = value
    return True

def merge_dicts(d1: Dict[str, Any], d2: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merge two dictionaries.
    
    Args:
        d1: First dictionary
        d2: Second dictionary
        
    Returns:
        Dict[str, Any]: Merged dictionary
    """
    result = d1.copy()
    
    for k, v in d2.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = merge_dicts(result[k], v)
        else:
            result[k] = v
            
    return result