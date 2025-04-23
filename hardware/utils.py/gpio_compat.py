"""Compatibility module for GPIO access."""
import logging

logger = logging.getLogger(__name__)

# Try to import RPi.GPIO - will only work on Raspberry Pi
try:
    import RPi.GPIO as GPIO
    USING_REAL_GPIO = True
    logger.info("Using real Raspberry Pi GPIO")
except ImportError:
    logger.warning("RPi.GPIO not available - using mock implementation")
    USING_REAL_GPIO = False
    
    # Create a simple mock GPIO class
    class MockGPIO:
        BCM = 11
        BOARD = 10
        OUT = 0
        IN = 1
        HIGH = 1
        LOW = 0
        PUD_DOWN = 21
        PUD_UP = 22
        RISING = 31
        FALLING = 32
        BOTH = 33
        
        @staticmethod
        def setmode(mode):
            logger.debug(f"Mock GPIO: setmode({mode})")
        
        @staticmethod
        def setup(pin, mode, pull_up_down=None, initial=None):
            pull_msg = f", pull_up_down={pull_up_down}" if pull_up_down is not None else ""
            initial_msg = f", initial={initial}" if initial is not None else ""
            logger.debug(f"Mock GPIO: setup(pin={pin}, mode={mode}{pull_msg}{initial_msg})")
        
        @staticmethod
        def output(pin, value):
            logger.debug(f"Mock GPIO: output(pin={pin}, value={value})")
        
        @staticmethod
        def input(pin):
            logger.debug(f"Mock GPIO: input(pin={pin})")
            return 0
            
        @staticmethod
        def cleanup(pin=None):
            if pin is None:
                logger.debug("Mock GPIO: cleanup all")
            else:
                logger.debug(f"Mock GPIO: cleanup pin {pin}")
        
        @staticmethod
        def add_event_detect(pin, edge, callback=None, bouncetime=None):
            bounce_msg = f", bouncetime={bouncetime}" if bouncetime is not None else ""
            callback_msg = ", with callback" if callback is not None else ""
            logger.debug(f"Mock GPIO: add_event_detect(pin={pin}, edge={edge}{bounce_msg}{callback_msg})")
        
        @staticmethod
        def remove_event_detect(pin):
            logger.debug(f"Mock GPIO: remove_event_detect(pin={pin})")
    
    # Use our mock implementation
    GPIO = MockGPIO