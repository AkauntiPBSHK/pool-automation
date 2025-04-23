# backend/utils/simulator.py
import time
import random
import math
import logging
from ..models.database import DatabaseHandler

logger = logging.getLogger(__name__)

class DataSimulator:
    """Utility to generate simulated data for development and testing."""
    
    def __init__(self, db_handler):
        self.db = db_handler
    
    def generate_historical_data(self, days=7):
        """Generate simulated historical data for the past days."""
        logger.info(f"Generating {days} days of simulated data")
        
        current_time = time.time()
        samples_per_hour = 12  # 5-minute intervals
        hours = days * 24
        total_samples = hours * samples_per_hour
        
        # Generate base values with daily patterns
        base_ph = 7.4
        base_orp = 720
        base_free_cl = 1.2
        base_comb_cl = 0.2
        base_turbidity = 0.15
        
        # Generate data points
        moving_avg_turbidity = base_turbidity
        
        for i in range(total_samples):
            # Calculate timestamp for this sample
            sample_time = current_time - ((total_samples - i) * 3600 / samples_per_hour)
            
            # Add daily and random variations
            hour_of_day = (time.localtime(sample_time).tm_hour + 
                           time.localtime(sample_time).tm_min / 60)
            
            # Daily cycle: values change based on time of day
            daily_factor = math.sin(hour_of_day * math.pi / 12)
            
            # Add some random walk behavior
            random_walk = sum(random.uniform(-0.05, 0.05) for _ in range(5))
            
            # Calculate values with variations
            ph = base_ph + daily_factor * 0.1 + random_walk * 0.05
            ph = max(7.0, min(7.8, ph))
            
            orp = base_orp + daily_factor * 15 + random_walk * 10
            orp = max(650, min(780, orp))
            
            free_cl = base_free_cl + daily_factor * 0.1 + random_walk * 0.05
            free_cl = max(0.8, min(1.6, free_cl))
            
            comb_cl = base_comb_cl + daily_factor * 0.05 + random_walk * 0.02
            comb_cl = max(0.1, min(0.4, comb_cl))
            
            turbidity = base_turbidity + daily_factor * 0.02 + random_walk * 0.01
            turbidity = max(0.10, min(0.25, turbidity))
            
            # Calculate exponential moving average for turbidity
            alpha = 0.1  # Smoothing factor
            moving_avg_turbidity = alpha * turbidity + (1 - alpha) * moving_avg_turbidity
            
            # Log to database
            self.db.log_turbidity(turbidity, moving_avg_turbidity)
            self.db.log_steiel_readings(ph, orp, free_cl, comb_cl)
            
            # Occasionally generate dosing events (when turbidity gets high)
            if turbidity > 0.20 and random.random() < 0.2:
                duration = random.choice([30, 60, 120])
                flow_rate = random.uniform(60, 150)
                self.db.log_dosing_event("PAC", duration, flow_rate, turbidity)
                
                # After dosing, turbidity should decrease
                base_turbidity = max(0.12, base_turbidity - 0.02)
            
            # Random drift for base values (represents water condition changes)
            if i % samples_per_hour == 0:  # Once per hour
                base_ph += random.uniform(-0.02, 0.02)
                base_orp += random.uniform(-5, 5)
                base_free_cl += random.uniform(-0.02, 0.02)
                base_comb_cl += random.uniform(-0.01, 0.01)
                base_turbidity += random.uniform(-0.005, 0.01)
                
                # Keep within reasonable limits
                base_ph = max(7.2, min(7.6, base_ph))
                base_orp = max(680, min(760, base_orp))
                base_free_cl = max(1.0, min(1.4, base_free_cl))
                base_comb_cl = max(0.1, min(0.3, base_comb_cl))
                base_turbidity = max(0.12, min(0.18, base_turbidity))
        
        logger.info(f"Generated {total_samples} data points")