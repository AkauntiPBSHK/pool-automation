# hardware/simulation.py
import logging
import random
import time
import threading
from datetime import datetime, timedelta
import json
import os

logger = logging.getLogger(__name__)

class SimulationEnvironment:
    """
    Simulation environment that creates realistic hardware behavior.
    The simulation can inject faults, create correlations between parameters,
    and simulate real-world conditions.
    """
    
    def __init__(self, config_file=None):
        """Initialize the simulation environment."""
        self.config_file = config_file or 'config/simulation_config.json'
        self.parameters = {
            'ph': 7.4,
            'orp': 720,
            'free_cl': 1.2,
            'comb_cl': 0.2,
            'turbidity': 0.15,
            'temperature': 28.2,
            'uv_intensity': 94,
            'acid_pump_active': False,
            'chlorine_pump_active': False,
            'pac_pump_active': False
        }
        
        # Correlation factors (how parameters affect each other)
        self.correlations = {
            'ph_to_orp': -0.3,  # pH increase causes ORP decrease
            'chlorine_to_orp': 0.7,  # Chlorine increase causes ORP increase
            'pac_to_turbidity': -0.8,  # PAC dosing decreases turbidity
            'chlorine_to_combined': 0.2  # Chlorine dosing can increase combined chlorine
        }
        
        # Simulation behaviors
        self.behaviors = {
            'diurnal_variation': True,  # Daily cycles in parameters
            'random_events': True,      # Random events like swimmer load
            'fault_injection': False,   # Simulate faults in the system
            'sensor_noise': True        # Add realistic sensor noise
        }
        
        # Historical data storage
        self.history = {param: [] for param in self.parameters}
        self.max_history_points = 1000
        
        # Dosing event history
        self.dosing_events = []
        
        # Simulation thread
        self.running = False
        self.simulation_thread = None
        self.update_interval = 1.0  # seconds
        self.time_acceleration = 1.0  # 1.0 = real-time
        
        # Load configuration if available
        self._load_config()
    
    def _load_config(self):
        """Load simulation configuration from file."""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                
                # Update parameters
                if 'parameters' in config:
                    self.parameters.update(config['parameters'])
                
                # Update correlations
                if 'correlations' in config:
                    self.correlations.update(config['correlations'])
                
                # Update behaviors
                if 'behaviors' in config:
                    self.behaviors.update(config['behaviors'])
                
                # Update other settings
                if 'update_interval' in config:
                    self.update_interval = config['update_interval']
                
                if 'time_acceleration' in config:
                    self.time_acceleration = config['time_acceleration']
                
                logger.info(f"Loaded simulation configuration from {self.config_file}")
        except Exception as e:
            logger.error(f"Error loading simulation configuration: {e}")
    
    def save_config(self):
        """Save simulation configuration to file."""
        try:
            config = {
                'parameters': self.parameters,
                'correlations': self.correlations,
                'behaviors': self.behaviors,
                'update_interval': self.update_interval,
                'time_acceleration': self.time_acceleration
            }
            
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=4)
            
            logger.info(f"Saved simulation configuration to {self.config_file}")
            return True
        except Exception as e:
            logger.error(f"Error saving simulation configuration: {e}")
            return False
    
    def start(self):
        """Start the simulation thread."""
        if self.running:
            logger.warning("Simulation already running")
            return False
        
        self.running = True
        self.simulation_thread = threading.Thread(target=self._simulation_loop, daemon=True)
        self.simulation_thread.start()
        
        logger.info("Simulation environment started")
        return True
    
    def stop(self):
        """Stop the simulation thread."""
        if not self.running:
            logger.warning("Simulation not running")
            return False
        
        self.running = False
        
        if self.simulation_thread and self.simulation_thread.is_alive():
            self.simulation_thread.join(timeout=2.0)
        
        logger.info("Simulation environment stopped")
        return True
    
    def _simulation_loop(self):
        """Main simulation loop."""
        logger.info("Simulation loop started")
        
        last_timestamp = time.time()
        
        while self.running:
            current_time = time.time()
            dt = (current_time - last_timestamp) * self.time_acceleration
            
            # Update all parameters
            self._update_parameters(dt)
            
            # Store history
            self._store_history()
            
            # Apply correlations
            self._apply_correlations()
            
            # Apply behaviors
            if self.behaviors['diurnal_variation']:
                self._apply_diurnal_variation()
            
            if self.behaviors['random_events'] and random.random() < 0.01:
                self._generate_random_event()
            
            if self.behaviors['fault_injection'] and random.random() < 0.001:
                self._inject_fault()
            
            # Sleep until next update
            time.sleep(self.update_interval)
            last_timestamp = current_time
    
    def _update_parameters(self, dt):
        """Update parameters with some random drift and sensor noise."""
        for param, value in self.parameters.items():
            # Skip pump state parameters
            if param.endswith('_active'):
                continue
            
            # Random drift (slower for some parameters)
            drift_rate = {
                'ph': 0.01,
                'orp': 2.0,
                'free_cl': 0.02,
                'comb_cl': 0.01,
                'turbidity': 0.005,
                'temperature': 0.02,
                'uv_intensity': 0.1
            }.get(param, 0.01)
            
            drift = (random.random() - 0.5) * drift_rate * dt
            
            # Add sensor noise if enabled
            noise = 0
            if self.behaviors['sensor_noise']:
                noise_level = {
                    'ph': 0.02,
                    'orp': 5.0,
                    'free_cl': 0.05,
                    'comb_cl': 0.02,
                    'turbidity': 0.01,
                    'temperature': 0.1,
                    'uv_intensity': 1.0
                }.get(param, 0.01)
                
                noise = (random.random() - 0.5) * noise_level
            
            # Update parameter with drift and noise
            new_value = self.parameters[param] + drift + noise
            
            # Enforce limits
            limits = {
                'ph': (6.8, 8.0),
                'orp': (600, 800),
                'free_cl': (0.5, 3.0),
                'comb_cl': (0.0, 0.5),
                'turbidity': (0.05, 0.5),
                'temperature': (20, 32),
                'uv_intensity': (50, 100)
            }.get(param, (0, 100))
            
            self.parameters[param] = max(limits[0], min(limits[1], new_value))
    
    def _apply_correlations(self):
        """Apply correlations between parameters."""
        # Handle pH and ORP correlation
        if 'ph_to_orp' in self.correlations and 'ph' in self.parameters and 'orp' in self.parameters:
            ph_change = self.parameters['ph'] - 7.4  # Deviation from ideal pH
            orp_effect = ph_change * self.correlations['ph_to_orp'] * 50  # Scale factor
            self.parameters['orp'] -= orp_effect
        
        # Handle chlorine and ORP correlation
        if 'chlorine_to_orp' in self.correlations and 'free_cl' in self.parameters and 'orp' in self.parameters:
            cl_factor = (self.parameters['free_cl'] - 1.0) * self.correlations['chlorine_to_orp'] * 100
            self.parameters['orp'] += cl_factor
        
        # PAC dosing effect on turbidity
        if self.parameters.get('pac_pump_active', False) and 'pac_to_turbidity' in self.correlations:
            # Stronger effect the higher the turbidity
            effect_strength = (self.parameters['turbidity'] - 0.12) * 0.05
            effect_strength = max(0.001, effect_strength)  # Ensure some minimum effect
            
            turbidity_reduction = effect_strength * self.correlations['pac_to_turbidity']
            self.parameters['turbidity'] += turbidity_reduction
            
            # Add some minimum for realistic behavior
            self.parameters['turbidity'] = max(0.1, self.parameters['turbidity'])
        
        # Chlorine dosing effect on combined chlorine
        if self.parameters.get('chlorine_pump_active', False) and 'chlorine_to_combined' in self.correlations:
            combined_cl_increase = 0.02 * self.correlations['chlorine_to_combined'] 
            self.parameters['comb_cl'] += combined_cl_increase
            self.parameters['comb_cl'] = min(0.5, self.parameters['comb_cl'])
            
            # Also increase free chlorine when dosing
            self.parameters['free_cl'] += 0.05
            self.parameters['free_cl'] = min(3.0, self.parameters['free_cl'])
        
        # pH dosing (acid) effect
        if self.parameters.get('acid_pump_active', False):
            # Acid decreases pH
            self.parameters['ph'] -= 0.03
            self.parameters['ph'] = max(6.8, self.parameters['ph'])
    
    def _apply_diurnal_variation(self):
        """Apply diurnal (daily) variations to parameters."""
        # Get time of day (0.0 to 1.0 representing 24 hours)
        now = datetime.now()
        time_of_day = (now.hour + now.minute / 60) / 24.0
        
        # Temperature variation (warmest in afternoon)
        temp_variation = math.sin((time_of_day - 0.5) * 2 * math.pi) * 1.5
        self.parameters['temperature'] = 28.0 + temp_variation
        
        # UV intensity fades slightly at night
        if self.parameters.get('uv_intensity', 0) > 50:
            time_factor = 0.85 + 0.15 * math.sin((time_of_day - 0.25) * 2 * math.pi)
            self.parameters['uv_intensity'] = 94 * time_factor
    
    def _generate_random_event(self):
        """Generate a random event that affects water parameters."""
        events = [
            {
                'name': 'Swimmer load',
                'effects': {
                    'turbidity': 0.05,
                    'free_cl': -0.2,
                    'comb_cl': 0.1,
                    'ph': 0.1
                },
                'message': 'Increased swimmer load detected'
            },
            {
                'name': 'Leaves in pool',
                'effects': {
                    'turbidity': 0.1,
                    'free_cl': -0.1
                },
                'message': 'Debris detected in pool'
            },
            {
                'name': 'Rainwater',
                'effects': {
                    'ph': -0.2,
                    'temperature': -0.5,
                    'turbidity': 0.03
                },
                'message': 'Rainwater affecting pool chemistry'
            }
        ]
        
        # Select a random event
        event = random.choice(events)
        
        # Apply effects
        for param, effect in event['effects'].items():
            if param in self.parameters:
                self.parameters[param] += effect
        
        logger.info(f"Random event: {event['name']} - {event['message']}")
    
    def _inject_fault(self):
        """Inject a fault into the system for testing robustness."""
        faults = [
            {
                'name': 'pH sensor spike',
                'effects': {
                    'ph': lambda v: v + 1.0  # Sudden pH spike
                },
                'message': 'pH sensor reading fault detected'
            },
            {
                'name': 'ORP sensor dropout',
                'effects': {
                    'orp': lambda v: 0  # Zero reading
                },
                'message': 'ORP sensor communication error'
            },
            {
                'name': 'Chlorine sensor drift',
                'effects': {
                    'free_cl': lambda v: v * 2.5  # Reading much higher than reality
                },
                'message': 'Free chlorine sensor drift detected'
            }
        ]
        
        # Select a random fault
        fault = random.choice(faults)
        
        # Apply fault effects
        for param, effect_func in fault['effects'].items():
            if param in self.parameters:
                self.parameters[param] = effect_func(self.parameters[param])
        
        logger.warning(f"Fault injected: {fault['name']} - {fault['message']}")
    
    def _store_history(self):
        """Store current parameter values in history."""
        timestamp = datetime.now()
        
        for param, value in self.parameters.items():
            # Skip pump states
            if not param.endswith('_active'):
                self.history[param].append((timestamp, value))
                
                # Trim history if too long
                if len(self.history[param]) > self.max_history_points:
                    self.history[param].pop(0)
    
    def simulate_dosing(self, pump_type, duration, flow_rate=None):
        """Simulate a dosing operation with appropriate effects.
        
        Args:
            pump_type: 'acid', 'chlorine', or 'pac'
            duration: Duration in seconds
            flow_rate: Flow rate in ml/h (used for PAC only)
            
        Returns:
            bool: Success flag
        """
        if pump_type not in ['acid', 'chlorine', 'pac']:
            logger.error(f"Unknown pump type: {pump_type}")
            return False
        
        # Set pump active
        pump_param = f"{pump_type}_pump_active"
        
        if pump_type == 'acid':
            pump_param = 'acid_pump_active'
        elif pump_type == 'chlorine':
            pump_param = 'chlorine_pump_active'
        elif pump_type == 'pac':
            pump_param = 'pac_pump_active'
        
        self.parameters[pump_param] = True
        
        # Record dosing event
        event = {
            'timestamp': datetime.now(),
            'pump_type': pump_type,
            'duration': duration,
            'flow_rate': flow_rate
        }
        
        self.dosing_events.append(event)
        
        # Trim dosing events if too many
        if len(self.dosing_events) > 100:
            self.dosing_events.pop(0)
        
        # Schedule pump to stop after duration
        def stop_pump():
            self.parameters[pump_param] = False
            logger.info(f"Simulated {pump_type} dosing stopped after {duration}s")
        
        threading.Timer(duration, stop_pump).start()
        
        logger.info(f"Simulated {pump_type} dosing started for {duration}s")
        return True
    
    def get_parameter(self, name):
        """Get current value of a parameter."""
        return self.parameters.get(name)
    
    def get_history(self, parameter, hours=24):
        """Get historical data for a parameter.
        
        Args:
            parameter: Parameter name
            hours: How many hours of history to return
            
        Returns:
            list: List of (timestamp, value) tuples
        """
        if parameter not in self.history:
            return []
        
        cutoff = datetime.now() - timedelta(hours=hours)
        return [(ts, val) for ts, val in self.history[parameter] if ts >= cutoff]
    
    def get_dosing_events(self, pump_type=None, hours=24):
        """Get historical dosing events.
        
        Args:
            pump_type: Optional filter by pump type
            hours: How many hours of history to return
            
        Returns:
            list: List of dosing event dictionaries
        """
        cutoff = datetime.now() - timedelta(hours=hours)
        
        if pump_type:
            return [event for event in self.dosing_events 
                    if event['timestamp'] >= cutoff and event['pump_type'] == pump_type]
        else:
            return [event for event in self.dosing_events 
                    if event['timestamp'] >= cutoff]