#!/usr/bin/env python3
# admin_tools.py - Admin tools for BioPool Dashboard

import os
import sys
import sqlite3
import argparse
import uuid
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database paths
DEV_DB_PATH = os.getenv('DATABASE_PATH', 'pool_automation.db')
PROD_DB_PATH = os.getenv('DATABASE_PATH', '/var/www/pool-automation/pool_automation.db')

def connect_to_db(db_path):
    """Connect to the database and return connection."""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"Error connecting to database at {db_path}: {e}")
        return None

def update_database_schema():
    """Update database schema to add role column to users table."""
    db_path = PROD_DB_PATH if os.getenv('FLASK_ENV') == 'production' else DEV_DB_PATH
    conn = connect_to_db(db_path)
    
    if not conn:
        print("Failed to connect to database")
        return False
    
    try:
        cursor = conn.cursor()
        
        # Check if role column exists in users table
        cursor.execute("PRAGMA table_info(users)")
        columns = [col['name'] for col in cursor.fetchall()]
        
        if 'role' not in columns:
            print("Adding 'role' column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'")
            conn.commit()
            print("✅ Column added successfully")
        else:
            print("✅ Role column already exists")
        
        return True
    except Exception as e:
        print(f"Error updating database schema: {e}")
        return False
    finally:
        conn.close()

def create_admin_user(email, password, name=None):
    """Create an admin user or update existing user to admin role."""
    db_path = PROD_DB_PATH if os.getenv('FLASK_ENV') == 'production' else DEV_DB_PATH
    conn = connect_to_db(db_path)
    
    if not conn:
        print("Failed to connect to database")
        return False
    
    try:
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT id, email FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if user:
            # Update existing user to admin
            cursor.execute(
                "UPDATE users SET role = 'admin' WHERE id = ?",
                (user['id'],)
            )
            
            # Update password if provided
            if password:
                password_hash = generate_password_hash(password)
                cursor.execute(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    (password_hash, user['id'])
                )
            
            conn.commit()
            print(f"✅ User {email} updated to admin role")
        else:
            # Create new admin user
            user_id = str(uuid.uuid4())
            password_hash = generate_password_hash(password)
            
            cursor.execute(
                "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
                (user_id, email, password_hash, name or email.split('@')[0], 'admin')
            )
            conn.commit()
            print(f"✅ Admin user {email} created successfully")
        
        return True
    except Exception as e:
        print(f"Error creating admin user: {e}")
        return False
    finally:
        conn.close()

def list_users():
    """List all users in the database."""
    db_path = PROD_DB_PATH if os.getenv('FLASK_ENV') == 'production' else DEV_DB_PATH
    conn = connect_to_db(db_path)
    
    if not conn:
        print("Failed to connect to database")
        return False
    
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, name, role FROM users")
        users = cursor.fetchall()
        
        if not users:
            print("No users found in the database")
            return
        
        print("\nUsers in the database:")
        print("=" * 80)
        print(f"{'Email':<30} | {'Name':<20} | {'Role':<10} | {'ID':<36}")
        print("-" * 80)
        
        for user in users:
            print(f"{user['email']:<30} | {user.get('name', 'N/A'):<20} | {user.get('role', 'customer'):<10} | {user['id']}")
        
        print("=" * 80)
        
        return True
    except Exception as e:
        print(f"Error listing users: {e}")
        return False
    finally:
        conn.close()

def show_statistics():
    """Show database statistics."""
    db_path = PROD_DB_PATH if os.getenv('FLASK_ENV') == 'production' else DEV_DB_PATH
    conn = connect_to_db(db_path)
    
    if not conn:
        print("Failed to connect to database")
        return False
    
    try:
        cursor = conn.cursor()
        
        # Get table counts
        tables = {
            'Users': 'users',
            'Pools': 'pools',
            'Devices': 'devices',
            'Turbidity Readings': 'turbidity_readings',
            'Dosing Events': 'dosing_events',
            'Steiel Readings': 'steiel_readings'
        }
        
        print("\nBioPool Dashboard Database Statistics")
        print("=" * 50)
        print(f"Database Location: {db_path}")
        print("-" * 50)
        
        for label, table in tables.items():
            try:
                cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
                count = cursor.fetchone()['count']
                print(f"{label}: {count:,}")
            except sqlite3.OperationalError:
                print(f"{label}: Table not found")
        
        # Get user breakdown by role
        try:
            cursor.execute("SELECT role, COUNT(*) as count FROM users GROUP BY role")
            roles = cursor.fetchall()
            
            print("\nUser Roles:")
            for role in roles:
                role_name = role['role'] or 'customer'  # Default to customer if role is NULL
                print(f"  {role_name}: {role['count']}")
        except sqlite3.OperationalError:
            print("User Roles: Role column not found")
        
        print("=" * 50)
        
        return True
    except Exception as e:
        print(f"Error showing statistics: {e}")
        return False
    finally:
        conn.close()

def main():
    parser = argparse.ArgumentParser(description='Admin tools for BioPool Dashboard')
    
    # Add subparsers for different commands
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Update database schema
    subparsers.add_parser('update-schema', help='Update database schema')
    
    # Create admin user
    admin_parser = subparsers.add_parser('create-admin', help='Create or update admin user')
    admin_parser.add_argument('--email', required=True, help='Admin email address')
    admin_parser.add_argument('--password', required=True, help='Admin password')
    admin_parser.add_argument('--name', help='Admin name (optional)')
    
    # List users
    subparsers.add_parser('list-users', help='List all users')
    
    # Show statistics
    subparsers.add_parser('stats', help='Show database statistics')
    
    args = parser.parse_args()
    
    # Print environment info
    print(f"Environment: {os.getenv('FLASK_ENV', 'development')}")
    
    if args.command == 'update-schema':
        update_database_schema()
    elif args.command == 'create-admin':
        update_database_schema()  # First ensure schema is updated
        create_admin_user(args.email, args.password, args.name)
    elif args.command == 'list-users':
        list_users()
    elif args.command == 'stats':
        show_statistics()
    else:
        parser.print_help()

if __name__ == '__main__':
    main()