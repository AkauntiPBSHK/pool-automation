"""Hardware interfaces for the Pool Automation System."""
import logging
from config import settings

logger = logging.getLogger(__name__)

def initialize_hardware(simulation_mode=None):
    """Initialize hardware components based on configuration."""
    # If simulation_mode is not explicitly provided, use the setting
    if simulation_mode is None:
        simulation_mode = settings.get('system.simulation_mode', True)
    
    logger.info(f"Initializing hardware in {'SIMULATION' if simulation_mode else 'PRODUCTION'} mode")
    
    # Dictionary to hold hardware instances
    hardware = {
        'simulation_mode': simulation_mode,
        'sensors': {},
        'actuators': {},
        'controllers': {}
    }
    
    # Initialize turbidity sensor
    turbidity_sensor_type = settings.get('hardware.turbidity_sensor.type')
    if simulation_mode:
        # Import mock sensor for simulation mode
        from hardware.sensors.mock import MockTurbiditySensor
        hardware['sensors']['turbidity'] = MockTurbiditySensor(
            settings.get('hardware.turbidity_sensor', {})
        )
        logger.info("Initialized mock turbidity sensor")
    else:
        # Import real sensor for production mode
        try:
            if turbidity_sensor_type == 'ChemitecS461LT':
                from hardware.sensors.chemitec import ChemitecS461LT
                hardware['sensors']['turbidity'] = ChemitecS461LT(
                    settings.get('hardware.turbidity_sensor', {})
                )
                logger.info(f"Initialized {turbidity_sensor_type} sensor")
            else:
                logger.error(f"Unknown turbidity sensor type: {turbidity_sensor_type}")
                # Fall back to mock sensor
                from hardware.sensors.mock import MockTurbiditySensor
                hardware['sensors']['turbidity'] = MockTurbiditySensor(
                    settings.get('hardware.turbidity_sensor', {})
                )
        except Exception as e:
            logger.error(f"Error initializing turbidity sensor: {e}")
            # Fall back to mock sensor
            from hardware.sensors.mock import MockTurbiditySensor
            hardware['sensors']['turbidity'] = MockTurbiditySensor(
                settings.get('hardware.turbidity_sensor', {})
            )
    
    # Initialize PAC pump
    pac_pump_type = settings.get('hardware.pac_pump.type')
    if simulation_mode:
        # Import mock pump for simulation mode
        from hardware.actuators.mock import MockPump
        hardware['actuators']['pac_pump'] = MockPump(
            settings.get('hardware.pac_pump', {})
        )
        logger.info("Initialized mock PAC pump")
    else:
        # Import real pump for production mode
        try:
            if pac_pump_type == 'ChonryWP110':
                from hardware.actuators.chonry import ChonryWP110
                hardware['actuators']['pac_pump'] = ChonryWP110(
                    settings.get('hardware.pac_pump', {})
                )
                logger.info(f"Initialized {pac_pump_type} pump")
            else:
                logger.error(f"Unknown PAC pump type: {pac_pump_type}")
                # Fall back to mock pump
                from hardware.actuators.mock import MockPump
                hardware['actuators']['pac_pump'] = MockPump(
                    settings.get('hardware.pac_pump', {})
                )
        except Exception as e:
            logger.error(f"Error initializing PAC pump: {e}")
            # Fall back to mock pump
            from hardware.actuators.mock import MockPump
            hardware['actuators']['pac_pump'] = MockPump(
                settings.get('hardware.pac_pump', {})
            )
    
    # Additional hardware initialization (Steiel controller, etc.) would go here
    
    return hardware