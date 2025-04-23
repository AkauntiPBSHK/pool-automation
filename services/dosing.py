# services/dosing.py
import logging
import time
import threading
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)

class DosingMode(Enum):
    """Enum for dosing controller modes."""
    OFF = 0
    AUTO = 1
    MANUAL = 2
    
    @classmethod
    def from_string(cls, mode_str):
        """Convert a string to a DosingMode."""
        mode_map = {
            'off': cls.OFF,
            'auto': cls.AUTO,
            'manual': cls.MANUAL
        }
        return mode_map.get(mode_str.lower(), cls.OFF)

class DosingController:
    """Controller for PAC dosing based on turbidity readings."""
    
    def __init__(self, sensor, pump, config=None, parent=None):
        """Initialize the dosing controller."""
        self.sensor = sensor
        self.pump = pump
        self.config = config or {}
        self.parent = parent  # Reference to parent system
        
        # State
        self.mode = DosingMode.OFF
        self.last_dose_time = 0
        self.dose_counter = 0
        
        # Settings
        self.high_threshold = self.config.get('high_threshold_ntu', 0.25)
        self.low_threshold = self.config.get('low_threshold_ntu', 0.12)
        self.target_ntu = self.config.get('target_ntu', 0.15)
        self.min_dose_interval = self.config.get('min_dose_interval_sec', 300)  # 5 min between doses
        self.max_dose_duration = self.config.get('max_dose_duration_sec', 30)  # 30 sec max dose
        
        logger.info(f"Dosing controller initialized with thresholds: high={self.high_threshold}, "
                   f"low={self.low_threshold}, target={self.target_ntu}")
    
    def update(self):
        """Update the controller state and take action if needed."""
        # Skip if not in AUTO mode
        if self.mode != DosingMode.AUTO:
            return
        
        # Get current turbidity reading
        turbidity = self.sensor.get_reading()
        
        # Check if we need to dose PAC
        current_time = time.time()
        time_since_last_dose = current_time - self.last_dose_time
        
        if turbidity > self.high_threshold and time_since_last_dose > self.min_dose_interval:
            # Calculate dose duration based on how far we are from target
            deviation_ratio = (turbidity - self.target_ntu) / (self.high_threshold - self.target_ntu)
            deviation_ratio = max(0.3, min(1.0, deviation_ratio))  # Limit between 0.3 and 1.0
            
            duration = max(10, min(self.max_dose_duration, int(self.max_dose_duration * deviation_ratio)))
            
            # Calculate flow rate based on deviation
            max_flow = self.pump.max_flow_ml_h
            min_flow = self.pump.min_flow_ml_h
            flow_rate = min_flow + deviation_ratio * (max_flow - min_flow)
            
            # Set flow rate and start dosing
            self.pump.set_flow_rate(flow_rate)
            self._dose(duration, flow_rate, turbidity, True)
            
            logger.info(f"Auto dosing: turbidity={turbidity:.3f} NTU, "
                       f"flow={flow_rate:.1f} ml/h, duration={duration}s")
    
    def manual_dose(self, flow_rate_ml_h, duration_sec):
        """Start a manual dosing operation.
        
        Args:
            flow_rate_ml_h: Flow rate in ml/h
            duration_sec: Duration in seconds
            
        Returns:
            bool: Success status
        """
        if self.mode != DosingMode.MANUAL:
            logger.warning(f"Cannot start manual dosing in {self.mode.name} mode")
            return False
        
        if duration_sec > self.max_dose_duration:
            duration_sec = self.max_dose_duration
            logger.warning(f"Limiting duration to maximum of {self.max_dose_duration} seconds")
        
        # Set flow rate and start dosing
        self.pump.set_flow_rate(flow_rate_ml_h)
        turbidity = self.sensor.get_reading()
        self._dose(duration_sec, flow_rate_ml_h, turbidity, False)
        
        logger.info(f"Manual dosing: flow={flow_rate_ml_h:.1f} ml/h, duration={duration_sec}s")
        return True
    
    def _dose(self, duration, flow_rate, turbidity, is_automatic):
        """Start PAC dosing with the specified parameters."""
        # Record dose time
        self.last_dose_time = time.time()
        self.dose_counter += 1
        
        # Start the pump
        self.pump.start(duration)
        
        # Log the dosing event
        if self.parent and hasattr(self.parent, 'db'):
            from models.events import DosingEvent
            event = DosingEvent(
                pump_type='pac',
                parameter='turbidity',
                duration_seconds=duration,
                flow_rate=flow_rate,
                is_automatic=is_automatic,
                parameter_value_before=turbidity
            )
            self.parent.db.session.add(event)
            self.parent.db.session.commit()
        
        # Send notification if configured
        if self.parent and hasattr(self.parent, 'notification_manager'):
            self.parent.notification_manager.send_alert(
                f"PAC dose started (turbidity: {turbidity:.3f} NTU, flow: {flow_rate:.1f} ml/h)",
                level='info'
            )
    
    def stop_dosing(self):
        """Stop the current dosing operation."""
        result = self.pump.stop()
        logger.info("Dosing stopped")
        return result
    
    def set_mode(self, mode):
        """Set the dosing mode.
        
        Args:
            mode: Either a DosingMode enum value or a string ('off', 'auto', 'manual')
            
        Returns:
            bool: Success status
        """
        if isinstance(mode, str):
            mode = DosingMode.from_string(mode)
        
        if not isinstance(mode, DosingMode):
            logger.error(f"Invalid dosing mode: {mode}")
            return False
        
        self.mode = mode
        logger.info(f"Dosing controller mode set to {mode.name}")
        
        # Stop any active dosing when changing modes
        if self.pump.is_running():
            self.stop_dosing()
        
        return True
    
    def get_mode(self):
        """Get the current dosing mode."""
        return self.mode
    
    def get_status(self):
        """Get the current controller status."""
        return {
            'mode': self.mode.name,
            'pump_running': self.pump.is_running(),
            'last_dose_time': self.last_dose_time,
            'dose_counter': self.dose_counter,
            'high_threshold': self.high_threshold,
            'low_threshold': self.low_threshold,
            'target': self.target_ntu,
            'flow_rate': self.pump.get_flow_rate() * 60  # Convert to ml/h
        }
    
    def set_thresholds(self, high_threshold=None, low_threshold=None, target=None):
        """Set the turbidity thresholds."""
        if high_threshold is not None:
            self.high_threshold = float(high_threshold)
        
        if low_threshold is not None:
            self.low_threshold = float(low_threshold)
        
        if target is not None:
            self.target_ntu = float(target)
        
        # Validate thresholds
        if self.low_threshold >= self.high_threshold:
            logger.warning("Low threshold must be less than high threshold. Adjusting.")
            self.low_threshold = self.high_threshold - 0.05
        
        if self.target_ntu <= self.low_threshold or self.target_ntu >= self.high_threshold:
            logger.warning("Target must be between low and high thresholds. Adjusting.")
            self.target_ntu = (self.low_threshold + self.high_threshold) / 2.0
        
        logger.info(f"Updated thresholds: high={self.high_threshold}, "
                   f"low={self.low_threshold}, target={self.target_ntu}")
        
        return {
            'high_threshold': self.high_threshold,
            'low_threshold': self.low_threshold,
            'target': self.target_ntu
        }