# hardware/controllers/steiel.py
import logging
import time
import random
from datetime import datetime

logger = logging.getLogger(__name__)

class MockSteielController:
    """Mock implementation for simulation mode."""
    
    def __init__(self, port=None, modbus_address=None):
        """Initialize the mock Steiel controller."""
        self.last_readings = {
            'ph': 7.4,
            'orp': 720,
            'free_cl': 1.2,
            'comb_cl': 0.2,
            'acid_pump_status': False,
            'cl_pump_status': False,
            'timestamp': datetime.now()
        }
    
    def get_readings(self):
        """Generate simulated readings."""
        # Generate random variations for each parameter
        ph_variation = (random.random() - 0.5) * 0.2
        orp_variation = (random.random() - 0.5) * 30
        free_cl_variation = (random.random() - 0.5) * 0.3
        comb_cl_variation = (random.random() - 0.5) * 0.1
        
        # Random pump status changes (5% chance)
        if random.random() < 0.05:
            self.last_readings['acid_pump_status'] = not self.last_readings['acid_pump_status']
        
        if random.random() < 0.05:
            self.last_readings['cl_pump_status'] = not self.last_readings['cl_pump_status']
        
        # Update readings with variations
        self.last_readings.update({
            'ph': max(6.8, min(8.0, self.last_readings['ph'] + ph_variation)),
            'orp': max(600, min(800, self.last_readings['orp'] + orp_variation)),
            'free_cl': max(0.5, min(3.0, self.last_readings['free_cl'] + free_cl_variation)),
            'comb_cl': max(0.0, min(0.5, self.last_readings['comb_cl'] + comb_cl_variation)),
            'timestamp': datetime.now()
        })
        
        return self.last_readings