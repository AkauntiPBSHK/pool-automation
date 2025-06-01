# tests/test_simulator.py
import unittest
import time
from backend.utils.enhanced_simulator import EnhancedPoolSimulator

class TestEnhancedSimulator(unittest.TestCase):
    def setUp(self):
        # Create a simulator with accelerated time
        self.simulator = EnhancedPoolSimulator({
            'time_scale': 10.0,  # 10x speed for faster testing
            'update_interval': 0.1
        })
    
    def test_parameters_in_bounds(self):
        """Test that all parameters stay within realistic bounds."""
        # Run simulation for a simulated hour
        for _ in range(36):  # 0.1s * 36 * 10 time_scale = ~36 seconds (~10 minutes in sim time)
            self.simulator.update()
            time.sleep(0.1)
        
        # Check each parameter is within constraints
        params = self.simulator.get_all_parameters()
        for param, value in params.items():
            min_val = self.simulator.constraints[param]['min']
            max_val = self.simulator.constraints[param]['max']
            self.assertGreaterEqual(value, min_val, f"{param} below minimum: {value} < {min_val}")
            self.assertLessEqual(value, max_val, f"{param} above maximum: {value} > {max_val}")
    
    def test_pump_effects(self):
        """Test that pumps correctly affect parameters."""
        # Get initial state
        initial_params = self.simulator.get_all_parameters()
        
        # Turn on the acid pump
        self.simulator.set_pump_state('acid', True)
        
        # Run for a simulated 10 minutes
        for _ in range(60):  # 0.1s * 60 * 10 time_scale = 60 seconds (~10 minutes in sim time)
            self.simulator.update()
            time.sleep(0.1)
        
        # Get new state
        new_params = self.simulator.get_all_parameters()
        
        # pH should have decreased
        self.assertLess(new_params['ph'], initial_params['ph'], 
                       f"pH did not decrease after acid pump: {initial_params['ph']} -> {new_params['ph']}")
        
        # Reset for next test
        self.simulator.set_pump_state('acid', False)
        
        # Test chlorine pump
        initial_params = self.simulator.get_all_parameters()
        self.simulator.set_pump_state('chlorine', True)
        
        # Run for a simulated 10 minutes
        for _ in range(60):
            self.simulator.update()
            time.sleep(0.1)
        
        new_params = self.simulator.get_all_parameters()
        
        # Free chlorine should have increased
        self.assertGreater(new_params['free_chlorine'], initial_params['free_chlorine'],
                         f"Free chlorine did not increase: {initial_params['free_chlorine']} -> {new_params['free_chlorine']}")
        
        # ORP should have increased
        self.assertGreater(new_params['orp'], initial_params['orp'],
                         f"ORP did not increase: {initial_params['orp']} -> {new_params['orp']}")
    
    def test_events_generation(self):
        """Test that events are generated periodically."""
        # Speed up event generation for testing
        self.simulator.next_event_time = time.time() + 1
        
        # Run until we have at least one event
        events_found = False
        max_attempts = 100
        
        for _ in range(max_attempts):
            self.simulator.update()
            time.sleep(0.1)
            
            if len(self.simulator.events) > 0:
                events_found = True
                break
        
        self.assertTrue(events_found, "No events were generated")
        self.assertGreaterEqual(len(self.simulator.events), 1)
        
        # Verify event structure
        event = self.simulator.events[0]
        self.assertIn('time', event)
        self.assertIn('type', event)
        self.assertIn('description', event)

# More test cases for dosing controller, etc.