"""
Turbidity-based PAC dosing controller.
"""

import time
import logging
import threading
from enum import Enum

logger = logging.getLogger(__name__)

class DosingMode(Enum):
    """Enumeration of possible dosing modes."""
    OFF = 0
    AUTOMATIC = 1
    MANUAL = 2

class DosingController:
    """Controller for PAC dosing based on turbidity readings."""
    
    def __init__(self, sensor, pump, config, event_logger=None):
        """Initialize the dosing controller.
        
        Args:
            sensor: Turbidity sensor object with get_reading() method
            pump: PAC dosing pump object with start(), stop() methods
            config (dict): Configuration dictionary with parameters
            event_logger: Optional function for logging dosing events
        """
        self.sensor = sensor
        self.pump = pump
        self.config = config
        self.event_logger = event_logger
        
        # State variables
        self.mode = DosingMode.OFF
        self.running = False
        self.last_dose_time = 0
        self.dose_counter = 0
        
        # Dosing parameters (load from config with defaults)
        self.high_threshold = config.get('high_threshold_ntu', 0.25)
        self.low_threshold = config.get('low_threshold_ntu', 0.12)
        self.target_ntu = config.get('target_ntu', 0.15)
        self.min_dose_interval = config.get('min_dose_interval_sec', 300)  # 5 minutes
        self.dose_duration = config.get('dose_duration_sec', 30)  # 30 seconds
        
        # For status display
        self.start_time = time.time()
        
        logger.info(f"Dosing controller initialized with thresholds: high={self.high_threshold}, "
                    f"low={self.low_threshold}, target={self.target_ntu}")
    
    def start(self, mode=DosingMode.AUTOMATIC):
        """Start the dosing controller."""
        if self.running:
            logger.warning("Dosing controller already running")
            return
        
        self.mode = mode
        self.running = True
        logger.info(f"Dosing controller started in {mode.name} mode")
        
        # Start monitoring thread if in automatic mode
        if mode == DosingMode.AUTOMATIC:
            self._start_monitoring()
    
    def stop(self):
        """Stop the dosing controller."""
        self.running = False
        # Ensure pump is stopped
        self.pump.stop()
        logger.info("Dosing controller stopped")
    
    def _start_monitoring(self):
        """Start the monitoring thread for automatic mode."""
        def monitor_loop():
            while self.running and self.mode == DosingMode.AUTOMATIC:
                try:
                    self._check_and_dose()
                except Exception as e:
                    logger.error(f"Error in monitoring loop: {e}")
                time.sleep(10)  # Check every 10 seconds
        
        # Start monitoring in a separate thread
        monitoring_thread = threading.Thread(target=monitor_loop, daemon=True)
        monitoring_thread.start()
        logger.info("Monitoring thread started")
    
    def _check_and_dose(self):
        """Check turbidity and dose if needed."""
        # Skip if we've dosed recently
        time_since_last_dose = time.time() - self.last_dose_time
        if time_since_last_dose < self.min_dose_interval:
            return
        
        # Get current turbidity
        turbidity = self.sensor.get_reading()
        if turbidity is None:
            logger.error("Failed to get turbidity reading")
            return
        
        # Check if we need to dose
        if turbidity > self.high_threshold:
            logger.info(f"Turbidity above threshold ({turbidity:.3f} > {self.high_threshold}), "
                        f"starting PAC dose")
            self._dose()
    
    def _dose(self):
        """Activate the PAC dosing pump for the configured duration."""
        # Record dose time
        self.last_dose_time = time.time()
        self.dose_counter += 1
        
        # Get current turbidity
        turbidity = self.sensor.get_reading()
        
        # Calculate desired flow rate based on how far we are from target
        if hasattr(self.pump, 'set_flow_rate'):
            max_flow = self.config.get('pac_max_flow', 150)
            min_flow = self.config.get('pac_min_flow', 60)
            
            # Simple linear adjustment based on turbidity deviation
            deviation = (turbidity - self.target_ntu) / (self.high_threshold - self.target_ntu)
            deviation = max(0.0, min(1.0, deviation))  # Clamp to 0.0-1.0
            
            flow_rate = min_flow + deviation * (max_flow - min_flow)
            self.pump.set_flow_rate(flow_rate)
            
            logger.info(f"Dosing with flow rate: {flow_rate:.1f} ml/h at turbidity: {turbidity:.3f} NTU")
        else:
            flow_rate = None
            logger.info(f"Dosing at turbidity: {turbidity:.3f} NTU")
        
        # Start the pump with configured duration
        self.pump.start(duration=self.dose_duration)
        
        # Log the dosing event
        if self.event_logger:
            self.event_logger(
                "PAC", self.dose_duration, 
                flow_rate, turbidity
            )
    
    def manual_dose(self, duration=None, flow_rate=None):
        """Manually activate the PAC dosing pump.
        
        Args:
            duration (int, optional): Override for dose duration in seconds.
            flow_rate (float, optional): Override for pump flow rate in ml/h.
        """
        if self.mode != DosingMode.MANUAL:
            logger.warning("Manual dosing attempted while not in manual mode")
            return False
        
        # Use provided values or defaults
        duration = duration or self.dose_duration
        
        # Set flow rate if provided and supported by pump
        if flow_rate is not None and hasattr(self.pump, 'set_flow_rate'):
            self.pump.set_flow_rate(flow_rate)
        
        # Record dose time
        self.last_dose_time = time.time()
        self.dose_counter += 1
        
        # Get current turbidity for logging
        turbidity = self.sensor.get_reading()
        
        logger.info(f"Manual dosing started for {duration} seconds")
        
        # Start the pump
        self.pump.start(duration=duration)
        
        # Log the dosing event
        if self.event_logger:
            self.event_logger(
                "PAC-Manual", duration,
                flow_rate or getattr(self.pump, 'flow_rate', None), 
                turbidity
            )
        
        return True
    
    def set_mode(self, mode):
        """Set the dosing mode.
        
        Args:
            mode (DosingMode): New operation mode
        """
        if mode == self.mode:
            return
        
        old_mode = self.mode
        self.mode = mode
        
        # Stop pump when switching modes
        self.pump.stop()
        
        # Start monitoring if entering automatic mode
        if mode == DosingMode.AUTOMATIC and old_mode != DosingMode.AUTOMATIC:
            self._start_monitoring()
        
        logger.info(f"Dosing mode changed from {old_mode.name} to {mode.name}")
    
    def get_status(self):
        """Get the current status of the dosing controller.
        
        Returns:
            dict: Status information
        """
        return {
            'mode': self.mode.name,
            'running': self.running,
            'last_dose_time': self.last_dose_time,
            'dose_counter': self.dose_counter,
            'uptime': time.time() - self.start_time,
            'high_threshold': self.high_threshold,
            'low_threshold': self.low_threshold,
            'target': self.target_ntu,
            'pump_running': self.pump.is_running() if hasattr(self.pump, 'is_running') else False
        }