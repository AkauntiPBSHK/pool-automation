"""
Authentication and authorization middleware for Pool Automation API
Provides session validation, CSRF protection, and user context management
"""

import functools
import hashlib
import hmac
import secrets
import time
from typing import Optional, Dict, Any
from flask import request, jsonify, session, g, current_app
from flask_login import current_user
import logging

logger = logging.getLogger(__name__)

class CSRFProtection:
    """CSRF token generation and validation"""
    
    @staticmethod
    def generate_token(session_id: str, secret_key: str) -> str:
        """Generate CSRF token for the current session"""
        timestamp = str(int(time.time()))
        message = f"{session_id}:{timestamp}"
        signature = hmac.new(
            secret_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"{timestamp}.{signature}"
    
    @staticmethod
    def validate_token(token: str, session_id: str, secret_key: str, max_age: int = 3600) -> bool:
        """Validate CSRF token"""
        try:
            if not token or '.' not in token:
                return False
            
            timestamp_str, signature = token.split('.', 1)
            timestamp = int(timestamp_str)
            
            # Check token age
            if time.time() - timestamp > max_age:
                logger.debug("CSRF token expired")
                return False
            
            # Verify signature
            message = f"{session_id}:{timestamp_str}"
            expected_signature = hmac.new(
                secret_key.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                logger.debug("CSRF token signature mismatch")
                return False
            
            return True
            
        except (ValueError, TypeError) as e:
            logger.debug(f"CSRF token validation error: {e}")
            return False

class SessionValidator:
    """Session validation and management"""
    
    @staticmethod
    def validate_session() -> bool:
        """Validate current session"""
        if not session.get('user_id'):
            return False
        
        # Check session timeout
        last_activity = session.get('last_activity')
        if last_activity:
            timeout = current_app.config.get('SESSION_TIMEOUT', 3600)
            if time.time() - last_activity > timeout:
                logger.info(f"Session timeout for user {session.get('user_id')}")
                return False
        
        # Update last activity
        session['last_activity'] = time.time()
        session.permanent = True
        
        return True
    
    @staticmethod
    def refresh_session():
        """Refresh session data"""
        if current_user.is_authenticated:
            session['user_id'] = current_user.id
            session['last_activity'] = time.time()
            
            # Generate new CSRF token
            csrf_token = CSRFProtection.generate_token(
                session.get('session_id', ''),
                current_app.config['SECRET_KEY']
            )
            session['csrf_token'] = csrf_token

def require_auth(f):
    """Decorator to require authentication for API endpoints"""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is authenticated
        if not current_user.is_authenticated:
            logger.warning(f"Unauthenticated access attempt to {request.endpoint}")
            return jsonify({
                'error': 'Authentication required',
                'message': 'Please log in to access this resource'
            }), 401
        
        # Validate session
        if not SessionValidator.validate_session():
            logger.warning(f"Invalid session for user {current_user.id}")
            return jsonify({
                'error': 'Session expired',
                'message': 'Your session has expired. Please log in again.'
            }), 401
        
        # Set user context
        g.current_user = current_user
        g.user_id = current_user.id
        
        return f(*args, **kwargs)
    
    return decorated_function

def require_csrf_protection(f):
    """Decorator to require CSRF protection for state-changing operations"""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip CSRF for GET requests
        if request.method == 'GET':
            return f(*args, **kwargs)
        
        # Check CSRF token
        csrf_token = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token')
        
        if not csrf_token:
            logger.warning(f"Missing CSRF token for {request.endpoint}")
            return jsonify({
                'error': 'CSRF token required',
                'message': 'CSRF token is required for this operation'
            }), 403
        
        session_id = session.get('session_id', '')
        if not CSRFProtection.validate_token(csrf_token, session_id, current_app.config['SECRET_KEY']):
            logger.warning(f"Invalid CSRF token for {request.endpoint}")
            return jsonify({
                'error': 'Invalid CSRF token',
                'message': 'CSRF token is invalid or expired'
            }), 403
        
        return f(*args, **kwargs)
    
    return decorated_function

def require_pool_access(f):
    """Decorator to ensure user has access to the requested pool"""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        from backend.models.database import DatabaseHandler
        
        # Get pool_id from various sources
        pool_id = (
            kwargs.get('pool_id') or 
            request.view_args.get('pool_id') or
            request.json.get('pool_id') if request.is_json else None or
            request.form.get('pool_id') or
            session.get('current_pool_id')
        )
        
        if not pool_id:
            return jsonify({
                'error': 'Pool ID required',
                'message': 'Pool ID must be specified'
            }), 400
        
        # Validate pool access
        db = DatabaseHandler()
        if not db.validate_pool_access(current_user.id, pool_id):
            logger.warning(f"User {current_user.id} attempted to access unauthorized pool {pool_id}")
            return jsonify({
                'error': 'Access denied',
                'message': 'You do not have access to this pool'
            }), 403
        
        # Set pool context
        g.pool_id = pool_id
        
        return f(*args, **kwargs)
    
    return decorated_function

def validate_request_origin(f):
    """Decorator to validate request origin for additional security"""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # Check Origin header for AJAX requests
        origin = request.headers.get('Origin')
        referer = request.headers.get('Referer')
        
        # Allow same-origin requests
        if origin:
            allowed_origins = current_app.config.get('ALLOWED_ORIGINS', [])
            if origin not in allowed_origins and not origin.startswith(request.host_url.rstrip('/')):
                logger.warning(f"Request from unauthorized origin: {origin}")
                return jsonify({
                    'error': 'Unauthorized origin',
                    'message': 'Request origin not allowed'
                }), 403
        
        # Validate X-Requested-With header for AJAX requests
        if request.is_json and not request.headers.get('X-Requested-With'):
            logger.warning(f"Missing X-Requested-With header for JSON request to {request.endpoint}")
            return jsonify({
                'error': 'Invalid request',
                'message': 'X-Requested-With header required for AJAX requests'
            }), 400
        
        return f(*args, **kwargs)
    
    return decorated_function

def audit_log(action: str, details: Optional[Dict[str, Any]] = None):
    """Decorator to log security-relevant actions"""
    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            # Execute the function first
            result = f(*args, **kwargs)
            
            # Log the action
            try:
                user_id = getattr(g, 'user_id', 'anonymous')
                pool_id = getattr(g, 'pool_id', None)
                client_ip = request.headers.get('X-Real-IP') or request.remote_addr
                
                audit_data = {
                    'action': action,
                    'user_id': user_id,
                    'pool_id': pool_id,
                    'client_ip': client_ip,
                    'endpoint': request.endpoint,
                    'method': request.method,
                    'timestamp': time.time(),
                    'user_agent': request.headers.get('User-Agent', '')[:200]  # Limit length
                }
                
                if details:
                    audit_data.update(details)
                
                # Log successful actions
                if hasattr(result, 'status_code') and result.status_code < 400:
                    logger.info(f"Audit: {action} by user {user_id}", extra=audit_data)
                elif not hasattr(result, 'status_code'):
                    # Non-HTTP response (probably successful)
                    logger.info(f"Audit: {action} by user {user_id}", extra=audit_data)
                
            except Exception as e:
                logger.error(f"Audit logging error: {e}")
            
            return result
        
        return decorated_function
    return decorator

def init_auth_middleware(app):
    """Initialize authentication middleware for the Flask app"""
    
    @app.before_request
    def before_request():
        """Set up request context and security headers"""
        # Generate session ID if not exists
        if 'session_id' not in session:
            session['session_id'] = secrets.token_urlsafe(32)
        
        # Refresh session for authenticated users
        if current_user.is_authenticated:
            SessionValidator.refresh_session()
        
        # Set security headers
        g.start_time = time.time()
    
    @app.after_request
    def after_request(response):
        """Add security headers to all responses"""
        # Security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Add CSRF token to HTML responses
        if (response.content_type and 'text/html' in response.content_type and 
            current_user.is_authenticated):
            csrf_token = session.get('csrf_token')
            if csrf_token:
                response.headers['X-CSRF-Token'] = csrf_token
        
        # Add request timing for debugging (development only)
        if app.config.get('DEBUG'):
            request_time = time.time() - getattr(g, 'start_time', time.time())
            response.headers['X-Request-Time'] = f"{request_time:.3f}s"
        
        return response
    
    # Add CSRF token endpoint
    @app.route('/api/csrf-token')
    @require_auth
    def get_csrf_token():
        """Get CSRF token for authenticated users"""
        csrf_token = session.get('csrf_token')
        if not csrf_token:
            csrf_token = CSRFProtection.generate_token(
                session.get('session_id', ''),
                current_app.config['SECRET_KEY']
            )
            session['csrf_token'] = csrf_token
        
        return jsonify({'csrf_token': csrf_token})
    
    logger.info("Authentication middleware initialized")

# Convenience decorators combining multiple security measures
def secure_api_endpoint(require_pool: bool = False, audit_action: Optional[str] = None):
    """Decorator combining common security requirements for API endpoints"""
    def decorator(f):
        decorators = [
            require_auth,
            validate_request_origin,
            require_csrf_protection
        ]
        
        if require_pool:
            decorators.append(require_pool_access)
        
        if audit_action:
            decorators.append(audit_log(audit_action))
        
        # Apply decorators in reverse order
        for dec in reversed(decorators):
            f = dec(f)
        
        return f
    return decorator