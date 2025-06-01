"""
Tests for DatabaseHandler and related functionality
"""

import pytest
import sqlite3
import time
from unittest.mock import patch, MagicMock

from models.database import DatabaseHandler


class TestDatabaseHandler:
    """Test DatabaseHandler functionality"""
    
    def test_init_creates_tables(self, temp_db):
        """Test that initialization creates required tables"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            
            # Check that all tables exist
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            expected_tables = [
                'turbidity_readings', 'dosing_events', 'steiel_readings',
                'system_events', 'notification_settings'
            ]
            
            for table in expected_tables:
                assert table in tables, f"Table {table} not created"
    
    def test_log_turbidity(self, temp_db):
        """Test turbidity logging"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Log turbidity reading
        result = db.log_turbidity(0.15, 0.14, 'test-pool')
        assert result is True
        
        # Verify data was saved
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value, moving_avg, pool_id FROM turbidity_readings")
            row = cursor.fetchone()
            
            assert row is not None
            assert row[0] == 0.15
            assert row[1] == 0.14
            assert row[2] == 'test-pool'
    
    def test_log_dosing_event(self, temp_db):
        """Test dosing event logging"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Log dosing event
        result = db.log_dosing_event('PAC', 30, 100.0, 0.20, 'test-pool')
        assert result is True
        
        # Verify data was saved
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT event_type, duration, flow_rate, turbidity, pool_id 
                FROM dosing_events
            """)
            row = cursor.fetchone()
            
            assert row is not None
            assert row[0] == 'PAC'
            assert row[1] == 30
            assert row[2] == 100.0
            assert row[3] == 0.20
            assert row[4] == 'test-pool'
    
    def test_log_steiel_readings(self, temp_db):
        """Test Steiel controller readings logging"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Log Steiel readings
        result = db.log_steiel_readings(7.2, 720, 1.2, 0.2, 'test-pool')
        assert result is True
        
        # Verify data was saved
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ph, orp, free_cl, comb_cl, pool_id 
                FROM steiel_readings
            """)
            row = cursor.fetchone()
            
            assert row is not None
            assert row[0] == 7.2
            assert row[1] == 720
            assert row[2] == 1.2
            assert row[3] == 0.2
            assert row[4] == 'test-pool'
    
    def test_get_turbidity_history(self, temp_db):
        """Test turbidity history retrieval"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Add test data
        current_time = time.time()
        test_data = [
            (current_time - 3600, 0.15, 0.14, 'test-pool'),
            (current_time - 1800, 0.18, 0.16, 'test-pool'),
            (current_time - 900, 0.12, 0.13, 'test-pool')
        ]
        
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            for timestamp, value, moving_avg, pool_id in test_data:
                cursor.execute("""
                    INSERT INTO turbidity_readings (timestamp, value, moving_avg, pool_id)
                    VALUES (?, ?, ?, ?)
                """, (timestamp, value, moving_avg, pool_id))
            conn.commit()
        
        # Get history
        history = db.get_turbidity_history(hours=2, pool_id='test-pool')
        
        assert len(history) == 3
        assert history[0]['value'] == 0.15
        assert history[-1]['value'] == 0.12
    
    def test_get_steiel_history(self, temp_db):
        """Test Steiel history retrieval with parameterized queries"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Add test data with different pools
        current_time = time.time()
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO steiel_readings (timestamp, ph, orp, free_cl, comb_cl, pool_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (current_time - 1800, 7.2, 720, 1.2, 0.2, 'pool-1'))
            cursor.execute("""
                INSERT INTO steiel_readings (timestamp, ph, orp, free_cl, comb_cl, pool_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (current_time - 900, 7.4, 740, 1.0, 0.1, 'pool-2'))
            conn.commit()
        
        # Test pool-specific retrieval
        history_pool1 = db.get_steiel_history(hours=2, pool_id='pool-1')
        history_pool2 = db.get_steiel_history(hours=2, pool_id='pool-2')
        history_all = db.get_steiel_history(hours=2, pool_id=None)
        
        assert len(history_pool1) == 1
        assert len(history_pool2) == 1
        assert len(history_all) == 2
    
    def test_get_dosing_events(self, temp_db):
        """Test dosing events retrieval with filtering"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Add test data
        current_time = time.time()
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO dosing_events (timestamp, event_type, duration, flow_rate, turbidity, pool_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (current_time - 1800, 'PAC', 30, 100.0, 0.20, 'test-pool'))
            cursor.execute("""
                INSERT INTO dosing_events (timestamp, event_type, duration, flow_rate, turbidity, pool_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (current_time - 900, 'CHLORINE', 60, 50.0, 0.15, 'test-pool'))
            conn.commit()
        
        # Test event type filtering
        pac_events = db.get_dosing_events(hours=2, event_type='PAC', pool_id='test-pool')
        all_events = db.get_dosing_events(hours=2, event_type=None, pool_id='test-pool')
        
        assert len(pac_events) == 1
        assert len(all_events) == 2
        assert pac_events[0]['event_type'] == 'PAC'
    
    def test_validate_pool_access(self, temp_db):
        """Test pool access validation"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Create test data
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            # Create users table for foreign key
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pools (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    FOREIGN KEY (owner_id) REFERENCES users (id)
                )
            """)
            
            # Insert test data
            cursor.execute("INSERT INTO users (id, email) VALUES (?, ?)", ('user-1', 'test@example.com'))
            cursor.execute("INSERT INTO pools (id, name, owner_id) VALUES (?, ?, ?)", ('pool-1', 'Test Pool', 'user-1'))
            conn.commit()
        
        # Test access validation
        assert db.validate_pool_access('user-1', 'pool-1') is True
        assert db.validate_pool_access('user-2', 'pool-1') is False
        assert db.validate_pool_access('user-1', 'pool-2') is False
    
    def test_save_notification_settings(self, temp_db):
        """Test notification settings saving"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Save settings
        result = db.save_notification_settings('test@example.com', ['high_turbidity', 'pump_failure'])
        assert result is True
        
        # Verify data was saved
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT email, alert_types FROM notification_settings")
            row = cursor.fetchone()
            
            assert row is not None
            assert row[0] == 'test@example.com'
            assert 'high_turbidity,pump_failure' in row[1]
    
    def test_sql_injection_prevention(self, temp_db):
        """Test that SQL injection is prevented"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Attempt SQL injection in pool_id parameter
        malicious_pool_id = "'; DROP TABLE turbidity_readings; --"
        
        # This should not cause any issues due to parameterized queries
        result = db.log_turbidity(0.15, 0.14, malicious_pool_id)
        assert result is True
        
        # Verify table still exists and data is safely stored
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='turbidity_readings'")
            table_exists = cursor.fetchone()
            assert table_exists is not None
            
            cursor.execute("SELECT pool_id FROM turbidity_readings")
            stored_pool_id = cursor.fetchone()[0]
            assert stored_pool_id == malicious_pool_id  # Stored safely as string
    
    def test_database_indexes_created(self, temp_db):
        """Test that database indexes are created"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
            indexes = [row[0] for row in cursor.fetchall()]
            
            expected_indexes = [
                'idx_turbidity_timestamp',
                'idx_turbidity_pool_id',
                'idx_steiel_timestamp',
                'idx_dosing_timestamp'
            ]
            
            for index in expected_indexes:
                assert index in indexes, f"Index {index} not created"
    
    def test_error_handling(self, temp_db):
        """Test error handling in database operations"""
        db = DatabaseHandler(temp_db, auto_migrate=False)
        
        # Test with invalid data types
        result = db.log_turbidity("invalid", None, None)
        assert result is False
        
        # Test with extremely large values
        result = db.log_turbidity(999999999999999999999, None, None)
        # Should handle gracefully (SQLite is flexible with numbers)
        
    @patch('models.database.logger')
    def test_logging_on_errors(self, mock_logger, temp_db):
        """Test that errors are properly logged"""
        db = DatabaseHandler('/invalid/path/database.db', auto_migrate=False)
        
        # This should trigger error logging
        result = db.log_turbidity(0.15, 0.14, 'test-pool')
        
        # Verify error was logged
        assert mock_logger.error.called