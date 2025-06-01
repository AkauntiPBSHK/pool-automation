# backend/models/database.py
import os
import sqlite3
import time
import logging
from flask import current_app

logger = logging.getLogger(__name__)

# Try to import PostgreSQL support, but don't fail if it's not available
try:
    import psycopg2
    import psycopg2.extras
    POSTGRESQL_AVAILABLE = True
except ImportError:
    POSTGRESQL_AVAILABLE = False
    logger.warning("psycopg2 not available - PostgreSQL support disabled")

class DatabaseHandler:
    def __init__(self, db_path=None, auto_migrate=True):
        """Initialize the database with required tables."""
        self.db_path = db_path
        self.db_type = None
        self.auto_migrate = auto_migrate
        self._init_db()
    
    def _get_connection(self):
        """Get the appropriate database connection based on config."""
        # Check for Flask app context to get config
        if hasattr(current_app, 'config'):
            self.db_type = current_app.config.get('DB_TYPE', 'sqlite')
            
            if self.db_type == 'postgresql' and POSTGRESQL_AVAILABLE:
                return psycopg2.connect(
                    user=current_app.config.get('DB_USER', ''),
                    password=current_app.config.get('DB_PASSWORD', ''),
                    host=current_app.config.get('DB_HOST', 'localhost'),
                    port=current_app.config.get('DB_PORT', '5432'),
                    database=current_app.config.get('DB_NAME', 'pool_automation')
                )
            else:
                # Use configured database path or default
                db_path = current_app.config.get('DATABASE_PATH', self.db_path or 'pool_automation.db')
                return sqlite3.connect(db_path)
        
        # Fallback to SQLite with the provided path or default
        return sqlite3.connect(self.db_path or 'pool_automation.db')
    
    def _init_db(self):
        """Initialize the database tables if they don't exist."""
        with self._get_connection() as conn:
            # Detect database type from connection
            self.db_type = 'postgresql' if hasattr(conn, 'server_version') else 'sqlite'
            
            if self.db_type == 'postgresql':
                with conn.cursor() as cursor:
                    # PostgreSQL versions of table creation
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS turbidity_readings (
                            id SERIAL PRIMARY KEY,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            value REAL,
                            moving_avg REAL,
                            pool_id TEXT
                        )
                    ''')
                    
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS dosing_events (
                            id SERIAL PRIMARY KEY,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            event_type TEXT,
                            duration INTEGER,
                            flow_rate REAL,
                            turbidity REAL,
                            pool_id TEXT
                        )
                    ''')
                    
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS steiel_readings (
                            id SERIAL PRIMARY KEY,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            ph REAL,
                            orp INTEGER,
                            free_cl REAL,
                            comb_cl REAL,
                            pool_id TEXT
                        )
                    ''')
                    
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS system_events (
                            id SERIAL PRIMARY KEY,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            event_type TEXT,
                            description TEXT,
                            parameter TEXT,
                            value TEXT,
                            pool_id TEXT
                        )
                    ''')
                    
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS notification_settings (
                            id SERIAL PRIMARY KEY,
                            email TEXT UNIQUE,
                            alert_types TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    ''')
            else:
                # SQLite version (existing code)
                cursor = conn.cursor()
                
                # Create table for turbidity readings
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS turbidity_readings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        value REAL,
                        moving_avg REAL,
                        pool_id TEXT
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
                        turbidity REAL,
                        pool_id TEXT
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
                        comb_cl REAL,
                        pool_id TEXT
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
                        value TEXT,
                        pool_id TEXT
                    )
                ''')
                
                # Create table for notification settings
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS notification_settings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT UNIQUE,
                        alert_types TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
            
            # Create indexes for better performance
            self._create_indexes()
            
            conn.commit()
            logger.info(f"Database initialized successfully (type: {self.db_type})")
            
            # Run migrations if enabled
            if self.auto_migrate:
                self._run_migrations()
    
    def _create_indexes(self):
        """Create database indexes for better query performance"""
        try:
            with self._get_connection() as conn:
                if self.db_type == 'postgresql':
                    with conn.cursor() as cursor:
                        # Indexes for PostgreSQL
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_turbidity_timestamp ON turbidity_readings(timestamp)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_turbidity_pool_id ON turbidity_readings(pool_id)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_turbidity_timestamp_pool ON turbidity_readings(timestamp, pool_id)')
                        
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_steiel_timestamp ON steiel_readings(timestamp)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_steiel_pool_id ON steiel_readings(pool_id)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_steiel_timestamp_pool ON steiel_readings(timestamp, pool_id)')
                        
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_dosing_timestamp ON dosing_events(timestamp)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_dosing_pool_id ON dosing_events(pool_id)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_dosing_event_type ON dosing_events(event_type)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_dosing_timestamp_pool ON dosing_events(timestamp, pool_id)')
                        
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_events_pool_id ON system_events(pool_id)')
                        cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type)')
                else:
                    # Indexes for SQLite
                    cursor = conn.cursor()
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_turbidity_timestamp ON turbidity_readings(timestamp)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_turbidity_pool_id ON turbidity_readings(pool_id)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_turbidity_timestamp_pool ON turbidity_readings(timestamp, pool_id)')
                    
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_steiel_timestamp ON steiel_readings(timestamp)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_steiel_pool_id ON steiel_readings(pool_id)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_steiel_timestamp_pool ON steiel_readings(timestamp, pool_id)')
                    
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_dosing_timestamp ON dosing_events(timestamp)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_dosing_pool_id ON dosing_events(pool_id)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_dosing_event_type ON dosing_events(event_type)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_dosing_timestamp_pool ON dosing_events(timestamp, pool_id)')
                    
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_events_pool_id ON system_events(pool_id)')
                    cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type)')
                
                logger.info("Database indexes created successfully")
        except Exception as e:
            logger.error(f"Error creating database indexes: {e}")
    
    def _run_migrations(self):
        """Run database migrations if available"""
        try:
            # Import here to avoid circular imports
            import os
            import sys
            migrations_path = os.path.join(os.path.dirname(__file__), '..', 'migrations')
            if os.path.exists(migrations_path):
                sys.path.insert(0, migrations_path)
                from migration_manager import MigrationManager
                
                # Get database path
                db_path = self.db_path or 'pool_automation.db'
                if hasattr(current_app, 'config'):
                    db_path = current_app.config.get('DATABASE_PATH', db_path)
                
                # Run migrations
                manager = MigrationManager(db_path)
                pending = manager.get_pending_migrations()
                
                if pending:
                    logger.info(f"Running {len(pending)} pending migrations")
                    success = manager.migrate()
                    if success:
                        logger.info("All migrations applied successfully")
                    else:
                        logger.error("Migration failed")
                else:
                    logger.debug("No pending migrations")
                    
        except Exception as e:
            logger.warning(f"Could not run migrations: {e}")
    
    # Update all methods to support pool_id parameter
    
    def log_turbidity(self, value, moving_avg=None, pool_id=None):
        """Log a turbidity reading to the database."""
        try:
            with self._get_connection() as conn:
                if self.db_type == 'postgresql':
                    with conn.cursor() as cursor:
                        cursor.execute(
                            """
                            INSERT INTO turbidity_readings 
                            (timestamp, value, moving_avg, pool_id) 
                            VALUES (NOW(), %s, %s, %s)
                            """, 
                            (value, moving_avg, pool_id)
                        )
                else:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        INSERT INTO turbidity_readings 
                        (timestamp, value, moving_avg, pool_id) 
                        VALUES (?, ?, ?, ?)
                        """, 
                        (time.time(), value, moving_avg, pool_id)
                    )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error logging turbidity: {e}")
            return False
    
    def log_dosing_event(self, event_type, duration, flow_rate, turbidity, pool_id=None):
        """Log a dosing event to the database."""
        try:
            with self._get_connection() as conn:
                if self.db_type == 'postgresql':
                    with conn.cursor() as cursor:
                        cursor.execute(
                            """
                            INSERT INTO dosing_events 
                            (timestamp, event_type, duration, flow_rate, turbidity, pool_id) 
                            VALUES (NOW(), %s, %s, %s, %s, %s)
                            """, 
                            (event_type, duration, flow_rate, turbidity, pool_id)
                        )
                else:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        INSERT INTO dosing_events 
                        (timestamp, event_type, duration, flow_rate, turbidity, pool_id) 
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, 
                        (time.time(), event_type, duration, flow_rate, turbidity, pool_id)
                    )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error logging dosing event: {e}")
            return False
    
    def log_steiel_readings(self, ph, orp, free_cl, comb_cl, pool_id=None):
        """Log readings from the Steiel controller."""
        try:
            with self._get_connection() as conn:
                if self.db_type == 'postgresql':
                    with conn.cursor() as cursor:
                        cursor.execute(
                            """
                            INSERT INTO steiel_readings 
                            (timestamp, ph, orp, free_cl, comb_cl, pool_id) 
                            VALUES (NOW(), %s, %s, %s, %s, %s)
                            """, 
                            (ph, orp, free_cl, comb_cl, pool_id)
                        )
                else:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        INSERT INTO steiel_readings 
                        (timestamp, ph, orp, free_cl, comb_cl, pool_id) 
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, 
                        (time.time(), ph, orp, free_cl, comb_cl, pool_id)
                    )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error logging Steiel readings: {e}")
            return False
    
    # Update the get_turbidity_history, get_dosing_events, and get_steiel_history methods to filter by pool_id
    
    def get_turbidity_history(self, hours=24, pool_id=None):
        """Get turbidity history for the specified time period and pool."""
        try:
            with self._get_connection() as conn:
                if self.db_type == 'postgresql':
                    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                        cutoff_time = time.time() - (hours * 3600)
                        if pool_id:
                            cursor.execute(
                                """
                                SELECT EXTRACT(EPOCH FROM timestamp) as timestamp, value, moving_avg 
                                FROM turbidity_readings 
                                WHERE EXTRACT(EPOCH FROM timestamp) > %s AND pool_id = %s 
                                ORDER BY timestamp
                                """,
                                (cutoff_time, pool_id)
                            )
                        else:
                            cursor.execute(
                                """
                                SELECT EXTRACT(EPOCH FROM timestamp) as timestamp, value, moving_avg 
                                FROM turbidity_readings 
                                WHERE EXTRACT(EPOCH FROM timestamp) > %s 
                                ORDER BY timestamp
                                """,
                                (cutoff_time,)
                            )
                        return [dict(row) for row in cursor.fetchall()]
                else:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    cutoff_time = time.time() - (hours * 3600)
                    
                    if pool_id:
                        cursor.execute(
                            """
                            SELECT timestamp, value, moving_avg 
                            FROM turbidity_readings 
                            WHERE timestamp > ? AND pool_id = ? 
                            ORDER BY timestamp
                            """,
                            (cutoff_time, pool_id)
                        )
                    else:
                        cursor.execute(
                            """
                            SELECT timestamp, value, moving_avg 
                            FROM turbidity_readings 
                            WHERE timestamp > ? 
                            ORDER BY timestamp
                            """,
                            (cutoff_time,)
                        )
                    
                    return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error getting turbidity history: {e}")
            return []
    
    # Add similar pool_id filtering to get_dosing_events and get_steiel_history
    
    def save_notification_settings(self, email, alert_types):
        """Save notification settings for a user."""
        try:
            # Convert alert_types list to a string if needed
            if isinstance(alert_types, list):
                alert_types = ','.join(alert_types)
                
            with self._get_connection() as conn:
                if self.db_type == 'postgresql':
                    with conn.cursor() as cursor:
                        cursor.execute(
                            """
                            INSERT INTO notification_settings (email, alert_types)
                            VALUES (%s, %s)
                            ON CONFLICT (email) DO UPDATE
                            SET alert_types = EXCLUDED.alert_types,
                                created_at = NOW()
                            """,
                            (email, alert_types)
                        )
                else:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        INSERT OR REPLACE INTO notification_settings (email, alert_types, created_at)
                        VALUES (?, ?, ?)
                        """,
                        (email, alert_types, time.time())
                    )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error saving notification settings: {e}")
            return False
    
    def get_steiel_history(self, hours=24, pool_id=None):
        """Get Steiel sensor history with proper parameterization."""
        with self._get_connection() as conn:
            try:
                conn.row_factory = sqlite3.Row if self.db_type != 'postgresql' else None
                
                if self.db_type == 'postgresql':
                    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                        cursor.execute('''
                            SELECT timestamp, ph, orp, free_chlorine, combined_chlorine, temperature
                            FROM steiel_readings 
                            WHERE timestamp >= NOW() - INTERVAL %s HOUR
                            AND (%s IS NULL OR pool_id = %s)
                            ORDER BY timestamp ASC
                        ''', (hours, pool_id, pool_id))
                        return [dict(row) for row in cursor.fetchall()]
                else:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT timestamp, ph, orp, free_chlorine, combined_chlorine, temperature
                        FROM steiel_readings 
                        WHERE timestamp >= datetime('now', '-' || ? || ' hours')
                        AND (? IS NULL OR pool_id = ?)
                        ORDER BY timestamp ASC
                    ''', (hours, pool_id, pool_id))
                    return [dict(row) for row in cursor.fetchall()]
                    
            except Exception as e:
                logger.error(f"Error getting Steiel history: {e}")
                return []
    
    def get_dosing_events(self, hours=24, event_type=None, pool_id=None):
        """Get dosing events history with proper parameterization."""
        with self._get_connection() as conn:
            try:
                conn.row_factory = sqlite3.Row if self.db_type != 'postgresql' else None
                
                if self.db_type == 'postgresql':
                    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                        cursor.execute('''
                            SELECT timestamp, event_type, duration, flow_rate, turbidity_before
                            FROM dosing_events 
                            WHERE timestamp >= NOW() - INTERVAL %s HOUR
                            AND (%s IS NULL OR event_type = %s)
                            AND (%s IS NULL OR pool_id = %s)
                            ORDER BY timestamp DESC
                        ''', (hours, event_type, event_type, pool_id, pool_id))
                        return [dict(row) for row in cursor.fetchall()]
                else:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT timestamp, event_type, duration, flow_rate, turbidity_before
                        FROM dosing_events 
                        WHERE timestamp >= datetime('now', '-' || ? || ' hours')
                        AND (? IS NULL OR event_type = ?)
                        AND (? IS NULL OR pool_id = ?)
                        ORDER BY timestamp DESC
                    ''', (hours, event_type, event_type, pool_id, pool_id))
                    return [dict(row) for row in cursor.fetchall()]
                    
            except Exception as e:
                logger.error(f"Error getting dosing events: {e}")
                return []
    
    def get_notification_settings(self, user_id):
        """Get notification settings for a user."""
        with self._get_connection() as conn:
            try:
                conn.row_factory = sqlite3.Row if self.db_type != 'postgresql' else None
                
                if self.db_type == 'postgresql':
                    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                        cursor.execute('''
                            SELECT email, email_enabled, alert_threshold
                            FROM notification_settings 
                            WHERE user_id = %s
                        ''', (user_id,))
                        result = cursor.fetchone()
                        return dict(result) if result else None
                else:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT email, email_enabled, alert_threshold
                        FROM notification_settings 
                        WHERE user_id = ?
                    ''', (user_id,))
                    result = cursor.fetchone()
                    return dict(result) if result else None
                    
            except Exception as e:
                logger.error(f"Error getting notification settings: {e}")
                return None
    
    def validate_pool_access(self, user_id, pool_id):
        """Validate that a user has access to a specific pool."""
        with self._get_connection() as conn:
            try:
                if self.db_type == 'postgresql':
                    with conn.cursor() as cursor:
                        cursor.execute('''
                            SELECT COUNT(*) FROM pools 
                            WHERE id = %s AND owner_id = %s
                        ''', (pool_id, user_id))
                        return cursor.fetchone()[0] > 0
                else:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT COUNT(*) FROM pools 
                        WHERE id = ? AND owner_id = ?
                    ''', (pool_id, user_id))
                    return cursor.fetchone()[0] > 0
                    
            except Exception as e:
                logger.error(f"Error validating pool access: {e}")
                return False