"""
Tests for authentication middleware
"""

import pytest
import time
import hmac
import hashlib
from unittest.mock import patch, MagicMock
from flask import Flask, request, session, g

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'utils'))

from auth_middleware import (
    CSRFProtection, SessionValidator, require_auth, require_csrf_protection,
    require_pool_access, validate_request_origin, audit_log
)


class TestCSRFProtection:
    """Test CSRF protection functionality"""
    
    def test_generate_token(self):
        """Test CSRF token generation"""
        session_id = "test-session-123"
        secret_key = "test-secret-key"
        
        token = CSRFProtection.generate_token(session_id, secret_key)
        
        assert token is not None
        assert '.' in token
        assert len(token) > 20  # Should be timestamp.signature format
    
    def test_validate_token_success(self):
        """Test successful CSRF token validation"""
        session_id = "test-session-123"
        secret_key = "test-secret-key"
        
        # Generate token
        token = CSRFProtection.generate_token(session_id, secret_key)
        
        # Validate immediately (should work)
        is_valid = CSRFProtection.validate_token(token, session_id, secret_key)
        assert is_valid is True
    
    def test_validate_token_wrong_session(self):
        """Test CSRF token validation with wrong session ID"""
        session_id = "test-session-123"
        wrong_session_id = "wrong-session-456"
        secret_key = "test-secret-key"
        
        # Generate token for one session
        token = CSRFProtection.generate_token(session_id, secret_key)
        
        # Try to validate with different session ID
        is_valid = CSRFProtection.validate_token(token, wrong_session_id, secret_key)
        assert is_valid is False
    
    def test_validate_token_expired(self):
        """Test CSRF token validation with expired token"""
        session_id = "test-session-123"
        secret_key = "test-secret-key"
        
        # Create token manually with old timestamp
        old_timestamp = str(int(time.time()) - 7200)  # 2 hours ago
        message = f"{session_id}:{old_timestamp}"
        signature = hmac.new(
            secret_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        old_token = f"{old_timestamp}.{signature}"
        
        # Validate with max_age of 1 hour
        is_valid = CSRFProtection.validate_token(old_token, session_id, secret_key, max_age=3600)
        assert is_valid is False
    
    def test_validate_token_invalid_format(self):
        """Test CSRF token validation with invalid format"""
        session_id = "test-session-123"
        secret_key = "test-secret-key"
        
        # Test various invalid formats
        invalid_tokens = [
            "",
            "invalid",
            "no.dots.here.invalid",
            "123.invalid-signature",
            None
        ]
        
        for token in invalid_tokens:
            is_valid = CSRFProtection.validate_token(token, session_id, secret_key)
            assert is_valid is False


class TestSessionValidator:
    """Test session validation functionality"""
    
    def test_validate_session_no_user_id(self):
        """Test session validation without user ID"""
        with patch('auth_middleware.session', {}):
            is_valid = SessionValidator.validate_session()
            assert is_valid is False
    
    def test_validate_session_expired(self):
        """Test session validation with expired session"""
        expired_time = time.time() - 7200  # 2 hours ago
        mock_session = {
            'user_id': 'test-user',
            'last_activity': expired_time
        }
        
        with patch('auth_middleware.session', mock_session), \
             patch('auth_middleware.current_app') as mock_app:
            mock_app.config.get.return_value = 3600  # 1 hour timeout
            
            is_valid = SessionValidator.validate_session()
            assert is_valid is False
    
    def test_validate_session_success(self):
        """Test successful session validation"""
        recent_time = time.time() - 300  # 5 minutes ago
        mock_session = {
            'user_id': 'test-user',
            'last_activity': recent_time
        }
        
        with patch('auth_middleware.session', mock_session), \
             patch('auth_middleware.current_app') as mock_app:
            mock_app.config.get.return_value = 3600  # 1 hour timeout
            
            is_valid = SessionValidator.validate_session()
            assert is_valid is True
            
            # Should update last_activity
            assert mock_session['last_activity'] > recent_time


class TestRequireAuth:
    """Test require_auth decorator"""
    
    def test_require_auth_unauthenticated(self):
        """Test require_auth with unauthenticated user"""
        app = Flask(__name__)
        
        @require_auth
        def protected_view():
            return "Protected content"
        
        with app.test_request_context():
            with patch('auth_middleware.current_user') as mock_user:
                mock_user.is_authenticated = False
                
                response = protected_view()
                
                assert response[1] == 401  # Should return 401 status
                assert 'Authentication required' in response[0].get_json()['error']
    
    def test_require_auth_invalid_session(self):
        """Test require_auth with invalid session"""
        app = Flask(__name__)
        
        @require_auth
        def protected_view():
            return "Protected content"
        
        with app.test_request_context():
            with patch('auth_middleware.current_user') as mock_user, \
                 patch('auth_middleware.SessionValidator.validate_session') as mock_validate:
                mock_user.is_authenticated = True
                mock_user.id = 'test-user'
                mock_validate.return_value = False
                
                response = protected_view()
                
                assert response[1] == 401
                assert 'Session expired' in response[0].get_json()['error']
    
    def test_require_auth_success(self):
        """Test successful authentication"""
        app = Flask(__name__)
        
        @require_auth
        def protected_view():
            return "Protected content"
        
        with app.test_request_context():
            with patch('auth_middleware.current_user') as mock_user, \
                 patch('auth_middleware.SessionValidator.validate_session') as mock_validate, \
                 patch('auth_middleware.g') as mock_g:
                mock_user.is_authenticated = True
                mock_user.id = 'test-user'
                mock_validate.return_value = True
                
                result = protected_view()
                
                assert result == "Protected content"
                assert mock_g.current_user == mock_user
                assert mock_g.user_id == 'test-user'


class TestRequireCSRFProtection:
    """Test CSRF protection decorator"""
    
    def test_csrf_protection_get_request(self):
        """Test that GET requests skip CSRF protection"""
        app = Flask(__name__)
        
        @require_csrf_protection
        def test_view():
            return "Success"
        
        with app.test_request_context(method='GET'):
            result = test_view()
            assert result == "Success"
    
    def test_csrf_protection_missing_token(self):
        """Test CSRF protection with missing token"""
        app = Flask(__name__)
        
        @require_csrf_protection
        def test_view():
            return "Success"
        
        with app.test_request_context(method='POST'):
            with patch('auth_middleware.request') as mock_request:
                mock_request.method = 'POST'
                mock_request.headers.get.return_value = None
                mock_request.form.get.return_value = None
                
                response = test_view()
                
                assert response[1] == 403
                assert 'CSRF token required' in response[0].get_json()['error']
    
    def test_csrf_protection_invalid_token(self):
        """Test CSRF protection with invalid token"""
        app = Flask(__name__)
        
        @require_csrf_protection
        def test_view():
            return "Success"
        
        with app.test_request_context(method='POST'):
            with patch('auth_middleware.request') as mock_request, \
                 patch('auth_middleware.session', {'session_id': 'test-session'}), \
                 patch('auth_middleware.current_app') as mock_app, \
                 patch('auth_middleware.CSRFProtection.validate_token') as mock_validate:
                mock_request.method = 'POST'
                mock_request.headers.get.return_value = 'invalid-token'
                mock_app.config = {'SECRET_KEY': 'test-key'}
                mock_validate.return_value = False
                
                response = test_view()
                
                assert response[1] == 403
                assert 'Invalid CSRF token' in response[0].get_json()['error']
    
    def test_csrf_protection_valid_token(self):
        """Test CSRF protection with valid token"""
        app = Flask(__name__)
        
        @require_csrf_protection
        def test_view():
            return "Success"
        
        with app.test_request_context(method='POST'):
            with patch('auth_middleware.request') as mock_request, \
                 patch('auth_middleware.session', {'session_id': 'test-session'}), \
                 patch('auth_middleware.current_app') as mock_app, \
                 patch('auth_middleware.CSRFProtection.validate_token') as mock_validate:
                mock_request.method = 'POST'
                mock_request.headers.get.return_value = 'valid-token'
                mock_app.config = {'SECRET_KEY': 'test-key'}
                mock_validate.return_value = True
                
                result = test_view()
                assert result == "Success"


class TestRequirePoolAccess:
    """Test pool access validation decorator"""
    
    def test_pool_access_missing_pool_id(self):
        """Test pool access with missing pool ID"""
        app = Flask(__name__)
        
        @require_pool_access
        def test_view():
            return "Success"
        
        with app.test_request_context():
            with patch('auth_middleware.request') as mock_request, \
                 patch('auth_middleware.session', {}):
                mock_request.view_args = {}
                mock_request.is_json = False
                mock_request.form = {}
                
                response = test_view()
                
                assert response[1] == 400
                assert 'Pool ID required' in response[0].get_json()['error']
    
    def test_pool_access_denied(self):
        """Test pool access with access denied"""
        app = Flask(__name__)
        
        @require_pool_access
        def test_view():
            return "Success"
        
        with app.test_request_context():
            with patch('auth_middleware.request') as mock_request, \
                 patch('auth_middleware.session', {'current_pool_id': 'test-pool'}), \
                 patch('auth_middleware.current_user') as mock_user, \
                 patch('auth_middleware.DatabaseHandler') as mock_db_class:
                mock_user.id = 'test-user'
                mock_db = mock_db_class.return_value
                mock_db.validate_pool_access.return_value = False
                
                response = test_view()
                
                assert response[1] == 403
                assert 'Access denied' in response[0].get_json()['error']
    
    def test_pool_access_success(self):
        """Test successful pool access validation"""
        app = Flask(__name__)
        
        @require_pool_access
        def test_view():
            return "Success"
        
        with app.test_request_context():
            with patch('auth_middleware.request') as mock_request, \
                 patch('auth_middleware.session', {'current_pool_id': 'test-pool'}), \
                 patch('auth_middleware.current_user') as mock_user, \
                 patch('auth_middleware.DatabaseHandler') as mock_db_class, \
                 patch('auth_middleware.g') as mock_g:
                mock_user.id = 'test-user'
                mock_db = mock_db_class.return_value
                mock_db.validate_pool_access.return_value = True
                
                result = test_view()
                
                assert result == "Success"
                assert mock_g.pool_id == 'test-pool'


class TestValidateRequestOrigin:
    """Test request origin validation decorator"""
    
    def test_validate_origin_success(self):
        """Test successful origin validation"""
        app = Flask(__name__)
        
        @validate_request_origin
        def test_view():
            return "Success"
        
        with app.test_request_context():
            with patch('auth_middleware.request') as mock_request:
                mock_request.headers.get.side_effect = lambda key, default=None: {
                    'Origin': 'https://example.com',
                    'X-Requested-With': 'XMLHttpRequest'
                }.get(key, default)
                mock_request.host_url = 'https://example.com/'
                mock_request.is_json = True
                
                result = test_view()
                assert result == "Success"
    
    def test_validate_origin_unauthorized_origin(self):
        """Test validation with unauthorized origin"""
        app = Flask(__name__)
        
        @validate_request_origin
        def test_view():
            return "Success"
        
        with app.test_request_context():
            with patch('auth_middleware.request') as mock_request, \
                 patch('auth_middleware.current_app') as mock_app:
                mock_request.headers.get.return_value = 'https://malicious.com'
                mock_request.host_url = 'https://example.com/'
                mock_app.config.get.return_value = ['https://allowed.com']
                
                response = test_view()
                
                assert response[1] == 403
                assert 'Unauthorized origin' in response[0].get_json()['error']
    
    def test_validate_origin_missing_requested_with(self):
        """Test validation with missing X-Requested-With header"""
        app = Flask(__name__)
        
        @validate_request_origin
        def test_view():
            return "Success"
        
        with app.test_request_context():
            with patch('auth_middleware.request') as mock_request:
                mock_request.headers.get.side_effect = lambda key, default=None: {
                    'Origin': 'https://example.com'
                }.get(key, default)
                mock_request.host_url = 'https://example.com/'
                mock_request.is_json = True
                
                response = test_view()
                
                assert response[1] == 400
                assert 'X-Requested-With header required' in response[0].get_json()['error']


class TestAuditLog:
    """Test audit logging decorator"""
    
    def test_audit_log_successful_action(self):
        """Test audit logging for successful actions"""
        app = Flask(__name__)
        
        @audit_log('test_action', {'detail': 'test'})
        def test_view():
            return "Success"
        
        with app.test_request_context():
            with patch('auth_middleware.g') as mock_g, \
                 patch('auth_middleware.request') as mock_request, \
                 patch('auth_middleware.logger') as mock_logger:
                mock_g.user_id = 'test-user'
                mock_g.pool_id = 'test-pool'
                mock_request.headers.get.side_effect = lambda key, default='': {
                    'X-Real-IP': '192.168.1.1',
                    'User-Agent': 'Test Browser'
                }.get(key, default)
                mock_request.endpoint = 'test_endpoint'
                mock_request.method = 'POST'
                mock_request.remote_addr = '192.168.1.1'
                
                result = test_view()
                
                assert result == "Success"
                assert mock_logger.info.called
                
                # Verify log call includes audit data
                call_args = mock_logger.info.call_args
                assert 'test_action' in call_args[0][0]
                assert 'test-user' in call_args[0][0]
    
    def test_audit_log_error_handling(self):
        """Test audit logging error handling"""
        app = Flask(__name__)
        
        @audit_log('test_action')
        def test_view():
            return "Success"
        
        with app.test_request_context():
            with patch('auth_middleware.g') as mock_g, \
                 patch('auth_middleware.request') as mock_request, \
                 patch('auth_middleware.logger') as mock_logger:
                # Simulate error in logging
                mock_g.side_effect = Exception("Logging error")
                mock_request.headers.get.return_value = '192.168.1.1'
                
                # Should not raise exception
                result = test_view()
                assert result == "Success"
                
                # Should log the error
                assert mock_logger.error.called