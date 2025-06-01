"""
Database Migration Manager for Pool Automation System
Handles schema versioning, migrations, and rollbacks safely
"""

import os
import time
import logging
import sqlite3
import hashlib
from typing import List, Dict, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

class Migration:
    """Represents a single database migration"""
    
    def __init__(self, version: str, name: str, sql_up: str, sql_down: str, description: str = ""):
        self.version = version
        self.name = name
        self.sql_up = sql_up
        self.sql_down = sql_down
        self.description = description
        self.checksum = self._calculate_checksum()
    
    def _calculate_checksum(self) -> str:
        """Calculate checksum for migration integrity"""
        content = f"{self.version}{self.name}{self.sql_up}{self.sql_down}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    def __str__(self):
        return f"Migration {self.version}: {self.name}"

class MigrationManager:
    """Manages database schema migrations"""
    
    def __init__(self, db_path: str, migrations_dir: str = None):
        self.db_path = db_path
        self.migrations_dir = migrations_dir or os.path.join(
            os.path.dirname(__file__), 'versions'
        )
        self.migrations: List[Migration] = []
        self._ensure_migrations_table()
    
    def _get_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)
    
    def _ensure_migrations_table(self):
        """Create migrations tracking table if it doesn't exist"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    checksum TEXT NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    execution_time_ms INTEGER
                )
            ''')
            conn.commit()
            logger.info("Migration tracking table ensured")
    
    def _load_migrations_from_files(self):
        """Load migration files from directory"""
        migrations_path = Path(self.migrations_dir)
        if not migrations_path.exists():
            migrations_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created migrations directory: {migrations_path}")
            return
        
        migration_files = sorted(migrations_path.glob("*.sql"))
        
        for file_path in migration_files:
            try:
                content = file_path.read_text()
                
                # Parse migration file format
                # Expected format:
                # -- Migration: version_name
                # -- Description: description text
                # -- Up:
                # SQL statements for upgrade
                # -- Down:
                # SQL statements for downgrade
                
                lines = content.split('\n')
                version_name = None
                description = ""
                up_sql = []
                down_sql = []
                current_section = None
                
                for line in lines:
                    line = line.strip()
                    if line.startswith('-- Migration:'):
                        version_name = line.replace('-- Migration:', '').strip()
                    elif line.startswith('-- Description:'):
                        description = line.replace('-- Description:', '').strip()
                    elif line.startswith('-- Up:'):
                        current_section = 'up'
                    elif line.startswith('-- Down:'):
                        current_section = 'down'
                    elif line and not line.startswith('--'):
                        if current_section == 'up':
                            up_sql.append(line)
                        elif current_section == 'down':
                            down_sql.append(line)
                
                if version_name:
                    version, name = version_name.split('_', 1) if '_' in version_name else (version_name, version_name)
                    migration = Migration(
                        version=version,
                        name=name,
                        sql_up='\n'.join(up_sql),
                        sql_down='\n'.join(down_sql),
                        description=description
                    )
                    self.migrations.append(migration)
                    logger.debug(f"Loaded migration: {migration}")
                
            except Exception as e:
                logger.error(f"Error loading migration file {file_path}: {e}")
        
        # Sort migrations by version
        self.migrations.sort(key=lambda m: m.version)
    
    def _register_hardcoded_migrations(self):
        """Register essential migrations in code"""
        
        # Migration 001: Add foreign key constraints
        migration_001 = Migration(
            version="001",
            name="add_foreign_keys",
            description="Add foreign key constraints for data integrity",
            sql_up='''
                -- Enable foreign keys in SQLite
                PRAGMA foreign_keys = ON;
                
                -- Create new tables with foreign keys
                CREATE TABLE pools_new (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    location TEXT,
                    volume_m3 REAL,
                    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
                );
                
                CREATE TABLE devices_new (
                    device_id TEXT PRIMARY KEY,
                    pool_id TEXT,
                    status TEXT DEFAULT 'inactive',
                    last_seen DATETIME,
                    FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE SET NULL
                );
                
                CREATE TABLE turbidity_readings_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    value REAL,
                    moving_avg REAL,
                    pool_id TEXT,
                    FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE
                );
                
                CREATE TABLE dosing_events_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    event_type TEXT,
                    duration INTEGER,
                    flow_rate REAL,
                    turbidity REAL,
                    pool_id TEXT,
                    FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE
                );
                
                CREATE TABLE steiel_readings_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ph REAL,
                    orp INTEGER,
                    free_cl REAL,
                    comb_cl REAL,
                    pool_id TEXT,
                    FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE
                );
                
                CREATE TABLE system_events_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    event_type TEXT,
                    description TEXT,
                    parameter TEXT,
                    value TEXT,
                    pool_id TEXT,
                    FOREIGN KEY (pool_id) REFERENCES pools (id) ON DELETE CASCADE
                );
                
                -- Copy data from old tables (if they exist)
                INSERT OR IGNORE INTO pools_new SELECT * FROM pools;
                INSERT OR IGNORE INTO devices_new SELECT * FROM devices;
                INSERT OR IGNORE INTO turbidity_readings_new SELECT * FROM turbidity_readings;
                INSERT OR IGNORE INTO dosing_events_new SELECT * FROM dosing_events;
                INSERT OR IGNORE INTO steiel_readings_new SELECT * FROM steiel_readings;
                INSERT OR IGNORE INTO system_events_new SELECT * FROM system_events;
                
                -- Drop old tables
                DROP TABLE IF EXISTS pools;
                DROP TABLE IF EXISTS devices;
                DROP TABLE IF EXISTS turbidity_readings;
                DROP TABLE IF EXISTS dosing_events;
                DROP TABLE IF EXISTS steiel_readings;
                DROP TABLE IF EXISTS system_events;
                
                -- Rename new tables
                ALTER TABLE pools_new RENAME TO pools;
                ALTER TABLE devices_new RENAME TO devices;
                ALTER TABLE turbidity_readings_new RENAME TO turbidity_readings;
                ALTER TABLE dosing_events_new RENAME TO dosing_events;
                ALTER TABLE steiel_readings_new RENAME TO steiel_readings;
                ALTER TABLE system_events_new RENAME TO system_events;
            ''',
            sql_down='''
                -- Remove foreign key constraints (recreate tables without them)
                PRAGMA foreign_keys = OFF;
                
                CREATE TABLE pools_old (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    location TEXT,
                    volume_m3 REAL
                );
                
                CREATE TABLE devices_old (
                    device_id TEXT PRIMARY KEY,
                    pool_id TEXT,
                    status TEXT DEFAULT 'inactive',
                    last_seen DATETIME
                );
                
                CREATE TABLE turbidity_readings_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    value REAL,
                    moving_avg REAL,
                    pool_id TEXT
                );
                
                CREATE TABLE dosing_events_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    event_type TEXT,
                    duration INTEGER,
                    flow_rate REAL,
                    turbidity REAL,
                    pool_id TEXT
                );
                
                CREATE TABLE steiel_readings_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ph REAL,
                    orp INTEGER,
                    free_cl REAL,
                    comb_cl REAL,
                    pool_id TEXT
                );
                
                CREATE TABLE system_events_old (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    event_type TEXT,
                    description TEXT,
                    parameter TEXT,
                    value TEXT,
                    pool_id TEXT
                );
                
                -- Copy data back
                INSERT INTO pools_old SELECT * FROM pools;
                INSERT INTO devices_old SELECT * FROM devices;
                INSERT INTO turbidity_readings_old SELECT * FROM turbidity_readings;
                INSERT INTO dosing_events_old SELECT * FROM dosing_events;
                INSERT INTO steiel_readings_old SELECT * FROM steiel_readings;
                INSERT INTO system_events_old SELECT * FROM system_events;
                
                -- Drop constrained tables
                DROP TABLE pools;
                DROP TABLE devices;
                DROP TABLE turbidity_readings;
                DROP TABLE dosing_events;
                DROP TABLE steiel_readings;
                DROP TABLE system_events;
                
                -- Rename back
                ALTER TABLE pools_old RENAME TO pools;
                ALTER TABLE devices_old RENAME TO devices;
                ALTER TABLE turbidity_readings_old RENAME TO turbidity_readings;
                ALTER TABLE dosing_events_old RENAME TO dosing_events;
                ALTER TABLE steiel_readings_old RENAME TO steiel_readings;
                ALTER TABLE system_events_old RENAME TO system_events;
            '''
        )
        
        # Migration 002: Add user roles and permissions
        migration_002 = Migration(
            version="002",
            name="add_user_roles",
            description="Add role-based access control system",
            sql_up='''
                -- Create roles table
                CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    description TEXT,
                    permissions TEXT, -- JSON array of permissions
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                
                -- Create user_roles junction table
                CREATE TABLE IF NOT EXISTS user_roles (
                    user_id TEXT,
                    role_id INTEGER,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, role_id),
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
                );
                
                -- Insert default roles
                INSERT OR IGNORE INTO roles (name, description, permissions) VALUES 
                ('admin', 'System Administrator', '["all"]'),
                ('operator', 'Pool Operator', '["pool_control", "view_data", "manual_dosing"]'),
                ('viewer', 'Read-only Access', '["view_data"]');
                
                -- Add default admin role to existing users
                INSERT OR IGNORE INTO user_roles (user_id, role_id)
                SELECT u.id, r.id FROM users u, roles r WHERE r.name = 'admin';
            ''',
            sql_down='''
                DROP TABLE IF EXISTS user_roles;
                DROP TABLE IF EXISTS roles;
            '''
        )
        
        # Migration 003: Add session management
        migration_003 = Migration(
            version="003",
            name="add_sessions",
            description="Add secure session management",
            sql_up='''
                CREATE TABLE IF NOT EXISTS user_sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    expires_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
                
                CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
                CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
            ''',
            sql_down='''
                DROP TABLE IF EXISTS user_sessions;
            '''
        )
        
        self.migrations.extend([migration_001, migration_002, migration_003])
    
    def load_migrations(self):
        """Load all migrations from files and hardcoded"""
        self.migrations = []
        self._register_hardcoded_migrations()
        self._load_migrations_from_files()
        logger.info(f"Loaded {len(self.migrations)} migrations")
    
    def get_applied_migrations(self) -> List[str]:
        """Get list of applied migration versions"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT version FROM schema_migrations ORDER BY version")
            return [row[0] for row in cursor.fetchall()]
    
    def get_pending_migrations(self) -> List[Migration]:
        """Get list of migrations that need to be applied"""
        applied = set(self.get_applied_migrations())
        return [m for m in self.migrations if m.version not in applied]
    
    def migrate(self, target_version: Optional[str] = None) -> bool:
        """Apply migrations up to target version (or latest if None)"""
        try:
            self.load_migrations()
            pending = self.get_pending_migrations()
            
            if target_version:
                pending = [m for m in pending if m.version <= target_version]
            
            if not pending:
                logger.info("No pending migrations")
                return True
            
            logger.info(f"Applying {len(pending)} migrations")
            
            for migration in pending:
                if self._apply_migration(migration):
                    logger.info(f"✓ Applied migration {migration}")
                else:
                    logger.error(f"✗ Failed to apply migration {migration}")
                    return False
            
            logger.info("All migrations applied successfully")
            return True
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return False
    
    def _apply_migration(self, migration: Migration) -> bool:
        """Apply a single migration with rollback on failure"""
        start_time = time.time()
        
        with self._get_connection() as conn:
            try:
                # Start transaction
                conn.execute("BEGIN")
                
                # Execute migration SQL
                for statement in migration.sql_up.split(';'):
                    statement = statement.strip()
                    if statement:
                        conn.execute(statement)
                
                # Record migration
                execution_time = int((time.time() - start_time) * 1000)
                conn.execute('''
                    INSERT INTO schema_migrations 
                    (version, name, description, checksum, execution_time_ms)
                    VALUES (?, ?, ?, ?, ?)
                ''', (migration.version, migration.name, migration.description, 
                      migration.checksum, execution_time))
                
                conn.commit()
                return True
                
            except Exception as e:
                conn.rollback()
                logger.error(f"Error applying migration {migration}: {e}")
                return False
    
    def rollback(self, target_version: str) -> bool:
        """Rollback to target version"""
        try:
            applied = self.get_applied_migrations()
            rollback_versions = [v for v in applied if v > target_version]
            rollback_versions.sort(reverse=True)  # Rollback in reverse order
            
            if not rollback_versions:
                logger.info(f"Already at or below version {target_version}")
                return True
            
            logger.info(f"Rolling back {len(rollback_versions)} migrations")
            
            for version in rollback_versions:
                migration = next((m for m in self.migrations if m.version == version), None)
                if migration:
                    if self._rollback_migration(migration):
                        logger.info(f"✓ Rolled back migration {migration}")
                    else:
                        logger.error(f"✗ Failed to rollback migration {migration}")
                        return False
                else:
                    logger.error(f"Migration {version} not found for rollback")
                    return False
            
            logger.info(f"Rollback to version {target_version} completed")
            return True
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False
    
    def _rollback_migration(self, migration: Migration) -> bool:
        """Rollback a single migration"""
        with self._get_connection() as conn:
            try:
                conn.execute("BEGIN")
                
                # Execute rollback SQL
                for statement in migration.sql_down.split(';'):
                    statement = statement.strip()
                    if statement:
                        conn.execute(statement)
                
                # Remove migration record
                conn.execute("DELETE FROM schema_migrations WHERE version = ?", (migration.version,))
                
                conn.commit()
                return True
                
            except Exception as e:
                conn.rollback()
                logger.error(f"Error rolling back migration {migration}: {e}")
                return False
    
    def get_status(self) -> Dict:
        """Get migration status summary"""
        self.load_migrations()
        applied = self.get_applied_migrations()
        pending = self.get_pending_migrations()
        
        return {
            'total_migrations': len(self.migrations),
            'applied_count': len(applied),
            'pending_count': len(pending),
            'current_version': applied[-1] if applied else None,
            'latest_version': self.migrations[-1].version if self.migrations else None,
            'applied_versions': applied,
            'pending_versions': [m.version for m in pending]
        }
    
    def create_migration_file(self, name: str, description: str = "") -> str:
        """Create a new migration file template"""
        timestamp = time.strftime("%Y%m%d%H%M%S")
        version = timestamp
        filename = f"{version}_{name}.sql"
        filepath = os.path.join(self.migrations_dir, filename)
        
        os.makedirs(self.migrations_dir, exist_ok=True)
        
        template = f"""-- Migration: {version}_{name}
-- Description: {description}

-- Up:
-- Add your upgrade SQL here


-- Down:
-- Add your rollback SQL here

"""
        
        with open(filepath, 'w') as f:
            f.write(template)
        
        logger.info(f"Created migration file: {filepath}")
        return filepath