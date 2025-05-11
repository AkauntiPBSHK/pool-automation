#!/usr/bin/env python3
# debug_login.py - Script to debug login issues

import os
import sys
import sqlite3
import argparse
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database paths
DB_PATH = os.getenv('DATABASE_PATH', 'pool_automation.db')
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

def check_login(email, password):
    """Check login credentials against database."""
    # Try production path first, then fallback to development
    for path in [PROD_DB_PATH, DB_PATH]:
        if os.path.exists(path):
            print(f"Checking database at: {path}")
            conn = connect_to_db(path)
            if conn:
                try:
                    cursor = conn.cursor()
                    
                    # Check if user exists
                    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
                    user = cursor.fetchone()
                    
                    if not user:
                        print(f"\n❌ User not found: {email}")
                        return False
                    
                    # Display user data
                    print("\n✅ User found:")
                    print(f"  ID: {user['id']}")
                    print(f"  Email: {user['email']}")
                    print(f"  Name: {user.get('name', 'Not set')}")
                    print(f"  Password hash: {user['password_hash']}")
                    
                    # Verify password
                    is_password_correct = check_password_hash(user['password_hash'], password)
                    if is_password_correct:
                        print("\n✅ Password is correct")
                    else:
                        print("\n❌ Password is incorrect")
                        
                        # Create a new hash for comparison
                        print("\nDiagnostic information:")
                        new_hash = generate_password_hash(password)
                        print(f"  Current stored hash: {user['password_hash']}")
                        print(f"  New hash generated: {new_hash}")
                        print(f"  Hash algorithm used: {user['password_hash'].split('$')[0]}")
                        
                    return is_password_correct
                except Exception as e:
                    print(f"Error checking login: {e}")
                finally:
                    conn.close()
        else:
            print(f"Database file not found at: {path}")
    
    print("\n❌ No valid database found")
    return False

def fix_user_password(email, new_password):
    """Update a user's password in the database."""
    # Try production path first, then fallback to development
    for path in [PROD_DB_PATH, DB_PATH]:
        if os.path.exists(path):
            print(f"Updating password in database at: {path}")
            conn = connect_to_db(path)
            if conn:
                try:
                    cursor = conn.cursor()
                    
                    # Check if user exists
                    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                    user = cursor.fetchone()
                    
                    if not user:
                        print(f"\n❌ User not found: {email}")
                        return False
                    
                    # Update password
                    password_hash = generate_password_hash(new_password)
                    cursor.execute(
                        "UPDATE users SET password_hash = ? WHERE email = ?",
                        (password_hash, email)
                    )
                    conn.commit()
                    
                    print(f"\n✅ Password updated for user: {email}")
                    print(f"  New hash: {password_hash}")
                    return True
                except Exception as e:
                    print(f"Error updating password: {e}")
                finally:
                    conn.close()
        else:
            print(f"Database file not found at: {path}")
    
    print("\n❌ No valid database found")
    return False

def main():
    parser = argparse.ArgumentParser(description='Debug login issues with BioPool Dashboard')
    
    # Add subparsers for commands
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Check login command
    check_parser = subparsers.add_parser('check', help='Check login credentials')
    check_parser.add_argument('--email', required=True, help='User email')
    check_parser.add_argument('--password', required=True, help='User password')
    
    # Fix password command
    fix_parser = subparsers.add_parser('fix', help='Fix user password')
    fix_parser.add_argument('--email', required=True, help='User email')
    fix_parser.add_argument('--password', required=True, help='New password')
    
    args = parser.parse_args()
    
    if args.command == 'check':
        check_login(args.email, args.password)
    elif args.command == 'fix':
        fix_user_password(args.email, args.password)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()