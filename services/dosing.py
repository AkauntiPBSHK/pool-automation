"""Dosing control logic for the Pool Automation System."""
import time
import logging
from enum import Enum
from config import settings

logger = logging.getLogger(__name__)

class DosingMode(Enum):
    """Dosing mode enumeration."""
    OFF = 0
    AUTO = 1
    MANUAL = 2

class DosingController:
    """Controller for PAC dosing based on turbidity readings."""
    
    def __init__(self, sensor, pump, config=None):
        """Initialize the dosing controller."""
        self.sensor = sensor
        self.pump = pump
        self.config = config or {}
        
        # Load configuration
        self.high_threshold = float(self.config.get('high_threshold_ntu', 
                                    settings.get('dosing.high_threshold_ntu', 0.25)))
        self.low_threshold = float(self.config.get('low_threshold_ntu', 
                                  settings.get('dosing.low_threshold_ntu', 0.12)))
        self.target_ntu = float(self.config.get('target_ntu', 
                               settings.get('dosing.target_ntu', 0.15)))
        
        # State
        self.mode = DosingMode.OFF
        self.last_dose_time = 0
        self.min_dose_interval = int(self.config.get('min_dose_interval_sec', 300))  # 5 minutes
        
        logger.info(f"Dosing controller initialized with thresholds: "
                   f"high={self.high_threshold:.3f} NTU, "
                   f"low={self.low_threshold:.3f} NTU, "
                   f"target={self.target_ntu:.3f} NTU")
    
    def set_mode(self, mode):
        """Set the dosing mode."""
        if not isinstance(mode, DosingMode):
            try:
                mode = DosingMode[mode]
            except (KeyError, TypeError):
                logger.error(f"Invalid dosing mode: {mode}")
                return False
        
        # If mode is changing to OFF, stop the pump
        if mode == DosingMode.OFF and self.mode != DosingMode.OFF:
            if self.pump.is_running():
                self.pump.stop()
        
        self.mode = mode
        logger.info(f"Dosing mode set to {self.mode.name}")
        return True
    
    def get_mode(self):
        """Get the current dosing mode."""
        return self.mode
    
    def update(self):
        """Update the dosing control based on the current mode and readings."""
        if self.mode == DosingMode.OFF:
            return
        
        if self.mode == DosingMode.AUTO:
            self._auto_control()
    
    def _auto_control(self):
        """Implement automatic dosing control based on turbidity readings."""
        # Get current turbidity
        turbidity = self.sensor.get_reading()
        
        # Check if pump is running
        if self.pump.is_running():
            # If turbidity is below the low threshold, stop dosing
            if turbidity <= self.low_threshold:
                logger.info(f"Auto-stopping PAC pump (turbidity {turbidity:.3f} NTU below low threshold {self.low_threshold:.3f} NTU)")
                self.pump.stop()
            return
        
        # Check if we should start dosing
        if turbidity > self.high_threshold:
            # Check if minimum interval has passed since last dose
            current_time = time.time()
            if current_time - self.last_dose_time >= self.min_dose_interval:
                # Calculate appropriate flow rate based on how far we are from target
                flow_ml_h = self._calculate_flow_rate(turbidity)
                flow_ml_min = flow_ml_h / 60
                
                # Set flow rate
                self.pump.set_flow_rate(flow_ml_min)
                
                # Start the pump
                self.pump.start()
                self.last_dose_time = current_time
                
                logger.info(f"Auto-starting PAC pump at {flow_ml_h:.1f} ml/h "
                           f"(turbidity: {turbidity:.3f} NTU > high threshold: {self.high_threshold:.3f} NTU)")
            else:
                remaining = self.min_dose_interval - (current_time - self.last_dose_time)
                logger.debug(f"Waiting {remaining:.1f}s before next PAC dose")
    
    def _calculate_flow_rate(self, turbidity):
        """Calculate appropriate flow rate based on turbidity deviation from target."""
        # Get flow rate limits
        min_flow = self.pump.min_flow_ml_h
        max_flow = self.pump.max_flow_ml_h
        
        # Calculate how far we are from target (0-1 scale)
        if turbidity <= self.target_ntu:
            # Shouldn't happen in auto mode, but just in case
            deviation = 0
        else:
            # Linear scaling between target and high threshold
            deviation = (turbidity - self.target_ntu) / (self.high_threshold - self.target_ntu)
            deviation = max(0, min(1, deviation))
        
        # Calculate flow rate based on deviation
        flow_ml_h = min_flow + deviation * (max_flow - min_flow)
        
        return flow_ml_h
    
    def manual_dose(self, flow_rate_ml_h, duration_sec=30):
        """Start manual dosing with specified flow rate and duration."""
        if self.mode != DosingMode.MANUAL:
            logger.warning("Manual dosing attempted while not in MANUAL mode")
            return False
        
        # Convert to ml/min for the pump
        flow_rate_ml_min = flow_rate_ml_h / 60
        
        # Set flow rate
        self.pump.set_flow_rate(flow_rate_ml_min)
        
        # Start the pump with duration
        result = self.pump.start(duration=duration_sec)
        
        if result:
            self.last_dose_time = time.time()
            logger.info(f"Manual PAC dose started at {flow_rate_ml_h:.1f} ml/h for {duration_sec} seconds")
        
        return result
    
    def stop_dosing(self):
        """Stop dosing immediately."""
        if not self.pump.is_running():
            logger.warning("Stop dosing called but pump is not running")
            return False
        
        result = self.pump.stop()
        
        if result:
            logger.info("PAC dosing stopped")
        
        return result
    
    def get_status(self):
        """Get the current status of the dosing controller."""
        pump_status = self.pump.get_status()
        turbidity = self.sensor.get_reading()
        
        return {
            "mode": self.mode.name,
            "turbidity": turbidity,
            "high_threshold": self.high_threshold,
            "low_threshold": self.low_threshold,
            "target": self.target_ntu,
            "pump_running": pump_status["running"],
            "flow_rate": pump_status["flow_rate"] * 60,  # Convert to ml/h
            "last_dose_time": self.last_dose_time
        }