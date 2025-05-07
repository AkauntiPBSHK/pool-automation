# backend/models/database.py
import sqlite3
import time
import os
import logging

logger = logging.getLogger(__name__)

class DatabaseHandler:
    def __init__(self, db_path='pool_automation.db'):
        """Initialize the database with required tables."""
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize the database tables if they don't exist."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Create table for turbidity readings
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS turbidity_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    value REAL,
                    moving_avg REAL
                )
            ''')
            
            # Create table for dosing events
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS dosing_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    event_type TEXT,
                    duration INTEGER,
                    flow_rate REAL,
                    turbidity REAL
                )
            ''')
            
            # Create table for Steiel controller readings (pH, ORP, chlorine)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS steiel_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ph REAL,
                    orp INTEGER,
                    free_cl REAL,
                    comb_cl REAL
                )
            ''')
            
            # Create table for system events
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS system_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    event_type TEXT,
                    description TEXT,
                    parameter TEXT,
                    value TEXT
                )
            ''')
            
            conn.commit()
            logger.info("Database initialized successfully")
    
    def log_turbidity(self, value, moving_avg=None):
        """Log a turbidity reading to the database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'INSERT INTO turbidity_readings (timestamp, value, moving_avg) VALUES (?, ?, ?)',
                    (time.time(), value, moving_avg)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error logging turbidity: {e}")
            return False
    
    def log_dosing_event(self, event_type, duration, flow_rate, turbidity):
        """Log a dosing event to the database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'INSERT INTO dosing_events (timestamp, event_type, duration, flow_rate, turbidity) VALUES (?, ?, ?, ?, ?)',
                    (time.time(), event_type, duration, flow_rate, turbidity)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error logging dosing event: {e}")
            return False
    
    def log_steiel_readings(self, ph, orp, free_cl, comb_cl):
        """Log readings from the Steiel controller."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'INSERT INTO steiel_readings (timestamp, ph, orp, free_cl, comb_cl) VALUES (?, ?, ?, ?, ?)',
                    (time.time(), ph, orp, free_cl, comb_cl)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error logging Steiel readings: {e}")
            return False
    
    def log_system_event(self, event_type, description, parameter=None, value=None):
        """Log a system event to the database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'INSERT INTO system_events (timestamp, event_type, description, parameter, value) VALUES (?, ?, ?, ?, ?)',
                    (time.time(), event_type, description, parameter, value)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error logging system event: {e}")
            return False
    
    def get_turbidity_history(self, hours=24):
        """Get turbidity history for the specified time period."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cutoff_time = time.time() - (hours * 3600)
                cursor.execute(
                    'SELECT timestamp, value, moving_avg FROM turbidity_readings WHERE timestamp > ? ORDER BY timestamp',
                    (cutoff_time,)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error getting turbidity history: {e}")
            return []
    
    def get_dosing_events(self, hours=24, limit=50):
        """Get recent dosing events."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cutoff_time = time.time() - (hours * 3600)
                cursor.execute(
                    'SELECT * FROM dosing_events WHERE timestamp > ? ORDER BY timestamp DESC LIMIT ?',
                    (cutoff_time, limit)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error getting dosing events: {e}")
            return []
    
    def get_steiel_history(self, hours=24):
        """Get Steiel controller readings history."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cutoff_time = time.time() - (hours * 3600)
                cursor.execute(
                    'SELECT timestamp, ph, orp, free_cl, comb_cl FROM steiel_readings WHERE timestamp > ? ORDER BY timestamp',
                    (cutoff_time,)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error getting Steiel history: {e}")
            return []