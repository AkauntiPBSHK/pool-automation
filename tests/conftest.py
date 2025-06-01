"""
Test configuration and fixtures for Pool Automation System
"""

import os
import tempfile
import pytest
import sqlite3
from unittest.mock import patch
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

@pytest.fixture
def temp_db():
    """Create a temporary database for testing"""
    db_fd, db_path = tempfile.mkstemp()
    yield db_path
    os.close(db_fd)
    os.unlink(db_path)

@pytest.fixture
def db_connection(temp_db):
    """Create a database connection for testing"""
    conn = sqlite3.connect(temp_db)
    yield conn
    conn.close()

@pytest.fixture
def test_config():
    """Test configuration"""
    return {
        'TESTING': True,
        'DATABASE_PATH': ':memory:',
        'SECRET_KEY': 'test-secret-key',
        'WTF_CSRF_ENABLED': False,
        'SIMULATION_MODE': True
    }

@pytest.fixture
def app(test_config, temp_db):
    """Create a test Flask application"""
    # Mock the config to use test database
    with patch.dict(os.environ, {'DATABASE_PATH': temp_db}):
        from api.app import app as flask_app
        flask_app.config.update(test_config)
        flask_app.config['DATABASE_PATH'] = temp_db
        
        with flask_app.test_client() as client:
            with flask_app.app_context():
                yield flask_app

@pytest.fixture
def client(app):
    """Create a test client"""
    return app.test_client()

@pytest.fixture
def runner(app):
    """Create a test CLI runner"""
    return app.test_cli_runner()

@pytest.fixture
def auth_headers():
    """Common authentication headers for testing"""
    return {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    }

@pytest.fixture
def sample_user_data():
    """Sample user data for testing"""
    return {
        'email': 'test@example.com',
        'password': 'securepassword123',
        'name': 'Test User'
    }

@pytest.fixture
def sample_pool_data():
    """Sample pool data for testing"""
    return {
        'name': 'Test Pool',
        'location': 'Test Location',
        'volume': 50.0,
        'device_id': 'test-device-001'
    }

@pytest.fixture
def authenticated_user(client, sample_user_data):
    """Create and authenticate a test user"""
    # Register user
    client.post('/register', data=sample_user_data)
    
    # Login user
    response = client.post('/login', data={
        'email': sample_user_data['email'],
        'password': sample_user_data['password']
    })
    
    return sample_user_data

class TestDataFactory:
    """Factory for creating test data"""
    
    @staticmethod
    def create_sensor_reading(timestamp=None, **kwargs):
        """Create a sensor reading"""
        import time
        default_data = {
            'timestamp': timestamp or time.time(),
            'ph': 7.2,
            'orp': 720,
            'free_chlorine': 1.2,
            'combined_chlorine': 0.2,
            'turbidity': 0.15,
            'temperature': 28.0,
            'pool_id': 'test-pool-001'
        }
        default_data.update(kwargs)
        return default_data
    
    @staticmethod
    def create_dosing_event(**kwargs):
        """Create a dosing event"""
        import time
        default_data = {
            'timestamp': time.time(),
            'event_type': 'PAC',
            'duration': 30,
            'flow_rate': 100.0,
            'turbidity': 0.20,
            'pool_id': 'test-pool-001'
        }
        default_data.update(kwargs)
        return default_data

@pytest.fixture
def test_data_factory():
    """Test data factory fixture"""
    return TestDataFactory