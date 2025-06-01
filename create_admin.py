#!/usr/bin/env python3
"""
Simple script to create an admin user for the Pool Automation System
"""

import sqlite3
import sys
import os
from werkzeug.security import generate_password_hash
import uuid

# Add the project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

def create_admin_user():
    """Create a default admin user."""
    
    # Default admin credentials
    admin_email = "admin@pool-automation.local"
    admin_password = "admin123"  # Simple default password
    admin_name = "Pool Administrator"
    
    try:
        with sqlite3.connect('pool_automation.db') as conn:
            cursor = conn.cursor()
            
            # Check if admin already exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (admin_email,))
            existing_admin = cursor.fetchone()
            
            if existing_admin:
                print(f"Admin user already exists: {admin_email}")
                print(f"Password: {admin_password}")
                return
            
            # Create new admin user
            user_id = str(uuid.uuid4())
            password_hash = generate_password_hash(admin_password)
            
            cursor.execute(
                "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
                (user_id, admin_email, password_hash, admin_name)
            )
            conn.commit()
            
            print("Admin user created successfully!")
            print(f"Email: {admin_email}")
            print(f"Password: {admin_password}")
            print(f"Login at: http://localhost:5000/login")
            
    except Exception as e:
        print(f"Error creating admin user: {e}")

if __name__ == "__main__":
    create_admin_user()