#!/usr/bin/env python3
"""
Universal admin setup script for both SQLite and PostgreSQL
Works in both local development and AWS production environments
"""

import os
import sys
import uuid
from werkzeug.security import generate_password_hash
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def setup_admin_user(email="admin@biopool.design", password="admin123", name="Admin"):
    """Create admin user in the database (works with both SQLite and PostgreSQL)"""
    
    # Import database handler
    from backend.models.database import DatabaseHandler
    
    # Determine environment
    env = os.environ.get('FLASK_ENV', 'development')
    print(f"Environment: {env}")
    
    if env == 'production':
        # Load production environment variables
        from dotenv import load_dotenv
        load_dotenv('.env.production')
        
        # PostgreSQL setup
        db_type = 'postgresql'
        try:
            import psycopg2
            conn = psycopg2.connect(
                user=os.environ.get('DB_USER'),
                password=os.environ.get('DB_PASSWORD'),
                host=os.environ.get('DB_HOST', 'localhost'),
                port=os.environ.get('DB_PORT', '5432'),
                database=os.environ.get('DB_NAME', 'pool_automation_db')
            )
            cursor = conn.cursor()
            print("Connected to PostgreSQL database")
        except Exception as e:
            print(f"Failed to connect to PostgreSQL: {e}")
            return False
    else:
        # SQLite setup
        db_type = 'sqlite'
        import sqlite3
        db_path = os.environ.get('DATABASE_PATH', 'pool_automation.db')
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        print(f"Connected to SQLite database: {db_path}")
    
    try:
        # Create users table if it doesn't exist
        if db_type == 'postgresql':
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT,
                    role TEXT DEFAULT 'customer',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE
                )
            ''')
            
            # Create other necessary tables
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS customers (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id),
                    name TEXT NOT NULL,
                    phone TEXT,
                    address TEXT,
                    pool_install_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pools (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT REFERENCES customers(id),
                    device_serial TEXT,
                    name TEXT,
                    location TEXT,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        else:
            # SQLite versions
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
        
        print("Tables created/verified successfully")
        
        # Check if user exists
        if db_type == 'postgresql':
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        else:
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        
        existing_user = cursor.fetchone()
        
        if existing_user:
            # Update existing user
            password_hash = generate_password_hash(password)
            if db_type == 'postgresql':
                cursor.execute("""
                    UPDATE users 
                    SET password_hash = %s, role = 'admin', name = %s
                    WHERE email = %s
                """, (password_hash, name, email))
            else:
                cursor.execute("""
                    UPDATE users 
                    SET password_hash = ?, role = 'admin', name = ?
                    WHERE email = ?
                """, (password_hash, name, email))
            print(f"Updated existing user: {email}")
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            password_hash = generate_password_hash(password)
            
            if db_type == 'postgresql':
                cursor.execute("""
                    INSERT INTO users (id, email, password_hash, name, role)
                    VALUES (%s, %s, %s, %s, 'admin')
                """, (user_id, email, password_hash, name))
            else:
                cursor.execute("""
                    INSERT INTO users (id, email, password_hash, name, role)
                    VALUES (?, ?, ?, ?, 'admin')
                """, (user_id, email, password_hash, name))
            print(f"Created new admin user: {email}")
        
        conn.commit()
        print(f"\nAdmin user setup complete!")
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"Role: admin")
        
        # List all users
        if db_type == 'postgresql':
            cursor.execute("SELECT email, name, role FROM users ORDER BY created_at")
        else:
            cursor.execute("SELECT email, name, role FROM users ORDER BY created_at")
        
        users = cursor.fetchall()
        print(f"\nAll users in database ({len(users)}):")
        for user in users:
            if db_type == 'postgresql':
                print(f"  - {user[0]} ({user[1]}) - Role: {user[2]}")
            else:
                print(f"  - {user['email']} ({user['name']}) - Role: {user['role']}")
        
        return True
        
    except Exception as e:
        print(f"Error setting up admin user: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    # Allow command line arguments
    if len(sys.argv) > 1:
        email = sys.argv[1]
        password = sys.argv[2] if len(sys.argv) > 2 else "admin123"
        name = sys.argv[3] if len(sys.argv) > 3 else "Admin"
        setup_admin_user(email, password, name)
    else:
        # Default admin user
        setup_admin_user("admin@biopool.design", "admin123", "BioPool Admin")
        
        # Also create a second admin for testing
        setup_admin_user("admin@pool-automation.local", "admin123", "Local Admin")