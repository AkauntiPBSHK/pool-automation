"""Configuration module for Pool Automation System."""
import os
import json
import logging

# Logger setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("pool_automation.log"),
        logging.StreamHandler()
    ]
)

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
            "port": "/dev/ttyUSB1",
            "modbus_address": 1,
            "baud_rate": 9600
        }
    },
    "dosing": {
        "high_threshold_ntu": 0.25,
        "low_threshold_ntu": 0.12,
        "target_ntu": 0.15,
        "moving_avg_samples": 10
    },
    "network": {
        "enable_api": True,
        "api_port": 5000
    },
    "notification": {
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

# Settings singleton
class Settings:
    _instance = None
    _settings = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Settings, cls).__new__(cls)
            cls._instance._load_settings()
        return cls._instance
    
    def _load_settings(self):
        """Load settings from file or use defaults"""
        try:
            # Try to load from settings.json file
            if os.path.exists('settings.json'):
                with open('settings.json', 'r') as f:
                    self._settings = json.load(f)
                    logger.info("Settings loaded from file")
            else:
                # Use default settings
                self._settings = DEFAULT_SETTINGS
                self._save_settings()
                logger.info("Default settings created")
        except Exception as e:
            logger.error(f"Error loading settings: {e}")
            self._settings = DEFAULT_SETTINGS
    
    def _save_settings(self):
        """Save settings to file"""
        try:
            with open('settings.json', 'w') as f:
                json.dump(self._settings, f, indent=4)
            logger.info("Settings saved to file")
        except Exception as e:
            logger.error(f"Error saving settings: {e}")
    
    def get(self, path, default=None):
        """Get a setting value by path (e.g., 'system.name')"""
        try:
            keys = path.split('.')
            value = self._settings
            for key in keys:
                value = value[key]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, path, value):
        """Set a setting value by path (e.g., 'system.name')"""
        keys = path.split('.')
        settings = self._settings
        
        # Navigate to the right level
        for key in keys[:-1]:
            if key not in settings:
                settings[key] = {}
            settings = settings[key]
        
        # Set the value
        settings[keys[-1]] = value
        self._save_settings()

# Create a settings instance to use throughout the application
settings = Settings()