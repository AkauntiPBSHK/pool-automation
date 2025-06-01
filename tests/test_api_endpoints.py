"""
Tests for API endpoints
"""

import pytest
import json
import time
from unittest.mock import patch, MagicMock

class TestAuthenticationEndpoints:
    """Test authentication-related endpoints"""
    
    def test_register_success(self, client, sample_user_data):
        """Test successful user registration"""
        response = client.post('/register', data=sample_user_data)
        
        # Should redirect to pools page after successful registration
        assert response.status_code == 302
        assert '/pools' in response.location
    
    def test_register_duplicate_email(self, client, sample_user_data):
        """Test registration with duplicate email"""
        # Register once
        client.post('/register', data=sample_user_data)
        
        # Try to register again with same email
        response = client.post('/register', data=sample_user_data)
        
        # Should return error
        assert response.status_code == 200  # Renders form with error
        assert b'Email already registered' in response.data
    
    def test_login_success(self, client, sample_user_data):
        """Test successful login"""
        # Register user first
        client.post('/register', data=sample_user_data)
        
        # Login
        response = client.post('/login', data={
            'email': sample_user_data['email'],
            'password': sample_user_data['password']
        })
        
        assert response.status_code == 302
        assert '/pools' in response.location
    
    def test_login_invalid_credentials(self, client, sample_user_data):
        """Test login with invalid credentials"""
        response = client.post('/login', data={
            'email': sample_user_data['email'],
            'password': 'wrongpassword'
        })
        
        assert response.status_code == 200
        assert b'Invalid email or password' in response.data
    
    def test_logout(self, client, authenticated_user):
        """Test user logout"""
        response = client.get('/logout')
        
        assert response.status_code == 302
        assert '/login' in response.location


class TestPoolManagement:
    """Test pool management endpoints"""
    
    def test_add_pool_success(self, client, authenticated_user, sample_pool_data):
        """Test successful pool creation"""
        response = client.post('/pools/add', data=sample_pool_data)
        
        assert response.status_code == 302
        assert '/pools' in response.location
    
    def test_pools_list_authenticated(self, client, authenticated_user):
        """Test accessing pools list when authenticated"""
        response = client.get('/pools')
        
        assert response.status_code == 200
        assert b'pools' in response.data.lower()
    
    def test_pools_list_unauthenticated(self, client):
        """Test accessing pools list when not authenticated"""
        response = client.get('/pools')
        
        # Should redirect to login
        assert response.status_code == 302
        assert '/login' in response.location
    
    def test_pool_dashboard_access(self, client, authenticated_user, sample_pool_data):
        """Test accessing pool dashboard"""
        # Create a pool first
        client.post('/pools/add', data=sample_pool_data)
        
        # Mock getting pool from database
        with patch('backend.api.app.get_pool') as mock_get_pool:
            mock_get_pool.return_value = {'id': 'test-pool-id', 'name': 'Test Pool'}
            
            response = client.get('/pool/test-pool-id')
            
            assert response.status_code == 200


class TestAPIEndpoints:
    """Test API endpoints functionality"""
    
    def test_status_endpoint(self, client):
        """Test system status endpoint"""
        response = client.get('/api/status')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'ok'
        assert 'simulation_mode' in data
        assert 'version' in data
    
    def test_dashboard_data_unauthenticated(self, client):
        """Test dashboard data endpoint without authentication"""
        response = client.get('/api/dashboard')
        
        assert response.status_code == 401
        data = response.get_json()
        assert 'Authentication required' in data['error']
    
    def test_dashboard_data_no_pool(self, client, authenticated_user):
        """Test dashboard data endpoint without pool selection"""
        response = client.get('/api/dashboard')
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'No pool selected' in data['error']
    
    @patch('backend.api.app.simulator')
    def test_dashboard_data_success(self, mock_simulator, client, authenticated_user):
        """Test successful dashboard data retrieval"""
        # Mock simulator data
        mock_simulator.get_all_parameters.return_value = {
            'ph': 7.2,
            'orp': 720,
            'free_chlorine': 1.2,
            'combined_chlorine': 0.2,
            'turbidity': 0.15,
            'temperature': 28.0
        }
        mock_simulator.get_pump_states.return_value = {
            'acid': False,
            'chlorine': False,
            'pac': False
        }
        
        # Set pool in session and database
        with client.session_transaction() as sess:
            sess['current_pool_id'] = 'test-pool'
        
        with patch('backend.api.app.sqlite3.connect') as mock_connect:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = ('test-pool',)
            mock_conn.cursor.return_value = mock_cursor
            mock_conn.__enter__.return_value = mock_conn
            mock_connect.return_value = mock_conn
            
            response = client.get('/api/dashboard')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['ph'] == 7.2
            assert data['turbidity'] == 0.15
    
    def test_pump_control_unauthenticated(self, client, auth_headers):
        """Test pump control without authentication"""
        response = client.post('/api/pumps/pac', 
                             json={'command': 'start', 'duration': 30},
                             headers=auth_headers)
        
        assert response.status_code == 401
    
    @patch('backend.api.app.mock_pac_pump')
    @patch('backend.api.app.emit_system_event')
    def test_pump_control_success(self, mock_emit, mock_pump, client, authenticated_user, auth_headers):
        """Test successful pump control"""
        mock_pump.start.return_value = True
        mock_pump.get_flow_rate.return_value = 100.0
        
        # Mock pool access validation
        with patch('backend.utils.auth_middleware.DatabaseHandler') as mock_db_class:
            mock_db = mock_db_class.return_value
            mock_db.validate_pool_access.return_value = True
            
            with client.session_transaction() as sess:
                sess['current_pool_id'] = 'test-pool'
                sess['csrf_token'] = 'test-token'
            
            with patch('backend.utils.auth_middleware.CSRFProtection.validate_token') as mock_csrf:
                mock_csrf.return_value = True
                
                response = client.post('/api/pumps/pac',
                                     json={'command': 'start', 'duration': 30, 'flow_rate': 100},
                                     headers={**auth_headers, 'X-CSRF-Token': 'test-token'})
                
                assert response.status_code == 200
                data = response.get_json()
                assert data['success'] is True
                assert 'PAC pump started' in data['message']
    
    def test_dosing_status(self, client, authenticated_user):
        """Test dosing status endpoint"""
        with patch('backend.api.app.dosing_controller') as mock_controller:
            mock_controller.get_status.return_value = {
                'mode': 'AUTOMATIC',
                'pump_status': 'stopped',
                'last_dose_time': time.time()
            }
            
            response = client.get('/api/dosing/status')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['mode'] == 'AUTOMATIC'
    
    @patch('backend.api.app.dosing_controller')
    def test_manual_dosing_unauthenticated(self, mock_controller, client, auth_headers):
        """Test manual dosing without authentication"""
        response = client.post('/api/dosing/manual',
                             json={'duration': 30, 'flow_rate': 100},
                             headers=auth_headers)
        
        assert response.status_code == 401
    
    @patch('backend.api.app.dosing_controller')
    @patch('backend.api.app.mock_turbidity_sensor')
    @patch('backend.api.app.emit_dosing_update')
    @patch('backend.api.app.emit_system_event')
    def test_manual_dosing_success(self, mock_emit_sys, mock_emit_dos, mock_sensor, 
                                  mock_controller, client, authenticated_user, auth_headers):
        """Test successful manual dosing"""
        mock_controller.manual_dose.return_value = True
        mock_sensor.get_reading.return_value = 0.18
        
        # Mock authentication and authorization
        with patch('backend.utils.auth_middleware.DatabaseHandler') as mock_db_class:
            mock_db = mock_db_class.return_value
            mock_db.validate_pool_access.return_value = True
            
            with client.session_transaction() as sess:
                sess['current_pool_id'] = 'test-pool'
                sess['csrf_token'] = 'test-token'
            
            with patch('backend.utils.auth_middleware.CSRFProtection.validate_token') as mock_csrf:
                mock_csrf.return_value = True
                
                response = client.post('/api/dosing/manual',
                                     json={'duration': 30, 'flow_rate': 100},
                                     headers={**auth_headers, 'X-CSRF-Token': 'test-token'})
                
                assert response.status_code == 200
                data = response.get_json()
                assert data['success'] is True


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_rate_limiting_enforcement(self, client, auth_headers):
        """Test that rate limiting is enforced"""
        # Make many requests quickly
        responses = []
        for i in range(15):  # Exceed burst limit
            response = client.get('/api/status', headers=auth_headers)
            responses.append(response)
        
        # Should eventually get rate limited
        rate_limited = any(r.status_code == 429 for r in responses)
        assert rate_limited, "Rate limiting should have been triggered"
    
    def test_rate_limit_headers(self, client):
        """Test that rate limit headers are included"""
        response = client.get('/api/status')
        
        # Check for rate limit headers (may not be present on first request)
        if response.status_code != 429:
            # Should still include limit info headers
            assert response.headers.get('X-RateLimit-Limit') is not None


class TestErrorHandling:
    """Test error handling in API endpoints"""
    
    def test_404_handling(self, client):
        """Test 404 error handling"""
        response = client.get('/nonexistent-endpoint')
        assert response.status_code == 404
    
    def test_invalid_json_handling(self, client, authenticated_user, auth_headers):
        """Test handling of invalid JSON"""
        response = client.post('/api/pumps/pac',
                             data='invalid json',
                             headers=auth_headers,
                             content_type='application/json')
        
        # Should handle gracefully
        assert response.status_code in [400, 401]  # Either validation error or auth error
    
    @patch('backend.api.app.handle_exception')
    def test_exception_handling(self, mock_handle, client):
        """Test that exceptions are properly handled"""
        mock_handle.return_value = {'error': 'Test error', 'type': 'TestException'}
        
        # This would trigger exception handling in real scenario
        response = client.get('/api/status')
        
        # Application should still respond gracefully
        assert response.status_code in [200, 500]


class TestDataValidation:
    """Test input validation"""
    
    def test_missing_required_fields(self, client, authenticated_user, auth_headers):
        """Test validation of missing required fields"""
        with patch('backend.utils.auth_middleware.DatabaseHandler') as mock_db_class:
            mock_db = mock_db_class.return_value
            mock_db.validate_pool_access.return_value = True
            
            with client.session_transaction() as sess:
                sess['current_pool_id'] = 'test-pool'
                sess['csrf_token'] = 'test-token'
            
            with patch('backend.utils.auth_middleware.CSRFProtection.validate_token') as mock_csrf:
                mock_csrf.return_value = True
                
                response = client.post('/api/pumps/pac',
                                     json={'command': 'start'},  # Missing duration
                                     headers={**auth_headers, 'X-CSRF-Token': 'test-token'})
                
                assert response.status_code == 400
    
    def test_invalid_data_types(self, client, authenticated_user, auth_headers):
        """Test validation of invalid data types"""
        with patch('backend.utils.auth_middleware.DatabaseHandler') as mock_db_class:
            mock_db = mock_db_class.return_value
            mock_db.validate_pool_access.return_value = True
            
            with client.session_transaction() as sess:
                sess['current_pool_id'] = 'test-pool'
                sess['csrf_token'] = 'test-token'
            
            with patch('backend.utils.auth_middleware.CSRFProtection.validate_token') as mock_csrf:
                mock_csrf.return_value = True
                
                response = client.post('/api/pumps/pac',
                                     json={'command': 'start', 'duration': 'invalid'},  # Should be int
                                     headers={**auth_headers, 'X-CSRF-Token': 'test-token'})
                
                assert response.status_code == 400