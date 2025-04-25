# backend/controllers/advanced_dosing.py
import time
import logging
import enum
import threading
from datetime import datetime

logger = logging.getLogger('advanced_dosing')

class DosingMode(enum.Enum):
    """Dosing controller operating modes."""
    OFF = 0
    MANUAL = 1
    AUTOMATIC = 2

class PIDSettings:
    """PID controller settings."""
    def __init__(self, kp=1.0, ki=0.1, kd=0.0):
        self.kp = kp  # Proportional gain
        self.ki = ki  # Integral gain
        self.kd = kd  # Derivative gain
        self.last_error = 0.0
        self.integral = 0.0
        self.last_time = time.time()

class AdvancedDosingController:
    """Proportional-Integral-Derivative controller for PAC dosing."""
    
    def __init__(self, sensor, pump, config, event_logger=None):
        """Initialize the dosing controller."""
        self.sensor = sensor
        self.pump = pump
        self.config = config
        self.event_logger = event_logger
        
        # Operating state
        self.mode = DosingMode.OFF
        self.running = False
        self.pause = False
        self.last_dose_time = 0
        self.dose_counter = 0
        
        # Control parameters
        self.high_threshold = config.get('high_threshold_ntu', 0.25)
        self.low_threshold = config.get('low_threshold_ntu', 0.12)
        self.target_ntu = config.get('target_ntu', 0.15)
        self.min_dose_interval = config.get('min_dose_interval_sec', 300)  # 5 minutes
        self.dose_duration = config.get('dose_duration_sec', 30)  # 30 seconds
        self.moving_avg_samples = config.get('moving_avg_samples', 10)
        
        # Flow rate limits
        self.min_flow = config.get('pac_min_flow', 60)  # ml/h
        self.max_flow = config.get('pac_max_flow', 150)  # ml/h
        
        # PID control
        self.pid = PIDSettings(
            kp=config.get('pid_kp', 1.0),
            ki=config.get('pid_ki', 0.1),
            kd=config.get('pid_kd', 0.05)
        )
        
        # Schedule and history
        self.schedule = []
        self.dose_history = []
        
        # Control thread
        self.control_thread = None
        self.stop_event = threading.Event()
        
        logger.info("Advanced dosing controller initialized")
    
    def start(self, mode=DosingMode.AUTOMATIC):
        """Start the dosing controller."""
        if self.running:
            logger.warning("Controller already running")
            return False
        
        self.mode = mode
        self.running = True
        self.stop_event.clear()
        
        # Start the control thread
        self.control_thread = threading.Thread(target=self._control_loop)
        self.control_thread.daemon = True
        self.control_thread.start()
        
        logger.info(f"Dosing controller started in {mode.name} mode")
        
        if self.event_logger:
            self.event_logger('system', f'Dosing controller started in {mode.name} mode')
        
        return True
    
    def stop(self):
        """Stop the dosing controller."""
        if not self.running:
            logger.warning("Controller already stopped")
            return False
        
        logger.info("Stopping dosing controller")
        self.stop_event.set()
        
        # Wait for thread to finish
        if self.control_thread and self.control_thread.is_alive():
            self.control_thread.join(timeout=1)
        
        self.running = False
        
        # Make sure pump is stopped
        self.pump.stop()
        
        if self.event_logger:
            self.event_logger('system', 'Dosing controller stopped')
        
        return True
    
    def set_mode(self, mode):
        """Set the operating mode."""
        if not isinstance(mode, DosingMode):
            try:
                mode = DosingMode[mode]
            except (KeyError, ValueError):
                logger.error(f"Invalid mode: {mode}")
                return False
        
        logger.info(f"Setting dosing mode to {mode.name}")
        self.mode = mode
        
        if self.event_logger:
            self.event_logger('system', f'Dosing mode changed to {mode.name}')
        
        return True
    
    def manual_dose(self, duration=None, flow_rate=None):
        """Trigger a manual dose."""
        if self.mode != DosingMode.MANUAL:
            logger.warning("Cannot dose manually when not in MANUAL mode")
            return False
        
        duration = duration or self.dose_duration
        
        if flow_rate is not None:
            self.pump.set_flow_rate(flow_rate)
        
        # Get current turbidity for logging
        current_turbidity = self.sensor.get_reading()
        
        # Start the pump
        success = self.pump.start(duration=duration)
        
        if success:
            self.last_dose_time = time.time()
            self.dose_counter += 1
            
            logger.info(f"Manual dose #{self.dose_counter} started for {duration}s at {self.pump.get_flow_rate()} ml/h")
            
            # Log the dosing event
            if self.event_logger:
                self.event_logger(
                    'dosing', 
                    'manual', 
                    duration=duration, 
                    flow_rate=self.pump.get_flow_rate(), 
                    turbidity=current_turbidity
                )
            
            # Add to dose history
            self.dose_history.append({
                'timestamp': time.time(),
                'type': 'manual',
                'duration': duration,
                'flow_rate': self.pump.get_flow_rate(),
                'turbidity': current_turbidity
            })
        
        return success
    
    def schedule_dose(self, timestamp, duration=None, flow_rate=None):
        """Schedule a dose for a specific time."""
        try:
            # Parse timestamp if it's a string
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp).timestamp()
            
            duration = duration or self.dose_duration
            flow_rate = flow_rate or self.pump.get_flow_rate()
            
            # Add to schedule
            self.schedule.append({
                'timestamp': timestamp,
                'duration': duration,
                'flow_rate': flow_rate,
                'executed': False
            })
            
            logger.info(f"Dose scheduled for {datetime.fromtimestamp(timestamp).isoformat()}")
            
            # Sort schedule by timestamp
            self.schedule.sort(key=lambda x: x['timestamp'])
            
            return True
        except Exception as e:
            logger.error(f"Error scheduling dose: {e}")
            return False
    
    def get_scheduled_doses(self):
        """Get list of scheduled doses."""
        # Remove executed doses older than 24 hours
        cutoff = time.time() - 86400
        self.schedule = [dose for dose in self.schedule if dose['timestamp'] > cutoff or not dose['executed']]
        
        return self.schedule
    
    def get_dose_history(self, limit=10):
        """Get recent dosing history."""
        return sorted(self.dose_history, key=lambda x: x['timestamp'], reverse=True)[:limit]
    
    def _should_dose(self):
        """Determine if dosing is needed based on sensor readings."""
        current_turbidity = self.sensor.get_reading()
        
        # In automatic mode, dose when turbidity is above threshold
        if self.mode == DosingMode.AUTOMATIC:
            # Check if it's too soon since last dose
            if time.time() - self.last_dose_time < self.min_dose_interval:
                return False
            
            # Check if turbidity is high enough to justify dosing
            if current_turbidity > self.high_threshold:
                logger.info(f"Turbidity above threshold: {current_turbidity:.3f} > {self.high_threshold:.3f}")
                return True
        
        return False
    
    def _calculate_flow_rate(self):
        """Calculate optimal flow rate using PID control."""
        current_time = time.time()
        current_turbidity = self.sensor.get_reading()
        
        # Error is the difference from target (positive when turbidity is too high)
        error = current_turbidity - self.target_ntu
        
        # Time since last calculation
        dt = current_time - self.pid.last_time
        
        if dt > 0:
            # Calculate PID terms
            p_term = self.pid.kp * error
            
            # Update integral term with anti-windup
            self.pid.integral += error * dt
            # Clamp integral to prevent excessive buildup
            self.pid.integral = max(-5.0, min(5.0, self.pid.integral))
            i_term = self.pid.ki * self.pid.integral
            
            # Calculate derivative term
            d_term = 0
            if dt > 0:
                d_term = self.pid.kd * (error - self.pid.last_error) / dt
            
            # Combine terms
            output = p_term + i_term + d_term
            
            # Update last values
            self.pid.last_error = error
            self.pid.last_time = current_time
            
            # Scale output to flow rate range and clamp
            # Map the output range (-1 to 1) to flow rate range
            base_flow = (self.min_flow + self.max_flow) / 2
            flow_range = (self.max_flow - self.min_flow) / 2
            
            flow_rate = base_flow + output * flow_range
            flow_rate = max(self.min_flow, min(self.max_flow, flow_rate))
            
            return int(flow_rate)
        
        # Default if dt is zero
        return self.min_flow
    
    def _auto_dose(self):
        """Perform automatic dosing."""
        # Calculate the optimal flow rate
        flow_rate = self._calculate_flow_rate()
        
        # Set pump flow rate
        self.pump.set_flow_rate(flow_rate)
        
        # Get current turbidity for logging
        current_turbidity = self.sensor.get_reading()
        
        # Start the pump
        success = self.pump.start(duration=self.dose_duration)
        
        if success:
            self.last_dose_time = time.time()
            self.dose_counter += 1
            
            logger.info(f"Auto dose #{self.dose_counter} started, "
                       f"turbidity: {current_turbidity:.3f} NTU, flow rate: {flow_rate} ml/h")
            
            # Log the dosing event
            if self.event_logger:
                self.event_logger(
                    'dosing', 
                    'auto', 
                    duration=self.dose_duration, 
                    flow_rate=flow_rate, 
                    turbidity=current_turbidity
                )
            
            # Add to dose history
            self.dose_history.append({
                'timestamp': time.time(),
                'type': 'auto',
                'duration': self.dose_duration,
                'flow_rate': flow_rate,
                'turbidity': current_turbidity
            })
            
            # Keep history limited to avoid memory issues
            if len(self.dose_history) > 1000:
                self.dose_history = self.dose_history[-1000:]
    
    def _check_scheduled_doses(self):
        """Check and execute scheduled doses."""
        now = time.time()
        
        for dose in self.schedule:
            if not dose['executed'] and dose['timestamp'] <= now:
                logger.info(f"Executing scheduled dose")
                
                # Set flow rate if specified
                if 'flow_rate' in dose:
                    self.pump.set_flow_rate(dose['flow_rate'])
                
                # Start the pump
                self.pump.start(duration=dose['duration'])
                
                # Mark as executed
                dose['executed'] = True
                dose['actual_time'] = now
                
                # Update last dose time
                self.last_dose_time = now
                self.dose_counter += 1
                
                # Get current turbidity for logging
                current_turbidity = self.sensor.get_reading()
                
                # Log the dosing event
                if self.event_logger:
                    self.event_logger(
                        'dosing', 
                        'scheduled', 
                        duration=dose['duration'], 
                        flow_rate=self.pump.get_flow_rate(), 
                        turbidity=current_turbidity
                    )
                
                # Add to dose history
                self.dose_history.append({
                    'timestamp': now,
                    'type': 'scheduled',
                    'duration': dose['duration'],
                    'flow_rate': self.pump.get_flow_rate(),
                    'turbidity': current_turbidity
                })
    
    def _control_loop(self):
        """Main control loop."""
        logger.info("Control loop started")
        
        while not self.stop_event.is_set():
            try:
                # Skip if paused
                if not self.pause:
                    # Check for scheduled doses
                    self._check_scheduled_doses()
                    
                    # Auto-dosing in automatic mode
                    if self.mode == DosingMode.AUTOMATIC and self._should_dose():
                        self._auto_dose()
                
                # Wait a bit before next check
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"Error in control loop: {e}")
                time.sleep(5)  # Delay longer on error
        
        logger.info("Control loop stopped")
    
    def get_status(self):
        """Get the current controller status."""
        return {
            'mode': self.mode.name,
            'running': self.running,
            'pause': self.pause,
            'last_dose_time': self.last_dose_time,
            'dose_counter': self.dose_counter,
            'current_turbidity': self.sensor.get_reading(),
            'moving_average': self.sensor.get_moving_average(),
            'high_threshold': self.high_threshold,
            'low_threshold': self.low_threshold,
            'target': self.target_ntu,
            'pump_status': self.pump.is_running(),
            'pump_flow_rate': self.pump.get_flow_rate(),
            'time': time.time()
        }