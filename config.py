import os
import logging
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

class Config:
    """Base configuration."""
    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-CHANGE-IN-PRODUCTION')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    DEBUG = False
    TESTING = False
    
    # Database settings
    DATABASE_PATH = os.path.join(os.getcwd(), 'pool_automation.db')
    
    # System settings
    SIMULATION_MODE = True
    
    # Socket.IO settings
    SOCKETIO_PING_TIMEOUT = int(os.getenv('SOCKETIO_PING_TIMEOUT', 60))
    SOCKETIO_PING_INTERVAL = int(os.getenv('SOCKETIO_PING_INTERVAL', 25))
    
    # Hardware settings
    HARDWARE = {
        'turbidity_sensor': {
            'port': os.getenv('TURBIDITY_SENSOR_PORT', '/dev/ttyUSB0'),
            'modbus_address': int(os.getenv('TURBIDITY_SENSOR_ADDRESS', 1)),
            'baud_rate': int(os.getenv('TURBIDITY_SENSOR_BAUDRATE', 9600))
        },
        'pac_pump': {
            'control_pin': int(os.getenv('PAC_PUMP_PIN', 17)),
            'min_flow_ml_h': float(os.getenv('PAC_PUMP_MIN_FLOW', 60)),
            'max_flow_ml_h': float(os.getenv('PAC_PUMP_MAX_FLOW', 150))
        }
    }
    
    # Simulator settings
    SIMULATOR = {
        'time_scale': float(os.getenv('SIMULATOR_TIME_SCALE', 1.0)),
        'random_events': os.getenv('SIMULATOR_RANDOM_EVENTS', 'True').lower() == 'true'
    }
    
    # Email notification settings
    SMTP_SERVER = os.getenv('SMTP_SERVER', '')
    SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
    SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
    NOTIFICATION_FROM = os.getenv('NOTIFICATION_FROM', '')
    
    # Dosing settings
    DOSING_HIGH_THRESHOLD = float(os.getenv('DOSING_HIGH_THRESHOLD', 0.25))
    DOSING_LOW_THRESHOLD = float(os.getenv('DOSING_LOW_THRESHOLD', 0.12))
    DOSING_TARGET = float(os.getenv('DOSING_TARGET', 0.15))
    DOSING_MIN_INTERVAL = int(os.getenv('DOSING_MIN_INTERVAL', 300))
    DOSING_DURATION = int(os.getenv('DOSING_DURATION', 30))
    DOSING_PID_KP = float(os.getenv('DOSING_PID_KP', 1.0))
    DOSING_PID_KI = float(os.getenv('DOSING_PID_KI', 0.1))
    DOSING_PID_KD = float(os.getenv('DOSING_PID_KD', 0.05))
    
    # Logging settings
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    def configure_logging(self):
        """Configure logging based on settings."""
        level = getattr(logging, self.LOG_LEVEL.upper(), logging.INFO)
        logging.basicConfig(
            level=level,
            format=self.LOG_FORMAT
        )
        return logging.getLogger(__name__)


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True
    DATABASE_PATH = os.path.join(os.getcwd(), 'test_pool_automation.db')


class ProductionConfig(Config):
    """Production configuration."""
    SECRET_KEY = os.getenv('SECRET_KEY')  # Must be set in production
    SIMULATION_MODE = os.getenv('SIMULATION_MODE', 'false').lower() == 'true'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'WARNING')
    
    # In production, set an absolute path for the database
    DATABASE_PATH = os.getenv('DATABASE_PATH', '/var/www/pool-automation/pool_automation.db')
    
    # For PostgreSQL (if used)
    DB_USER = os.getenv('DB_USER', '')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'pool_automation')
    DB_TYPE = os.getenv('DB_TYPE', 'sqlite')  # 'sqlite' or 'postgresql'
    
    def __init__(self):
        """Validate production configuration."""
        if not self.SECRET_KEY:
            logger = logging.getLogger(__name__)
            logger.warning("No SECRET_KEY set for production environment - using fallback")
            self.SECRET_KEY = 'prod-fallback-key-CHANGE-THIS-IMMEDIATELY'


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}


def get_config():
    """Get the appropriate configuration based on environment."""
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default'])()