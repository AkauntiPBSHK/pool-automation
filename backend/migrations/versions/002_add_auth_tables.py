"""Add authentication and customer management tables

This migration adds:
- users table with role field
- customers table for customer management
- pools table for pool assignments
- Updates existing tables as needed
"""

def upgrade(db):
    """Apply migration"""
    cursor = db.cursor()
    
    # Create users table with role field
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'customer',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            is_active INTEGER DEFAULT 1
        )
    ''')
    
    # Create customers table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            pool_install_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Create pools table (update existing if needed)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pools (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            device_serial TEXT,
            name TEXT,
            location TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    ''')
    
    # Create devices table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            serial_number TEXT UNIQUE NOT NULL,
            pool_id TEXT,
            status TEXT DEFAULT 'inactive',
            last_seen DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pool_id) REFERENCES pools(id)
        )
    ''')
    
    # Add indexes for performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_pools_customer_id ON pools(customer_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_devices_pool_id ON devices(pool_id)')
    
    # Check if role column exists in users table, if not add it
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'role' not in columns:
        cursor.execute('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "customer"')
    
    # Update existing users to have admin role if they exist
    cursor.execute('''
        UPDATE users 
        SET role = 'admin' 
        WHERE email IN ('admin@biopool.design', 'admin@pool-automation.local')
    ''')
    
    db.commit()

def downgrade(db):
    """Rollback migration"""
    cursor = db.cursor()
    
    # Drop tables in reverse order due to foreign key constraints
    cursor.execute('DROP TABLE IF EXISTS devices')
    cursor.execute('DROP TABLE IF EXISTS pools')
    cursor.execute('DROP TABLE IF EXISTS customers')
    
    # Don't drop users table as it may contain data
    # Just remove the role column if possible (SQLite doesn't support DROP COLUMN easily)
    
    db.commit()

# Migration metadata
version = '002'
description = 'Add authentication and customer management tables'