# hardware/__init__.py
import logging
from config import settings

logger = logging.getLogger(__name__)

def initialize_hardware():
    """Initialize hardware components based on configuration."""
    simulation_mode = settings.get('system.simulation_mode', False)
    
    logger.info(f"Initializing hardware in {'SIMULATION' if simulation_mode else 'PRODUCTION'} mode")
    
    hardware = {
        'simulation_mode': simulation_mode,
        'sensors': {},
        'actuators': {},
        'controllers': {}
    }
    
    # Initialize turbidity sensor
    from hardware.sensors.turbidity import MockTurbiditySensor
    hardware['sensors']['turbidity'] = MockTurbiditySensor(
        settings.get('hardware.turbidity_sensor', {})
    )
    
    # Initialize PAC pump
    from hardware.actuators.pumps import MockPump
    hardware['actuators']['pac_pump'] = MockPump(
        settings.get('hardware.pac_pump', {})
    )
    
    # Initialize Steiel controller if needed
    if settings.get('hardware.steiel_controller.enabled', False):
        from hardware.controllers.steiel import MockSteielController
        hardware['controllers']['steiel'] = MockSteielController()
    
    return hardware