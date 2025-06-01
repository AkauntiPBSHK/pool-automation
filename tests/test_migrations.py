"""
Tests for database migration system
"""

import pytest
import sqlite3
import tempfile
import os
from unittest.mock import patch, MagicMock

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'migrations'))

from migration_manager import MigrationManager, Migration


class TestMigration:
    """Test Migration class"""
    
    def test_migration_creation(self):
        """Test creating a migration"""
        migration = Migration(
            version="001",
            name="test_migration",
            sql_up="CREATE TABLE test (id INTEGER);",
            sql_down="DROP TABLE test;",
            description="Test migration"
        )
        
        assert migration.version == "001"
        assert migration.name == "test_migration"
        assert migration.description == "Test migration"
        assert migration.checksum is not None
        assert len(migration.checksum) == 64  # SHA256 hex length
    
    def test_migration_checksum_consistency(self):
        """Test that migration checksums are consistent"""
        migration1 = Migration("001", "test", "SQL1", "SQL2")
        migration2 = Migration("001", "test", "SQL1", "SQL2")
        migration3 = Migration("001", "test", "SQL1", "DIFFERENT")
        
        assert migration1.checksum == migration2.checksum
        assert migration1.checksum != migration3.checksum


class TestMigrationManager:
    """Test MigrationManager functionality"""
    
    def test_init_creates_migration_table(self, temp_db):
        """Test that initialization creates migration tracking table"""
        manager = MigrationManager(temp_db)
        
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
            table_exists = cursor.fetchone()
            
            assert table_exists is not None
    
    def test_load_hardcoded_migrations(self, temp_db):
        """Test loading hardcoded migrations"""
        manager = MigrationManager(temp_db)
        manager.load_migrations()
        
        assert len(manager.migrations) >= 3  # Should have at least 3 hardcoded migrations
        
        # Check that migrations are sorted by version
        versions = [m.version for m in manager.migrations]
        assert versions == sorted(versions)
    
    def test_get_applied_migrations_empty(self, temp_db):
        """Test getting applied migrations when none applied"""
        manager = MigrationManager(temp_db)
        applied = manager.get_applied_migrations()
        
        assert applied == []
    
    def test_get_pending_migrations(self, temp_db):
        """Test getting pending migrations"""
        manager = MigrationManager(temp_db)
        manager.load_migrations()
        
        pending = manager.get_pending_migrations()
        
        # All migrations should be pending initially
        assert len(pending) == len(manager.migrations)
    
    def test_apply_single_migration(self, temp_db):
        """Test applying a single migration"""
        manager = MigrationManager(temp_db)
        
        # Create a simple test migration
        test_migration = Migration(
            version="999",
            name="test_table",
            sql_up="CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT);",
            sql_down="DROP TABLE test_table;",
            description="Test migration"
        )
        
        # Apply the migration
        success = manager._apply_migration(test_migration)
        assert success is True
        
        # Verify table was created
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
            table_exists = cursor.fetchone()
            assert table_exists is not None
        
        # Verify migration was recorded
        applied = manager.get_applied_migrations()
        assert "999" in applied
    
    def test_rollback_migration(self, temp_db):
        """Test rolling back a migration"""
        manager = MigrationManager(temp_db)
        
        # Create and apply a test migration
        test_migration = Migration(
            version="999",
            name="test_table",
            sql_up="CREATE TABLE test_table (id INTEGER PRIMARY KEY);",
            sql_down="DROP TABLE test_table;",
            description="Test migration"
        )
        
        manager._apply_migration(test_migration)
        
        # Verify table exists
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
            assert cursor.fetchone() is not None
        
        # Rollback the migration
        success = manager._rollback_migration(test_migration)
        assert success is True
        
        # Verify table was dropped
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
            assert cursor.fetchone() is None
        
        # Verify migration record was removed
        applied = manager.get_applied_migrations()
        assert "999" not in applied
    
    def test_migrate_all_pending(self, temp_db):
        """Test migrating all pending migrations"""
        manager = MigrationManager(temp_db)
        
        # Add a simple test migration
        test_migration = Migration(
            version="001",
            name="test_migration",
            sql_up="CREATE TABLE migration_test (id INTEGER);",
            sql_down="DROP TABLE migration_test;",
            description="Test"
        )
        manager.migrations = [test_migration]
        
        # Migrate
        success = manager.migrate()
        assert success is True
        
        # Verify no pending migrations
        pending = manager.get_pending_migrations()
        assert len(pending) == 0
    
    def test_migrate_to_specific_version(self, temp_db):
        """Test migrating to a specific version"""
        manager = MigrationManager(temp_db)
        
        # Add test migrations
        migration1 = Migration("001", "test1", "CREATE TABLE test1 (id INTEGER);", "DROP TABLE test1;")
        migration2 = Migration("002", "test2", "CREATE TABLE test2 (id INTEGER);", "DROP TABLE test2;")
        migration3 = Migration("003", "test3", "CREATE TABLE test3 (id INTEGER);", "DROP TABLE test3;")
        
        manager.migrations = [migration1, migration2, migration3]
        
        # Migrate to version 002
        success = manager.migrate("002")
        assert success is True
        
        # Verify only migrations 001 and 002 were applied
        applied = manager.get_applied_migrations()
        assert "001" in applied
        assert "002" in applied
        assert "003" not in applied
    
    def test_rollback_to_version(self, temp_db):
        """Test rolling back to a specific version"""
        manager = MigrationManager(temp_db)
        
        # Create and apply test migrations
        migrations = [
            Migration("001", "test1", "CREATE TABLE test1 (id INTEGER);", "DROP TABLE test1;"),
            Migration("002", "test2", "CREATE TABLE test2 (id INTEGER);", "DROP TABLE test2;"),
            Migration("003", "test3", "CREATE TABLE test3 (id INTEGER);", "DROP TABLE test3;")
        ]
        
        manager.migrations = migrations
        
        # Apply all migrations
        for migration in migrations:
            manager._apply_migration(migration)
        
        # Rollback to version 001
        success = manager.rollback("001")
        assert success is True
        
        # Verify only migration 001 remains
        applied = manager.get_applied_migrations()
        assert applied == ["001"]
    
    def test_migration_status(self, temp_db):
        """Test getting migration status"""
        manager = MigrationManager(temp_db)
        
        # Add test migrations
        test_migration = Migration("001", "test", "CREATE TABLE test (id INTEGER);", "DROP TABLE test;")
        manager.migrations = [test_migration]
        
        # Get initial status
        status = manager.get_status()
        
        assert status['total_migrations'] == 1
        assert status['applied_count'] == 0
        assert status['pending_count'] == 1
        assert status['current_version'] is None
        assert status['latest_version'] == "001"
        
        # Apply migration and check status again
        manager._apply_migration(test_migration)
        status = manager.get_status()
        
        assert status['applied_count'] == 1
        assert status['pending_count'] == 0
        assert status['current_version'] == "001"
    
    def test_error_handling_invalid_sql(self, temp_db):
        """Test error handling with invalid SQL"""
        manager = MigrationManager(temp_db)
        
        # Create migration with invalid SQL
        bad_migration = Migration(
            version="999",
            name="bad_migration",
            sql_up="INVALID SQL STATEMENT;",
            sql_down="DROP TABLE nonexistent;",
            description="Bad migration"
        )
        
        # Attempt to apply bad migration
        success = manager._apply_migration(bad_migration)
        assert success is False
        
        # Verify migration was not recorded
        applied = manager.get_applied_migrations()
        assert "999" not in applied
    
    def test_transaction_rollback_on_failure(self, temp_db):
        """Test that failed migrations don't leave partial changes"""
        manager = MigrationManager(temp_db)
        
        # Create migration that starts OK but fails partway
        bad_migration = Migration(
            version="999",
            name="partial_failure",
            sql_up="""
                CREATE TABLE temp_test (id INTEGER);
                INSERT INTO temp_test VALUES (1);
                INVALID SQL HERE;
            """,
            sql_down="DROP TABLE temp_test;",
            description="Partial failure test"
        )
        
        # Apply migration (should fail)
        success = manager._apply_migration(bad_migration)
        assert success is False
        
        # Verify no table was created (transaction rolled back)
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='temp_test'")
            assert cursor.fetchone() is None
    
    def test_create_migration_file(self, temp_db):
        """Test creating new migration files"""
        manager = MigrationManager(temp_db)
        
        # Create migration file
        filepath = manager.create_migration_file("test_feature", "Add test feature")
        
        assert os.path.exists(filepath)
        assert "test_feature" in filepath
        
        # Read and verify content
        with open(filepath, 'r') as f:
            content = f.read()
            assert "test_feature" in content
            assert "Add test feature" in content
            assert "-- Up:" in content
            assert "-- Down:" in content
        
        # Clean up
        os.unlink(filepath)
    
    @patch('migration_manager.logger')
    def test_logging_on_migration_success(self, mock_logger, temp_db):
        """Test that successful migrations are logged"""
        manager = MigrationManager(temp_db)
        
        test_migration = Migration("001", "test", "CREATE TABLE test (id INTEGER);", "DROP TABLE test;")
        manager._apply_migration(test_migration)
        
        # Verify info logging occurred
        assert mock_logger.info.called
    
    @patch('migration_manager.logger')
    def test_logging_on_migration_failure(self, mock_logger, temp_db):
        """Test that failed migrations are logged"""
        manager = MigrationManager(temp_db)
        
        bad_migration = Migration("001", "bad", "INVALID SQL;", "DROP TABLE test;")
        manager._apply_migration(bad_migration)
        
        # Verify error logging occurred
        assert mock_logger.error.called