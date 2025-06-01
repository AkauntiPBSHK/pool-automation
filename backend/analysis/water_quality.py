# backend/analysis/water_quality.py
import numpy as np
import pandas as pd
from scipy import stats
from datetime import datetime, timedelta

class WaterQualityAnalyzer:
    """Analysis tools for pool water quality data."""
    
    def __init__(self, db_handler):
        """Initialize with database handler."""
        self.db = db_handler
    
    def calculate_basic_stats(self, parameter, start_time=None, end_time=None):
        """Calculate basic statistics for a parameter."""
        # Get data from database
        data = self._get_parameter_data(parameter, start_time, end_time)
        
        if not data or len(data) == 0:
            return {
                'count': 0,
                'mean': None,
                'median': None,
                'min': None,
                'max': None,
                'std': None
            }
        
        # Convert to numpy array for calculations
        values = np.array([entry['value'] for entry in data])
        
        return {
            'count': len(values),
            'mean': float(np.mean(values)),
            'median': float(np.median(values)),
            'min': float(np.min(values)),
            'max': float(np.max(values)),
            'std': float(np.std(values)),
            'percentile_25': float(np.percentile(values, 25)),
            'percentile_75': float(np.percentile(values, 75))
        }
    
    def detect_outliers(self, parameter, start_time=None, end_time=None, threshold=3.0):
        """Detect outliers using Z-score method."""
        # Get data from database
        data = self._get_parameter_data(parameter, start_time, end_time)
        
        if not data or len(data) < 10:  # Need enough data for meaningful outlier detection
            return []
        
        # Extract timestamps and values
        timestamps = [entry['timestamp'] for entry in data]
        values = np.array([entry['value'] for entry in data])
        
        # Calculate Z-scores
        z_scores = np.abs(stats.zscore(values))
        
        # Find outliers
        outliers = []
        for i, (ts, val, z) in enumerate(zip(timestamps, values, z_scores)):
            if z > threshold:
                outliers.append({
                    'timestamp': ts,
                    'value': float(val),
                    'z_score': float(z),
                    'index': i
                })
        
        return outliers
    
    def calculate_trends(self, parameter, start_time=None, end_time=None, window_size=24):
        """Calculate trends using moving averages."""
        # Get data from database
        data = self._get_parameter_data(parameter, start_time, end_time)
        
        if not data or len(data) < window_size * 2:
            return {
                'trend': 'insufficient_data',
                'slope': None,
                'r_value': None
            }
        
        # Convert to pandas Series for easier time-series operations
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s')
        df = df.set_index('timestamp')
        
        # Calculate moving average
        df['moving_avg'] = df['value'].rolling(window=window_size).mean()
        
        # Drop NaN values from start of moving average
        df = df.dropna()
        
        if len(df) < 2:
            return {
                'trend': 'insufficient_data',
                'slope': None,
                'r_value': None
            }
        
        # Linear regression on moving average to find trend
        x = np.arange(len(df))
        y = df['moving_avg'].values
        
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        
        # Determine trend direction
        if abs(r_value) < 0.3:
            trend = 'stable'
        elif slope > 0:
            trend = 'increasing'
        else:
            trend = 'decreasing'
        
        return {
            'trend': trend,
            'slope': float(slope),
            'r_value': float(r_value),
            'p_value': float(p_value),
            'std_err': float(std_err),
            'moving_average': df['moving_avg'].tolist(),
            'timestamps': df.index.astype(str).tolist()
        }
    
    def analyze_dosing_effectiveness(self, days=7):
        """Analyze effectiveness of dosing operations."""
        # Get dosing events
        end_time = datetime.now().timestamp()
        start_time = end_time - (days * 86400)
        
        dosing_events = self.db.get_dosing_events_in_range(start_time, end_time)
        
        if not dosing_events:
            return {
                'effectiveness': 'unknown',
                'events_analyzed': 0,
                'average_improvement': None
            }
        
        # Analyze each dosing event
        improvements = []
        
        for event in dosing_events:
            # Get turbidity before and after dosing
            before_time = event['timestamp'] - 300  # 5 minutes before
            after_time = event['timestamp'] + event['duration'] + 300  # Duration + 5 minutes after
            
            before_data = self._get_parameter_data('turbidity', before_time, event['timestamp'])
            after_data = self._get_parameter_data('turbidity', event['timestamp'] + event['duration'], after_time)
            
            if not before_data or not after_data:
                continue
            
            # Calculate average turbidity before and after
            before_avg = np.mean([entry['value'] for entry in before_data])
            after_avg = np.mean([entry['value'] for entry in after_data])
            
            # Calculate improvement percentage
            improvement = (before_avg - after_avg) / before_avg * 100 if before_avg > 0 else 0
            
            improvements.append({
                'event_time': event['timestamp'],
                'before_avg': float(before_avg),
                'after_avg': float(after_avg),
                'improvement_pct': float(improvement),
                'flow_rate': event['flow_rate'],
                'duration': event['duration']
            })
        
        if not improvements:
            return {
                'effectiveness': 'unknown',
                'events_analyzed': 0,
                'average_improvement': None
            }
        
        # Calculate average improvement
        avg_improvement = np.mean([imp['improvement_pct'] for imp in improvements])
        
        # Determine effectiveness rating
        if avg_improvement < 0:
            effectiveness = 'negative'
        elif avg_improvement < 5:
            effectiveness = 'poor'
        elif avg_improvement < 15:
            effectiveness = 'fair'
        elif avg_improvement < 30:
            effectiveness = 'good'
        else:
            effectiveness = 'excellent'
        
        return {
            'effectiveness': effectiveness,
            'events_analyzed': len(improvements),
            'average_improvement': float(avg_improvement),
            'improvements': improvements
        }
    
    def generate_report(self, days=7):
        """Generate a comprehensive water quality report."""
        end_time = datetime.now().timestamp()
        start_time = end_time - (days * 86400)
        
        # Get stats for all parameters
        parameters = ['ph', 'orp', 'free_chlorine', 'combined_chlorine', 'turbidity', 'temperature']
        stats = {}
        
        for param in parameters:
            stats[param] = self.calculate_basic_stats(param, start_time, end_time)
        
        # Get dosing effectiveness
        dosing_effectiveness = self.analyze_dosing_effectiveness(days)
        
        # Get trends
        trends = {}
        for param in parameters:
            trends[param] = self.calculate_trends(param, start_time, end_time)
        
        # Count events
        events = self.db.get_all_events_in_range(start_time, end_time)
        event_counts = {}
        
        for event in events:
            event_type = event['event_type']
            if event_type not in event_counts:
                event_counts[event_type] = 0
            event_counts[event_type] += 1
        
        # Generate health score (0-100)
        health_scores = {
            'ph': self._calculate_health_score('ph', stats['ph']),
            'orp': self._calculate_health_score('orp', stats['orp']),
            'free_chlorine': self._calculate_health_score('free_chlorine', stats['free_chlorine']),
            'combined_chlorine': self._calculate_health_score('combined_chlorine', stats['combined_chlorine']),
            'turbidity': self._calculate_health_score('turbidity', stats['turbidity'])
        }
        
        overall_health = sum(health_scores.values()) / len(health_scores)
        
        return {
            'period': {
                'start': datetime.fromtimestamp(start_time).isoformat(),
                'end': datetime.fromtimestamp(end_time).isoformat(),
                'days': days
            },
            'statistics': stats,
            'trends': trends,
            'dosing_effectiveness': dosing_effectiveness,
            'event_counts': event_counts,
            'health_scores': health_scores,
            'overall_health': float(overall_health),
            'generated_at': datetime.now().isoformat()
        }
    
    def _get_parameter_data(self, parameter, start_time=None, end_time=None):
        """Get parameter data from database."""
        if parameter == 'ph':
            return self.db.get_ph_history_in_range(start_time, end_time)
        elif parameter == 'orp':
            return self.db.get_orp_history_in_range(start_time, end_time)
        elif parameter == 'free_chlorine':
            return self.db.get_free_chlorine_history_in_range(start_time, end_time)
        elif parameter == 'combined_chlorine':
            return self.db.get_combined_chlorine_history_in_range(start_time, end_time)
        elif parameter == 'turbidity':
            return self.db.get_turbidity_history_in_range(start_time, end_time)
        elif parameter == 'temperature':
            return self.db.get_temperature_history_in_range(start_time, end_time)
        else:
            return []
    
    def _calculate_health_score(self, parameter, stats):
        """Calculate health score for a parameter (0-100)."""
        if not stats or stats['count'] == 0:
            return 50  # Neutral score with no data
        
        # Define ideal ranges
        ideal_ranges = {
            'ph': (7.2, 7.6),
            'orp': (650, 750),
            'free_chlorine': (1.0, 2.0),
            'combined_chlorine': (0.0, 0.3),
            'turbidity': (0.05, 0.25)
        }
        
        # If parameter not in ideal ranges
        if parameter not in ideal_ranges:
            return 50
        
        ideal_min, ideal_max = ideal_ranges[parameter]
        
        # If mean is within ideal range
        if stats['mean'] >= ideal_min and stats['mean'] <= ideal_max:
            # Higher score for smaller standard deviation (more stable)
            norm_std = min(1.0, stats['std'] / (ideal_max - ideal_min))
            stability_factor = 1.0 - norm_std
            
            # Start with 80 for being in range
            score = 80 + 20 * stability_factor
        else:
            # Calculate how far outside the range
            if stats['mean'] < ideal_min:
                deviation = (ideal_min - stats['mean']) / (ideal_min - minValue(parameter))
            else:
                deviation = (stats['mean'] - ideal_max) / (maxValue(parameter) - ideal_max)
            
            deviation = min(1.0, deviation)
            
            # Score drops as deviation increases
            score = 70 * (1.0 - deviation)
        
        return float(score)

def minValue(parameter):
    """Get minimum reasonable value for a parameter."""
    ranges = {
        'ph': 6.8,
        'orp': 500,
        'free_chlorine': 0.5,
        'combined_chlorine': 0.0,
        'turbidity': 0.05
    }
    return ranges.get(parameter, 0)

def maxValue(parameter):
    """Get maximum reasonable value for a parameter."""
    ranges = {
        'ph': 8.0,
        'orp': 850,
        'free_chlorine': 3.0,
        'combined_chlorine': 0.5,
        'turbidity': 0.5
    }
    return ranges.get(parameter, 100)