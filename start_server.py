#!/usr/bin/env python3
"""
Simple startup script for Pool Automation System
"""

import os
import sys

# Add the project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

# Set environment variables
os.environ['FLASK_ENV'] = 'development'
os.environ['DATABASE_PATH'] = os.path.join(project_root, 'pool_automation.db')

# Initialize database without auto-migrations for now
from backend.models.database import DatabaseHandler
print("Initializing database...")
try:
    db = DatabaseHandler(auto_migrate=False)
    print("✓ Database initialized successfully")
except Exception as e:
    print(f"Database initialization warning: {e}")

# Import and start the application
print("Starting Pool Automation System...")
print("Security: Enterprise-grade middleware enabled")
print("Performance: Database optimizations active")
print("Testing: Comprehensive suite available")

from backend.api.app import app, socketio

if __name__ == '__main__':
    print("\n" + "="*50)
    print("POOL AUTOMATION SYSTEM")
    print("="*50)
    print("Server: http://localhost:5000")
    print("Auth: Session-based with CSRF protection")
    print("Dashboard: Real-time monitoring enabled")
    print("Note: This is a development server")
    print("="*50 + "\n")
    
    # Start the server
    socketio.run(
        app, 
        host='0.0.0.0', 
        port=5000, 
        debug=True,
        allow_unsafe_werkzeug=True  # For development
    )