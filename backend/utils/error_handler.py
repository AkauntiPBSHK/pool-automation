"""
Standardized error handling and logging for Pool Automation System
Provides consistent error responses, logging, and exception management
"""

import logging
import traceback
import time
import uuid
from typing import Dict, Any, Optional, Tuple
from flask import request, jsonify, current_app
from functools import wraps

logger = logging.getLogger(__name__)

class BaseError(Exception):
    """Base exception class for pool automation system"""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        self.timestamp = time.time()
        self.correlation_id = str(uuid.uuid4())[:8]
        super().__init__(message)

class ValidationError(BaseError):
    """Validation error for invalid input data"""
    pass

class AuthenticationError(BaseError):
    """Authentication related errors"""
    pass

class AuthorizationError(BaseError):
    """Authorization/permission related errors"""
    pass

class ResourceNotFoundError(BaseError):
    """Resource not found errors"""
    pass

class ResourceConflictError(BaseError):
    """Resource conflict errors (e.g., duplicate creation)"""
    pass

class ExternalServiceError(BaseError):
    """External service communication errors"""
    pass

class DatabaseError(BaseError):
    """Database operation errors"""
    pass

class BusinessLogicError(BaseError):
    """Business logic validation errors"""
    pass

class RateLimitError(BaseError):
    """Rate limiting errors"""
    pass

class SystemError(BaseError):
    """System-level errors"""
    pass

class ErrorHandler:
    """Centralized error handling and logging"""
    
    # HTTP status codes for different error types
    ERROR_STATUS_CODES = {
        'ValidationError': 400,
        'AuthenticationError': 401,
        'AuthorizationError': 403,
        'ResourceNotFoundError': 404,
        'ResourceConflictError': 409,
        'RateLimitError': 429,
        'BusinessLogicError': 422,
        'ExternalServiceError': 502,
        'DatabaseError': 500,
        'SystemError': 500,
        'BaseError': 500
    }
    
    # Error messages for different error types
    ERROR_MESSAGES = {
        'ValidationError': 'Invalid input data provided',
        'AuthenticationError': 'Authentication required',
        'AuthorizationError': 'Insufficient permissions',
        'ResourceNotFoundError': 'Resource not found',
        'ResourceConflictError': 'Resource already exists',
        'RateLimitError': 'Rate limit exceeded',
        'BusinessLogicError': 'Business rule validation failed',
        'ExternalServiceError': 'External service unavailable',
        'DatabaseError': 'Database operation failed',
        'SystemError': 'Internal system error'
    }
    
    @staticmethod
    def format_error_response(error: Exception, include_details: bool = None) -> Tuple[Dict[str, Any], int]:
        """Format error response for API endpoints"""
        
        # Determine if we should include details based on environment
        if include_details is None:
            include_details = current_app.config.get('DEBUG', False)
        
        # Generate correlation ID for tracking
        correlation_id = getattr(error, 'correlation_id', str(uuid.uuid4())[:8])
        
        if isinstance(error, BaseError):
            # Custom application errors
            error_type = error.__class__.__name__
            status_code = ErrorHandler.ERROR_STATUS_CODES.get(error_type, 500)
            
            response = {
                'error': error.error_code,
                'message': error.message,
                'correlation_id': correlation_id,
                'timestamp': getattr(error, 'timestamp', time.time())
            }
            
            if include_details and error.details:
                response['details'] = error.details
                
        else:
            # Generic Python exceptions
            error_type = error.__class__.__name__
            status_code = 500
            
            # Don't expose internal error details in production
            if include_details:
                message = str(error)
            else:
                message = "An internal error occurred"
            
            response = {
                'error': 'InternalError',
                'message': message,
                'correlation_id': correlation_id,
                'timestamp': time.time()
            }
        
        # Add request context if available
        if request:
            response['request_id'] = getattr(request, 'id', correlation_id)
            if include_details:
                response['endpoint'] = request.endpoint
                response['method'] = request.method
        
        return response, status_code
    
    @staticmethod
    def log_error(error: Exception, context: Dict[str, Any] = None, level: str = 'error'):
        """Log error with context and correlation ID"""
        
        correlation_id = getattr(error, 'correlation_id', str(uuid.uuid4())[:8])
        
        # Build log context
        log_context = {
            'correlation_id': correlation_id,
            'error_type': error.__class__.__name__,
            'error_message': str(error)
        }
        
        # Add request context if available
        if request:
            log_context.update({
                'endpoint': request.endpoint,
                'method': request.method,
                'url': request.url,
                'remote_addr': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', 'Unknown')
            })
        
        # Add custom context
        if context:
            log_context.update(context)
        
        # Add error details for custom errors
        if isinstance(error, BaseError) and error.details:
            log_context['error_details'] = error.details
        
        # Log with appropriate level
        log_message = f"Error [{correlation_id}]: {str(error)}"
        
        if level == 'warning':
            logger.warning(log_message, extra=log_context)
        elif level == 'critical':
            logger.critical(log_message, extra=log_context)
        else:
            logger.error(log_message, extra=log_context)
        
        # Log stack trace for debugging
        if current_app.config.get('DEBUG') or level == 'critical':
            logger.debug(f"Stack trace [{correlation_id}]:\n{traceback.format_exc()}")

def handle_exceptions(include_details: bool = None, log_level: str = 'error'):
    """Decorator for consistent exception handling in API endpoints"""
    
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                return f(*args, **kwargs)
                
            except BaseError as e:
                # Application-specific errors
                ErrorHandler.log_error(e, level=log_level)
                response, status_code = ErrorHandler.format_error_response(e, include_details)
                return jsonify(response), status_code
                
            except Exception as e:
                # Generic Python exceptions
                ErrorHandler.log_error(e, level='critical')
                response, status_code = ErrorHandler.format_error_response(e, include_details)
                return jsonify(response), status_code
                
        return decorated_function
    return decorator

def raise_validation_error(message: str, field: str = None, details: Dict[str, Any] = None):
    """Helper function to raise validation errors"""
    error_details = details or {}
    if field:
        error_details['field'] = field
    
    raise ValidationError(message, 'ValidationError', error_details)

def raise_not_found_error(resource_type: str, resource_id: str = None):
    """Helper function to raise not found errors"""
    message = f"{resource_type} not found"
    if resource_id:
        message += f": {resource_id}"
    
    details = {'resource_type': resource_type}
    if resource_id:
        details['resource_id'] = resource_id
    
    raise ResourceNotFoundError(message, 'ResourceNotFound', details)

def raise_conflict_error(resource_type: str, field: str = None, value: str = None):
    """Helper function to raise conflict errors"""
    message = f"{resource_type} already exists"
    if field and value:
        message += f" with {field}: {value}"
    
    details = {'resource_type': resource_type}
    if field:
        details['conflict_field'] = field
    if value:
        details['conflict_value'] = value
    
    raise ResourceConflictError(message, 'ResourceConflict', details)

def raise_auth_error(message: str = "Authentication required"):
    """Helper function to raise authentication errors"""
    raise AuthenticationError(message, 'AuthenticationRequired')

def raise_permission_error(resource: str = None, action: str = None):
    """Helper function to raise permission errors"""
    message = "Insufficient permissions"
    if resource and action:
        message += f" to {action} {resource}"
    
    details = {}
    if resource:
        details['resource'] = resource
    if action:
        details['action'] = action
    
    raise AuthorizationError(message, 'InsufficientPermissions', details)

def raise_business_logic_error(rule: str, message: str, details: Dict[str, Any] = None):
    """Helper function to raise business logic errors"""
    error_details = details or {}
    error_details['business_rule'] = rule
    
    raise BusinessLogicError(message, 'BusinessRuleViolation', error_details)

def init_error_handling(app):
    """Initialize error handling for Flask app"""
    
    @app.before_request
    def add_request_id():
        """Add unique request ID for tracking"""
        request.id = str(uuid.uuid4())[:8]
    
    @app.errorhandler(404)
    def not_found_error(error):
        """Handle 404 errors"""
        response = {
            'error': 'NotFound',
            'message': 'The requested resource was not found',
            'correlation_id': getattr(request, 'id', str(uuid.uuid4())[:8]),
            'timestamp': time.time()
        }
        return jsonify(response), 404
    
    @app.errorhandler(405)
    def method_not_allowed_error(error):
        """Handle 405 errors"""
        response = {
            'error': 'MethodNotAllowed',
            'message': 'The requested method is not allowed for this endpoint',
            'correlation_id': getattr(request, 'id', str(uuid.uuid4())[:8]),
            'timestamp': time.time()
        }
        return jsonify(response), 405
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 errors"""
        correlation_id = getattr(request, 'id', str(uuid.uuid4())[:8])
        
        logger.error(f"Internal server error [{correlation_id}]: {str(error)}")
        
        response = {
            'error': 'InternalServerError',
            'message': 'An internal server error occurred',
            'correlation_id': correlation_id,
            'timestamp': time.time()
        }
        
        if app.config.get('DEBUG'):
            response['details'] = str(error)
        
        return jsonify(response), 500
    
    @app.after_request
    def log_request(response):
        """Log request details for monitoring"""
        if app.config.get('LOG_REQUESTS', False):
            logger.info(
                f"Request [{getattr(request, 'id', 'unknown')}]: "
                f"{request.method} {request.url} -> {response.status_code}"
            )
        return response
    
    logger.info("Error handling initialized")

# Structured logging formatter
class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record):
        """Format log record as JSON"""
        import json
        
        log_data = {
            'timestamp': time.time(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'line': record.lineno
        }
        
        # Add extra fields from log context
        if hasattr(record, 'correlation_id'):
            log_data['correlation_id'] = record.correlation_id
        
        if hasattr(record, 'endpoint'):
            log_data['endpoint'] = record.endpoint
        
        if hasattr(record, 'method'):
            log_data['method'] = record.method
        
        if hasattr(record, 'error_type'):
            log_data['error_type'] = record.error_type
        
        if hasattr(record, 'error_details'):
            log_data['error_details'] = record.error_details
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)

def setup_structured_logging(app):
    """Setup structured JSON logging"""
    
    if app.config.get('STRUCTURED_LOGGING', False):
        # Configure root logger
        root_logger = logging.getLogger()
        
        # Remove existing handlers
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # Add structured handler
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredFormatter())
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)
        
        logger.info("Structured logging enabled")

# Context manager for error handling
class ErrorContext:
    """Context manager for handling errors in specific operations"""
    
    def __init__(self, operation: str, context: Dict[str, Any] = None):
        self.operation = operation
        self.context = context or {}
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_val:
            # Add operation context to error
            if isinstance(exc_val, BaseError):
                exc_val.details.update(self.context)
                exc_val.details['operation'] = self.operation
            
            # Log error with context
            ErrorHandler.log_error(exc_val, {'operation': self.operation, **self.context})
        
        return False  # Don't suppress the exception