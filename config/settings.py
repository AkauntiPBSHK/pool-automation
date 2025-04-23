# config/settings.py
import os
import json
import logging

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
            "control_pin": 17,
            "min_flow_ml_h": 60,
            "max_flow_ml_h": 150
        },
        "steiel_controller": {
            "enabled": False,
            "port": "/dev/ttyUSB1",
            "modbus_address": 1,
            "baud_rate": 9600
        }
    },
    "dosing": {
        "high_threshold_ntu": 0.25,
        "low_threshold_ntu": 0.12,
        "target_ntu": 0.15,
        "min_dose_interval_sec": 300,
        "max_dose_duration_sec": 30,
        "moving_avg_samples": 10
    },
    "network": {
        "enable_api": True,
        "api_port": 5000
    },
    "notifications": {
        "enabled": False,
        "email": {
            "enabled": False,
            "smtp_server": "smtp.gmail.com",
            "smtp_port": 587,
            "use_tls": True,
            "username": "",
            "password": "",
            "from_address": "",
            "to_address": ""
        }
    }
}

# Current settings
_settings = DEFAULT_SETTINGS.copy()

# Settings file path
_settings_file = os.path.join(os.path.dirname(__file__), 'settings.json')

def load_settings():
    """Load settings from file."""
    global _settings
    
    try:
        if os.path.exists(_settings_file):
            with open(_settings_file, 'r') as f:
                loaded_settings = json.load(f)
            
            # Merge loaded settings with defaults
            _settings = _merge_dicts(DEFAULT_SETTINGS, loaded_settings)
            logger.info(f"Settings loaded from {_settings_file}")
        else:
            # Create default settings file if it doesn't exist
            save_settings()
            logger.info(f"Default settings created")
    except Exception as e:
        logger.error(f"Error loading settings: {e}")
        logger.warning("Using default settings")
        _settings = DEFAULT_SETTINGS.copy()

def save_settings():
    """Save settings to file."""
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(_settings_file), exist_ok=True)
        
        with open(_settings_file, 'w') as f:
            json.dump(_settings, f, indent=4)
        logger.info(f"Settings saved to file")
        return True
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        return False

def get(path, default=None):
    """Get a setting value by path.
    
    Args:
        path: Dot-separated path to the setting (e.g., 'hardware.turbidity_sensor.port')
        default: Default value if path doesn't exist
        
    Returns:
        The setting value or the default
    """
    current = _settings
    try:
        for part in path.split('.'):
            current = current[part]
        return current
    except (KeyError, TypeError):
        return default

def set(path, value):
    """Set a setting value by path.
    
    Args:
        path: Dot-separated path to the setting
        value: New value
        
    Returns:
        bool: Success status
    """
    global _settings
    
    parts = path.split('.')
    current = _settings
    
    try:
        # Navigate to the parent of the target setting
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        # Set the value
        current[parts[-1]] = value
        return True
    except Exception as e:
        logger.error(f"Error setting {path}: {e}")
        return False

def reset():
    """Reset settings to defaults."""
    global _settings
    _settings = DEFAULT_SETTINGS.copy()
    return save_settings()

def _merge_dicts(dict1, dict2):
    """Deep merge dict2 into dict1."""
    result = dict1.copy()
    
    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _merge_dicts(result[key], value)
        else:
            result[key] = value
    
    return result

# Load settings at module initialization
load_settings()