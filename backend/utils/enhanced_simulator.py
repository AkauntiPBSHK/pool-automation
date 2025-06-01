# backend/utils/enhanced_simulator.py

import time
import math
import random
import logging
import threading
from datetime import datetime

logger = logging.getLogger('enhanced_simulator')

class EnhancedPoolSimulator:
    """Advanced pool water quality simulator with realistic behavior patterns."""
    
    def __init__(self, config=None):
        self.config = config or {}
        
        # Initial parameters
        self.parameters = {
            'turbidity': 0.15,             # NTU
            'ph': 7.4,                     # pH units
            'orp': 720,                    # mV
            'free_chlorine': 1.2,          # mg/L
            'combined_chlorine': 0.2,      # mg/L
            'temperature': 28.0            # °C
        }
        
        # Pump states
        self.pump_states = {
            'acid': False,     # pH adjustment
            'chlorine': False, # Chlorine dosing
            'pac': False       # PAC dosing
        }
        
        # Configure simulation settings
        self.time_scale = self.config.get('time_scale', 1.0)  # Simulation speed multiplier
        self.update_interval = self.config.get('update_interval', 1.0)  # Seconds between updates
        self.last_update = time.time()
        
        # Parameter constraints
        self.constraints = {
            'turbidity': {'min': 0.05, 'max': 1.0},
            'ph': {'min': 6.5, 'max': 8.5},
            'orp': {'min': 500, 'max': 850},
            'free_chlorine': {'min': 0.1, 'max': 5.0},
            'combined_chlorine': {'min': 0.0, 'max': 1.0},
            'temperature': {'min': 15.0, 'max': 40.0}
        }
        
        # Initialize event system
        self.next_event_time = time.time() + random.uniform(3600, 14400) / self.time_scale
        self.events = []
        
        # Bather load simulation
        self.bather_load = 0  # Current number of swimmers
        self.max_bathers = self.config.get('max_bathers', 30)
        self.bather_schedule = self._generate_bather_schedule()
        
        logger.info("Enhanced pool simulator initialized")

        # Add threading functionality from original
        self.running = True
        self.simulation_thread = threading.Thread(target=self._simulation_loop, daemon=True)
        self.simulation_thread.start()
        
        logger.info("Enhanced pool simulator initialized with background thread")

    def _simulation_loop(self):
        """Main simulation loop that updates parameters automatically."""
        while self.running:
            try:
                self.update()
                time.sleep(0.1)  # Short sleep to prevent CPU overuse
            except Exception as e:
                logger.error(f"Error in simulation loop: {e}")
                time.sleep(1)
    
    def get_parameter(self, name):
        """Get a single parameter value - for compatibility with original API."""
        return self.parameters.get(name)

    def _generate_bather_schedule(self):
        """Generate a typical daily swimming schedule."""
        schedule = {}
        
        # Early morning swimmers (6-8 AM)
        schedule['early_morning'] = {
            'start_hour': 6, 
            'end_hour': 8, 
            'peak_bathers': int(self.max_bathers * 0.2),
            'pattern': 'bell'
        }
        
        # Day swimmers (10 AM - 3 PM)
        schedule['day'] = {
            'start_hour': 10, 
            'end_hour': 15, 
            'peak_bathers': int(self.max_bathers * 0.6),
            'pattern': 'plateau'
        }
        
        # Evening swimmers (5-9 PM)
        schedule['evening'] = {
            'start_hour': 17, 
            'end_hour': 21, 
            'peak_bathers': int(self.max_bathers * 0.8),
            'pattern': 'bell'
        }
        
        return schedule
    
    def update(self):
        """Update the simulation state."""
        now = time.time()
        elapsed = now - self.last_update
        
        # Only update at the configured interval
        if elapsed < self.update_interval:
            return
        
        # Apply time scaling
        effective_elapsed = elapsed * self.time_scale
        
        # Update simulation in the correct order
        with threading.Lock():  # Add thread safety
            self._update_bather_load()
            self._apply_daily_patterns(effective_elapsed)
            self._apply_chemical_interactions(effective_elapsed)
            self._apply_pump_effects(effective_elapsed)
            self._apply_random_drift(effective_elapsed)
            self._check_for_events()
            
            # Always apply constraints at the end
            self._apply_constraints()
        
        self.last_update = now
    
    def _update_bather_load(self):
        """Update the simulated bather load based on time of day."""
        now = datetime.now()
        hour = now.hour
        minute = now.minute
        current_time = hour + minute / 60.0
        
        # Reset bather load
        target_bathers = 0
        
        # Check each swimming session
        for session_name, session in self.bather_schedule.items():
            if current_time >= session['start_hour'] and current_time <= session['end_hour']:
                # We're in this session's timeframe
                session_progress = (current_time - session['start_hour']) / (session['end_hour'] - session['start_hour'])
                
                if session['pattern'] == 'bell':
                    # Bell curve - peak in the middle
                    if session_progress <= 0.5:
                        factor = session_progress * 2  # 0 to 1 in first half
                    else:
                        factor = (1 - session_progress) * 2  # 1 to 0 in second half
                    
                    target_bathers = max(target_bathers, int(session['peak_bathers'] * factor))
                    
                elif session['pattern'] == 'plateau':
                    # Plateau - ramp up, steady, ramp down
                    if session_progress <= 0.2:
                        factor = session_progress / 0.2  # 0 to 1 in first 20%
                    elif session_progress >= 0.8:
                        factor = (1 - session_progress) / 0.2  # 1 to 0 in last 20%
                    else:
                        factor = 1.0  # Full in the middle 60%
                    
                    target_bathers = max(target_bathers, int(session['peak_bathers'] * factor))
        
        # Gradually adjust actual bather load towards target
        if self.bather_load < target_bathers:
            self.bather_load = min(self.bather_load + 1, target_bathers)
        elif self.bather_load > target_bathers:
            self.bather_load = max(self.bather_load - 1, target_bathers)
    
    def _apply_daily_patterns(self, elapsed):
        """Apply time-of-day patterns to parameters."""
        now = datetime.now()
        hour = now.hour
        
        # Calculate day/night factor (sinusoidal pattern)
        # Peak at 2PM (hour 14), lowest at 2AM (hour 2)
        hour_normalized = (hour - 2) / 24
        day_factor = math.sin(hour_normalized * 2 * math.pi)
        
        # pH rises slightly during daytime due to photosynthesis and CO2 consumption
        self.parameters['ph'] += day_factor * 0.02 * elapsed / 3600
        
        # ORP rises during day with increased oxygen/sunlight
        self.parameters['orp'] += day_factor * 5 * elapsed / 3600
        
        # Chlorine decreases faster during day due to UV degradation
        self.parameters['free_chlorine'] -= max(0, day_factor) * 0.01 * elapsed / 3600
        
        # Temperature rises during day, peaks in afternoon
        temp_hour_offset = (hour - 14) / 24  # Peak at 2PM
        temp_factor = math.sin(temp_hour_offset * 2 * math.pi)
        self.parameters['temperature'] += temp_factor * 0.05 * elapsed / 3600
        
        # Bather load affects water quality
        if self.bather_load > 0:
            bather_factor = self.bather_load / self.max_bathers
            
            # Turbidity increases with bather load
            self.parameters['turbidity'] += bather_factor * 0.01 * elapsed / 3600
            
            # pH typically drops with bather load (sweat, etc.)
            self.parameters['ph'] -= bather_factor * 0.03 * elapsed / 3600
            
            # Chlorine consumed by bathers
            self.parameters['free_chlorine'] -= bather_factor * 0.05 * elapsed / 3600
            
            # Combined chlorine increases (chlorine + organic compounds)
            self.parameters['combined_chlorine'] += bather_factor * 0.01 * elapsed / 3600
    
    def _apply_chemical_interactions(self, elapsed):
        """Apply interactions between different water parameters."""
        # pH affects chlorine efficiency - higher pH reduces effectiveness
        ph_chlorine_factor = max(0, (7.5 - self.parameters['ph']) / 1.5)
        
        # If pH is high, free chlorine is less effective (HOCl → OCl⁻ shift)
        if self.parameters['ph'] > 7.5:
            self.parameters['free_chlorine'] -= 0.005 * elapsed / 3600
            
        # ORP is affected by free chlorine and pH
        orp_change = (self.parameters['free_chlorine'] * 100 * ph_chlorine_factor) - 5
        self.parameters['orp'] += orp_change * 0.02 * elapsed / 3600
        
        # Combined chlorine increases slowly unless free chlorine is high
        if self.parameters['free_chlorine'] > 1.5:
            self.parameters['combined_chlorine'] -= 0.002 * elapsed / 3600
        else:
            self.parameters['combined_chlorine'] += 0.001 * elapsed / 3600
            
        # Turbidity tends to settle/clear over time (if no disturbances)
        self.parameters['turbidity'] -= 0.001 * elapsed / 3600
    
    def _apply_pump_effects(self, elapsed):
        """Apply effects of pump operations."""
        # pH pump (acid)
        if self.pump_states['acid']:
            self.parameters['ph'] -= 0.05 * elapsed / 60  # pH drops when acid pump runs
        
        # Chlorine pump
        if self.pump_states['chlorine']:
            self.parameters['free_chlorine'] += 0.1 * elapsed / 60  # Free chlorine increases
            self.parameters['orp'] += 10 * elapsed / 60  # ORP increases
        
        # PAC pump
        if self.pump_states['pac']:
            self.parameters['turbidity'] -= 0.02 * elapsed / 60  # Turbidity drops when dosing PAC
    
    def _apply_random_drift(self, elapsed):
        """Apply small random changes to parameters."""
        # Each parameter drifts slightly
        for param in self.parameters:
            # Scale drift by elapsed time and use smaller drift for more stable parameters
            if param in ['ph', 'turbidity']:
                drift_scale = 0.001  # More stable parameters
            else:
                drift_scale = 0.005  # More variable parameters
                
            drift = random.uniform(-drift_scale, drift_scale) * elapsed / 60
            self.parameters[param] += drift
    
    def _check_for_events(self):
        """Check if it's time for a random event to occur."""
        now = time.time()
        
        if now >= self.next_event_time:
            # Time for a new event
            self._generate_random_event()
            
            # Schedule next event (3-8 hours, adjusted by time scale)
            self.next_event_time = now + random.uniform(10800, 28800) / self.time_scale
    
    def _generate_random_event(self, event_type=None):
        """Generate a random event that affects water quality."""
        if event_type is None:
            event_type = random.choice([
                'turbidity_spike',
                'ph_shift',
                'chlorine_drop',
                'temperature_change',
                'combined_chlorine_increase'
            ])
        
        if event_type == 'turbidity_spike':
            # Simulate a sudden turbidity increase (e.g., dirt, leaves, etc.)
            intensity = random.uniform(0.1, 0.3)
            self.parameters['turbidity'] += intensity
            self.events.append({
                'time': time.time(),
                'type': 'turbidity_spike',
                'description': f'Sudden turbidity increase (+{intensity:.2f} NTU)',
                'intensity': intensity
            })
            logger.info(f"Event: Turbidity spike +{intensity:.2f} NTU")
            
        elif event_type == 'ph_shift':
            # Simulate a pH shift (e.g., rainfall, new water addition)
            direction = random.choice(['up', 'down'])
            intensity = random.uniform(0.2, 0.5)
            
            if direction == 'up':
                self.parameters['ph'] += intensity
                description = f'pH shift upward (+{intensity:.1f})'
            else:
                self.parameters['ph'] -= intensity
                description = f'pH shift downward (-{intensity:.1f})'
                
            self.events.append({
                'time': time.time(),
                'type': 'ph_shift',
                'description': description,
                'intensity': intensity,
                'direction': direction
            })
            logger.info(f"Event: {description}")
            
        elif event_type == 'chlorine_drop':
            # Simulate sudden chlorine consumption
            intensity = random.uniform(0.3, 0.7)
            current_cl = self.parameters['free_chlorine']
            
            # Don't reduce below minimum
            reduction = min(current_cl - 0.2, intensity)
            self.parameters['free_chlorine'] -= reduction
            
            self.events.append({
                'time': time.time(),
                'type': 'chlorine_drop',
                'description': f'Rapid chlorine consumption (-{reduction:.1f} mg/L)',
                'intensity': reduction
            })
            logger.info(f"Event: Chlorine drop -{reduction:.1f} mg/L")
            
        elif event_type == 'temperature_change':
            # Simulate temperature change (e.g., weather, heater)
            direction = random.choice(['up', 'down'])
            intensity = random.uniform(1.0, 3.0)
            
            if direction == 'up':
                self.parameters['temperature'] += intensity
                description = f'Temperature increase (+{intensity:.1f}°C)'
            else:
                self.parameters['temperature'] -= intensity
                description = f'Temperature decrease (-{intensity:.1f}°C)'
                
            self.events.append({
                'time': time.time(),
                'type': 'temperature_change',
                'description': description,
                'intensity': intensity,
                'direction': direction
            })
            logger.info(f"Event: {description}")
            
        elif event_type == 'combined_chlorine_increase':
            # Simulate combined chlorine increase (e.g., organic contamination)
            intensity = random.uniform(0.1, 0.3)
            self.parameters['combined_chlorine'] += intensity
            
            self.events.append({
                'time': time.time(),
                'type': 'combined_chlorine_increase',
                'description': f'Combined chlorine increase (+{intensity:.1f} mg/L)',
                'intensity': intensity
            })
            logger.info(f"Event: Combined chlorine increase +{intensity:.1f} mg/L")
    
    def _apply_constraints(self):
        """Ensure parameters stay within realistic bounds."""
        for param, limits in self.constraints.items():
            if param in self.parameters:
                self.parameters[param] = max(limits['min'], min(limits['max'], self.parameters[param]))
    
    def get_all_parameters(self):
        """Get all current parameter values."""
        return self.parameters.copy()
    
    def get_pump_states(self):
        """Get all pump states."""
        return self.pump_states.copy()
    
    def set_pump_state(self, pump_name, state, flow_rate=None):
        """Set the state of a pump, with optional flow rate for PAC pump."""
        if pump_name in self.pump_states:
            self.pump_states[pump_name] = bool(state)
            
            # Store flow rate for PAC pump (like in original)
            if pump_name == 'pac' and flow_rate is not None:
                self.pac_flow_rate = float(flow_rate)
                
            return True
        return False
    
    def stop(self):
        """Stop the simulation thread."""
        self.running = False
        if self.simulation_thread.is_alive():
            self.simulation_thread.join(timeout=1.0)
        logger.info("Enhanced simulator stopped")
    
    def get_recent_events(self, count=10):
        """Get recent simulated events."""
        return sorted(self.events, key=lambda e: e['time'], reverse=True)[:count]
    
    def set_parameter(self, name, value):
        """Set a parameter value directly (for testing or external control)."""
        if name in self.parameters:
            self.parameters[name] = value
            logger.info(f"Parameter {name} manually set to {value}")
            return True
        return False

    def set_time_scale(self, scale):
        """Set the simulation time scale."""
        if scale > 0:
            self.time_scale = float(scale)
            logger.info(f"Simulation time scale set to {scale}x")
            return True
        return False

    def get_bather_load(self):
        """Get the current bather load."""
        return self.bather_load

    def reset_events(self):
        """Clear all recorded events."""
        self.events = []
        return True

    def trigger_event(self, event_type=None):
        """Manually trigger a random event or a specific event type."""
        if event_type:
            # Try to trigger a specific event if supported
            event_methods = {
                'turbidity_spike': lambda: self._generate_random_event('turbidity_spike'),
                'ph_shift': lambda: self._generate_random_event('ph_shift'),
                'chlorine_drop': lambda: self._generate_random_event('chlorine_drop'),
                'temperature_change': lambda: self._generate_random_event('temperature_change'),
                'combined_chlorine_increase': lambda: self._generate_random_event('combined_chlorine_increase')
            }
            if event_type in event_methods:
                event_methods[event_type]()
                return True
            else:
                logger.warning(f"Unsupported event type: {event_type}")
                return False
        else:
            # Trigger a random event
            self._generate_random_event()
            return True