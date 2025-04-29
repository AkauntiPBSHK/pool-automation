"""
Comprehensive simulation framework for testing the pool automation system without hardware.
"""

import time
import random
import math
import logging
import threading
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class SystemSimulator:
    """Simulates an entire pool system including turbidity, pH, ORP, and chlorine parameters."""
    
    def __init__(self, config=None):
        """Initialize the system simulator.
        
        Args:
            config (dict, optional): Configuration dictionary for simulation parameters.
        """
        self.config = config or {}
        
        # Initial parameter values
        self.parameters = {
            'turbidity': 0.15,      # NTU
            'ph': 7.4,              # pH units
            'orp': 720,             # mV
            'free_chlorine': 1.2,   # mg/L
            'combined_chlorine': 0.2, # mg/L
            'temperature': 28.0     # °C
        }
        
        # Pump states
        self.pumps = {
            'pac': False,           # PAC dosing pump
            'acid': False,          # pH (acid) dosing pump  
            'chlorine': False,      # Chlorine dosing pump
        }
        
        # PAC dosing parameters
        self.pac_flow_rate = 75     # ml/h
        
        # Simulation parameters
        self.time_scale = self.config.get('time_scale', 1.0)  # 1.0 = real-time, >1 = faster
        self.noise_level = self.config.get('noise_level', 1.0)  # 1.0 = normal noise
        
        # For time-based patterns
        self.start_time = time.time()
        
        # Parameter dependencies (how parameters affect each other)
        self.dependencies = {
            'chlorine_to_orp': 25,   # 1 mg/L Cl₂ change affects ORP by ~25mV
            'ph_to_orp': -30,        # 1 pH unit increase decreases ORP by ~30mV
        }
        
        # Automatic drift and reaction modeling
        self.drift_rates = {
            'turbidity': 0.001,      # NTU per hour increase (natural dirt accumulation)
            'ph': 0.02,              # pH units per hour increase (natural rise)
            'free_chlorine': -0.05,  # mg/L per hour decrease (consumption)
            'combined_chlorine': 0.01, # mg/L per hour increase (accumulation)
            'temperature': 0.0       # °C per hour (stable by default)
        }
        
        # Chemical reactions
        self.reactions = {
            'pac_dose': self._react_pac_dose,
            'acid_dose': self._react_acid_dose,
            'chlorine_dose': self._react_chlorine_dose
        }
        
        # Start simulation thread
        self.running = True
        self.simulation_thread = threading.Thread(target=self._simulation_loop, daemon=True)
        self.simulation_thread.start()
        
        logger.info("System simulator initialized")
    
    # Add to SystemSimulator class in simulator.py
    def apply_daily_patterns(self):
        """Apply time-of-day patterns to parameters."""
        # Get current hour (0-23)
        current_hour = datetime.datetime.now().hour
        
        # Calculate day/night factor (sinusoidal pattern)
        # Peak at 2PM (hour 14), lowest at 2AM (hour 2)
        hour_normalized = (current_hour - 2) / 24
        day_factor = math.sin(hour_normalized * 2 * math.pi)
        
        # pH rises slightly during daytime due to photosynthesis and CO2 consumption
        self.parameters['ph'] += day_factor * 0.02 * self.time_scale
        
        # ORP rises during day with increased oxygen/sunlight
        self.parameters['orp'] += day_factor * 5 * self.time_scale
        
        # Chlorine decreases faster during day due to UV degradation
        self.parameters['free_chlorine'] -= max(0, day_factor) * 0.01 * self.time_scale
        
        # Temperature rises during day, peaks in afternoon
        temp_hour_offset = (current_hour - 14) / 24  # Peak at 2PM
        temp_factor = math.sin(temp_hour_offset * 2 * math.pi)
        self.parameters['temperature'] += temp_factor * 0.05 * self.time_scale
        
        # Apply constraints after changes
        self._apply_constraints()

    # Add to SystemSimulator class
    def apply_chemical_interactions(self):
        """Apply interactions between different water parameters."""
        # pH affects chlorine efficiency - higher pH reduces effectiveness
        ph_chlorine_factor = max(0, (7.5 - self.parameters['ph']) / 1.5)
        
        # If pH is high, free chlorine is less effective (HOCl → OCl⁻ shift)
        if self.parameters['ph'] > 7.5:
            self.parameters['free_chlorine'] -= 0.005 * self.time_scale
            
        # ORP is affected by free chlorine and pH
        orp_change = (self.parameters['free_chlorine'] * 100 * ph_chlorine_factor) - 5
        self.parameters['orp'] += orp_change * 0.02 * self.time_scale
        
        # Combined chlorine increases slowly unless free chlorine is high
        if self.parameters['free_chlorine'] > 1.5:
            self.parameters['combined_chlorine'] -= 0.002 * self.time_scale
        else:
            self.parameters['combined_chlorine'] += 0.001 * self.time_scale
    
    def _simulation_loop(self):
        """Main simulation loop that updates parameters based on time and actions."""
        last_update = time.time()
        
        while self.running:
            try:
                # Calculate elapsed time since last update
                current_time = time.time()
                elapsed_hours = (current_time - last_update) * self.time_scale / 3600
                last_update = current_time
                
                # Apply natural drift to parameters
                self._apply_drift(elapsed_hours)
                
                # Apply daily patterns
                self._apply_daily_patterns()
                
                # Apply random noise
                self._apply_noise()
                
                # Process active dosing
                self._process_dosing(elapsed_hours)
                
                # Update interdependent parameters
                self._update_dependencies()
                
                # Apply physical constraints
                self._apply_constraints()
                
                # Sleep to control simulation speed
                time.sleep(1 / self.time_scale)
                
            except Exception as e:
                logger.error(f"Error in simulation loop: {e}")
                time.sleep(1)
    
    def _apply_drift(self, elapsed_hours):
        """Apply natural drift to parameters over time."""
        for param, rate in self.drift_rates.items():
            self.parameters[param] += rate * elapsed_hours
    
    def _apply_daily_patterns(self):
        """Apply time-of-day patterns to simulate daily cycles."""
        # Calculate time of day influence (0.0 to 1.0)
        seconds_in_day = 24 * 3600
        time_of_day = (time.time() % seconds_in_day) / seconds_in_day
        
        # Temperature varies with time of day (warmer in afternoon)
        day_factor = math.sin((time_of_day - 0.25) * 2 * math.pi)
        self.parameters['temperature'] += day_factor * 0.01
        
        # Turbidity increases slightly during typical swimming hours
        if 0.4 < time_of_day < 0.7:  # ~10am to 5pm
            self.parameters['turbidity'] += 0.0001
        
        # pH rises slightly during daylight (photosynthesis in outdoor pools)
        if 0.25 < time_of_day < 0.75:  # 6am to 6pm
            self.parameters['ph'] += 0.0001
    
    def _apply_noise(self):
        """Apply random noise to parameters to simulate measurement variations."""
        noise_factors = {
            'turbidity': 0.002,
            'ph': 0.01,
            'orp': 2.0,
            'free_chlorine': 0.01,
            'combined_chlorine': 0.005,
            'temperature': 0.05
        }
        
        for param, factor in noise_factors.items():
            self.parameters[param] += random.uniform(-factor, factor) * self.noise_level
    
    def _process_dosing(self, elapsed_hours):
        """Process the effects of any active dosing pumps."""
        # PAC dosing reduces turbidity
        if self.pumps['pac']:
            # Calculate effect based on flow rate and elapsed time
            effect = (self.pac_flow_rate / 100) * elapsed_hours * 0.05
            self.parameters['turbidity'] -= effect
            logger.debug(f"PAC dosing: -{effect:.4f} NTU")
        
        # Acid dosing reduces pH
        if self.pumps['acid']:
            self.parameters['ph'] -= 0.05 * elapsed_hours
            logger.debug(f"Acid dosing: -0.05 pH")
        
        # Chlorine dosing increases free chlorine and ORP
        if self.pumps['chlorine']:
            self.parameters['free_chlorine'] += 0.1 * elapsed_hours
            logger.debug(f"Chlorine dosing: +0.1 mg/L")
    
    def _update_dependencies(self):
        """Update interdependent parameters."""
        # ORP depends on free chlorine and pH
        baseline_orp = 650
        chlorine_effect = self.parameters['free_chlorine'] * self.dependencies['chlorine_to_orp']
        ph_effect = (self.parameters['ph'] - 7.0) * self.dependencies['ph_to_orp']
        
        self.parameters['orp'] = baseline_orp + chlorine_effect + ph_effect
    
    def _apply_constraints(self):
        """Apply physical constraints to parameters."""
        constraints = {
            'turbidity': (0.05, 0.5),
            'ph': (6.5, 8.0),
            'orp': (500, 900),
            'free_chlorine': (0.1, 3.0),
            'combined_chlorine': (0.0, 0.5),
            'temperature': (20.0, 32.0)
        }
        
        for param, (min_val, max_val) in constraints.items():
            self.parameters[param] = max(min_val, min(max_val, self.parameters[param]))
    
    # Reaction functions for chemical dosing
    def _react_pac_dose(self, dose_amount):
        """Simulate the effect of PAC dosing."""
        # More PAC means lower turbidity, with diminishing returns
        effect = math.sqrt(dose_amount) * 0.01
        self.parameters['turbidity'] -= effect
        logger.debug(f"PAC dose reaction: -{effect:.4f} NTU")
    
    def _react_acid_dose(self, dose_amount):
        """Simulate the effect of acid dosing."""
        self.parameters['ph'] -= dose_amount * 0.01
        logger.debug(f"Acid dose reaction: -{dose_amount * 0.01:.2f} pH")
    
    def _react_chlorine_dose(self, dose_amount):
        """Simulate the effect of chlorine dosing."""
        self.parameters['free_chlorine'] += dose_amount * 0.01
        # Some becomes combined chlorine
        self.parameters['combined_chlorine'] += dose_amount * 0.002
        logger.debug(f"Chlorine dose reaction: +{dose_amount * 0.01:.2f} mg/L free, "
                    f"+{dose_amount * 0.002:.3f} mg/L combined")
    
    # Public API for controlling the simulation
    def get_parameter(self, name):
        """Get the current value of a parameter."""
        return self.parameters.get(name)
    
    def get_all_parameters(self):
        """Get all current parameter values."""
        return self.parameters.copy()
    
    def set_pump_state(self, pump_name, state, flow_rate=None):
        """Set the state of a pump."""
        if pump_name not in self.pumps:
            logger.warning(f"Unknown pump: {pump_name}")
            return False
        
        self.pumps[pump_name] = bool(state)
        
        if pump_name == 'pac' and flow_rate is not None:
            self.pac_flow_rate = float(flow_rate)
        
        logger.debug(f"Pump {pump_name} {'started' if state else 'stopped'}"
                    f"{f' at {flow_rate} ml/h' if flow_rate and pump_name == 'pac' else ''}")
        
        return True
    
    def get_pump_states(self):
        """Get the current states of all pumps."""
        return self.pumps.copy()
    
    def stop(self):
        """Stop the simulation."""
        self.running = False
        if self.simulation_thread.is_alive():
            self.simulation_thread.join(timeout=1.0)
        logger.info("System simulator stopped")