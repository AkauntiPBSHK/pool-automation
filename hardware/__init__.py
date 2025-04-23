# hardware/__init__.py
import logging
import platform
from config import settings

logger = logging.getLogger(__name__)

# Global simulation environment instance
simulation_env = None

def initialize_hardware():
    """Initialize hardware components based on configuration."""
    global simulation_env
    
    simulation_mode = settings.get('system.simulation_mode', False)
    
    # In development without hardware, always use simulation mode
    if not simulation_mode:
        # Check if we're on a Raspberry Pi
        if not platform.machine().startswith('arm'):
            logger.info("Not running on Raspberry Pi hardware - forcing simulation mode")
            simulation_mode = True
            settings.set('system.simulation_mode', True)
    
    logger.info(f"Initializing hardware in {'SIMULATION' if simulation_mode else 'PRODUCTION'} mode")
    
    hardware = {
        'simulation_mode': simulation_mode,
        'sensors': {},
        'actuators': {},
        'controllers': {}
    }
    
    # Initialize simulation environment if in simulation mode
    if simulation_mode:
        from hardware.simulation import SimulationEnvironment
        simulation_env = SimulationEnvironment()
        simulation_env.start()
        hardware['simulation_env'] = simulation_env
    
    # Initialize turbidity sensor
    if simulation_mode:
        from hardware.sensors.turbidity import MockTurbiditySensor
        hardware['sensors']['turbidity'] = MockTurbiditySensor(
            settings.get('hardware.turbidity_sensor', {}),
            simulation_env
        )
    else:
        try:
            from hardware.sensors.turbidity import ChemitecTurbiditySensor
            hardware['sensors']['turbidity'] = ChemitecTurbiditySensor(
                settings.get('hardware.turbidity_sensor', {})
            )
        except ImportError as e:
            logger.error(f"Failed to import ChemitecTurbiditySensor: {e}")
            logger.warning("Falling back to mock turbidity sensor")
            from hardware.sensors.turbidity import MockTurbiditySensor
            hardware['sensors']['turbidity'] = MockTurbiditySensor(
                settings.get('hardware.turbidity_sensor', {}),
                simulation_env
            )
    
    # Initialize PAC pump
    if simulation_mode:
        from hardware.actuators.pumps import MockPump
        hardware['actuators']['pac_pump'] = MockPump(
            settings.get('hardware.pac_pump', {}),
            'pac',
            simulation_env
        )
    else:
        try:
            from hardware.actuators.pumps import ChonryPump
            hardware['actuators']['pac_pump'] = ChonryPump(
                settings.get('hardware.pac_pump', {})
            )
        except ImportError as e:
            logger.error(f"Failed to import ChonryPump: {e}")
            logger.warning("Falling back to mock pump")
            from hardware.actuators.pumps import MockPump
            hardware['actuators']['pac_pump'] = MockPump(
                settings.get('hardware.pac_pump', {}),
                'pac',
                simulation_env
            )
    
    # Initialize Steiel controller if needed
    if settings.get('hardware.steiel_controller.enabled', False):
        if simulation_mode:
            from hardware.controllers.steiel import MockSteielController
            hardware['controllers']['steiel'] = MockSteielController(
                settings.get('hardware.steiel_controller.port', '/dev/ttyUSB1'),
                settings.get('hardware.steiel_controller.modbus_address', 1),
                simulation_env
            )
        else:
            try:
                from hardware.controllers.steiel import SteielController
                hardware['controllers']['steiel'] = SteielController(
                    settings.get('hardware.steiel_controller.port', '/dev/ttyUSB1'),
                    settings.get('hardware.steiel_controller.modbus_address', 1)
                )
            except ImportError as e:
                logger.error(f"Failed to import SteielController: {e}")
                logger.warning("Falling back to mock Steiel controller")
                from hardware.controllers.steiel import MockSteielController
                hardware['controllers']['steiel'] = MockSteielController(
                    settings.get('hardware.steiel_controller.port', '/dev/ttyUSB1'),
                    settings.get('hardware.steiel_controller.modbus_address', 1),
                    simulation_env
                )
    
    return hardware