"""
Input validation utilities for Pool Automation API endpoints
Provides secure validation and sanitization of user inputs
"""

import re
import json
from typing import Any, Dict, List, Optional, Union, Tuple
from functools import wraps
from flask import request, jsonify
import logging

logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Custom exception for validation errors"""
    def __init__(self, message: str, field: str = None):
        self.message = message
        self.field = field
        super().__init__(message)

class Validator:
    """Input validation and sanitization utilities"""
    
    # Regex patterns for common validations
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    NUMERIC_PATTERN = re.compile(r'^-?\d+\.?\d*$')
    ALPHANUMERIC_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')
    
    @staticmethod
    def validate_email(email: str) -> str:
        """Validate and sanitize email address"""
        if not email or not isinstance(email, str):
            raise ValidationError("Email is required")
        
        email = email.strip().lower()
        if len(email) > 254:  # RFC 5321 limit
            raise ValidationError("Email address too long")
            
        if not Validator.EMAIL_PATTERN.match(email):
            raise ValidationError("Invalid email format")
            
        return email
    
    @staticmethod
    def validate_number(value: Any, min_val: float = None, max_val: float = None, 
                       allow_null: bool = False) -> Optional[float]:
        """Validate numeric value with optional range checking"""
        if value is None or value == '':
            if allow_null:
                return None
            raise ValidationError("Value is required")
        
        try:
            if isinstance(value, str):
                value = float(value)
            elif not isinstance(value, (int, float)):
                raise ValueError("Invalid type")
        except (ValueError, TypeError):
            raise ValidationError("Must be a valid number")
        
        if min_val is not None and value < min_val:
            raise ValidationError(f"Must be at least {min_val}")
            
        if max_val is not None and value > max_val:
            raise ValidationError(f"Must be at most {max_val}")
            
        return float(value)
    
    @staticmethod
    def validate_integer(value: Any, min_val: int = None, max_val: int = None,
                        allow_null: bool = False) -> Optional[int]:
        """Validate integer value with optional range checking"""
        if value is None or value == '':
            if allow_null:
                return None
            raise ValidationError("Value is required")
        
        try:
            if isinstance(value, str):
                value = int(float(value))  # Handle "30.0" -> 30
            elif isinstance(value, float):
                if value != int(value):
                    raise ValueError("Not an integer")
                value = int(value)
            elif not isinstance(value, int):
                raise ValueError("Invalid type")
        except (ValueError, TypeError):
            raise ValidationError("Must be a valid integer")
        
        if min_val is not None and value < min_val:
            raise ValidationError(f"Must be at least {min_val}")
            
        if max_val is not None and value > max_val:
            raise ValidationError(f"Must be at most {max_val}")
            
        return int(value)
    
    @staticmethod
    def validate_string(value: Any, min_length: int = 0, max_length: int = None,
                       pattern: str = None, allow_null: bool = False) -> Optional[str]:
        """Validate and sanitize string value"""
        if value is None or value == '':
            if allow_null:
                return None
            if min_length > 0:
                raise ValidationError("Value is required")
            return ''
        
        if not isinstance(value, str):
            value = str(value)
        
        # Basic sanitization - strip whitespace and control characters
        value = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', value).strip()
        
        if len(value) < min_length:
            raise ValidationError(f"Must be at least {min_length} characters")
            
        if max_length and len(value) > max_length:
            raise ValidationError(f"Must be at most {max_length} characters")
            
        if pattern and not re.match(pattern, value):
            raise ValidationError("Invalid format")
            
        return value
    
    @staticmethod
    def validate_boolean(value: Any, allow_null: bool = False) -> Optional[bool]:
        """Validate boolean value"""
        if value is None:
            if allow_null:
                return None
            raise ValidationError("Value is required")
        
        if isinstance(value, bool):
            return value
            
        if isinstance(value, str):
            value = value.lower().strip()
            if value in ('true', '1', 'yes', 'on'):
                return True
            elif value in ('false', '0', 'no', 'off'):
                return False
            else:
                raise ValidationError("Invalid boolean value")
        
        if isinstance(value, (int, float)):
            return bool(value)
            
        raise ValidationError("Invalid boolean value")
    
    @staticmethod
    def validate_choice(value: Any, choices: List[Any], allow_null: bool = False) -> Any:
        """Validate value is in allowed choices"""
        if value is None:
            if allow_null:
                return None
            raise ValidationError("Value is required")
        
        if value not in choices:
            raise ValidationError(f"Must be one of: {', '.join(map(str, choices))}")
            
        return value
    
    @staticmethod
    def validate_json(value: Any, schema: Dict = None) -> Dict:
        """Validate JSON structure"""
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise ValidationError("Invalid JSON format")
        
        if not isinstance(value, dict):
            raise ValidationError("Must be a JSON object")
        
        # TODO: Add JSON schema validation if schema provided
        return value

# Parameter validation schemas
PARAMETER_RANGES = {
    'ph': {'min': 0.0, 'max': 14.0},
    'orp': {'min': 0, 'max': 1000},
    'free_chlorine': {'min': 0.0, 'max': 10.0},
    'combined_chlorine': {'min': 0.0, 'max': 5.0},
    'turbidity': {'min': 0.0, 'max': 10.0},
    'temperature': {'min': 0.0, 'max': 50.0}
}

PUMP_DURATIONS = {
    'ph': {'min': 1, 'max': 300},
    'chlorine': {'min': 1, 'max': 300},
    'pac': {'min': 1, 'max': 600}
}

FLOW_RATES = {
    'ph': {'min': 10, 'max': 500},
    'chlorine': {'min': 10, 'max': 500},
    'pac': {'min': 60, 'max': 150}
}

def validate_request_json(schema: Dict[str, Dict]) -> callable:
    """
    Decorator to validate JSON request data against a schema
    
    Schema format:
    {
        'field_name': {
            'type': 'string|number|integer|boolean|choice',
            'required': True/False,
            'min': min_value,
            'max': max_value,
            'choices': [list_of_choices],
            'pattern': regex_pattern
        }
    }
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Get JSON data
                if not request.is_json:
                    return jsonify({'error': 'Content-Type must be application/json'}), 400
                
                data = request.get_json()
                if data is None:
                    return jsonify({'error': 'Invalid JSON data'}), 400
                
                validated_data = {}
                errors = {}
                
                # Validate each field in schema
                for field_name, field_schema in schema.items():
                    try:
                        value = data.get(field_name)
                        field_type = field_schema.get('type', 'string')
                        required = field_schema.get('required', True)
                        
                        if field_type == 'string':
                            validated_data[field_name] = Validator.validate_string(
                                value,
                                min_length=1 if required else 0,
                                max_length=field_schema.get('max'),
                                pattern=field_schema.get('pattern'),
                                allow_null=not required
                            )
                        elif field_type == 'number':
                            validated_data[field_name] = Validator.validate_number(
                                value,
                                min_val=field_schema.get('min'),
                                max_val=field_schema.get('max'),
                                allow_null=not required
                            )
                        elif field_type == 'integer':
                            validated_data[field_name] = Validator.validate_integer(
                                value,
                                min_val=field_schema.get('min'),
                                max_val=field_schema.get('max'),
                                allow_null=not required
                            )
                        elif field_type == 'boolean':
                            validated_data[field_name] = Validator.validate_boolean(
                                value,
                                allow_null=not required
                            )
                        elif field_type == 'choice':
                            validated_data[field_name] = Validator.validate_choice(
                                value,
                                choices=field_schema.get('choices', []),
                                allow_null=not required
                            )
                        elif field_type == 'email':
                            if value is not None:
                                validated_data[field_name] = Validator.validate_email(value)
                            elif required:
                                raise ValidationError("Email is required")
                        
                    except ValidationError as e:
                        errors[field_name] = e.message
                
                # Check for unknown fields
                unknown_fields = set(data.keys()) - set(schema.keys())
                if unknown_fields:
                    errors['_unknown'] = f"Unknown fields: {', '.join(unknown_fields)}"
                
                if errors:
                    return jsonify({'error': 'Validation failed', 'details': errors}), 400
                
                # Add validated data to request context
                request.validated_data = validated_data
                
                return f(*args, **kwargs)
                
            except Exception as e:
                logger.error(f"Validation error: {e}")
                return jsonify({'error': 'Internal validation error'}), 500
        
        return decorated_function
    return decorator

def validate_parameter_reading(parameter: str, value: float) -> float:
    """Validate sensor parameter reading"""
    if parameter not in PARAMETER_RANGES:
        raise ValidationError(f"Unknown parameter: {parameter}")
    
    range_info = PARAMETER_RANGES[parameter]
    return Validator.validate_number(value, range_info['min'], range_info['max'])

def validate_pump_control(pump_type: str, duration: int = None, flow_rate: int = None) -> Tuple[int, int]:
    """Validate pump control parameters"""
    if pump_type not in PUMP_DURATIONS:
        raise ValidationError(f"Unknown pump type: {pump_type}")
    
    validated_duration = None
    validated_flow_rate = None
    
    if duration is not None:
        duration_range = PUMP_DURATIONS[pump_type]
        validated_duration = Validator.validate_integer(
            duration, duration_range['min'], duration_range['max']
        )
    
    if flow_rate is not None:
        flow_rate_range = FLOW_RATES[pump_type]
        validated_flow_rate = Validator.validate_integer(
            flow_rate, flow_rate_range['min'], flow_rate_range['max']
        )
    
    return validated_duration, validated_flow_rate

def sanitize_sql_string(value: str) -> str:
    """Sanitize string for SQL queries (additional protection)"""
    if not isinstance(value, str):
        return str(value)
    
    # Remove potentially dangerous characters
    dangerous_chars = ["'", '"', ';', '--', '/*', '*/', 'xp_', 'sp_']
    for char in dangerous_chars:
        value = value.replace(char, '')
    
    return value.strip()

def validate_timestamp(timestamp: Any) -> int:
    """Validate timestamp value"""
    try:
        ts = int(timestamp)
        # Reasonable timestamp range (2020 - 2040)
        if ts < 1577836800 or ts > 2208988800:
            raise ValidationError("Timestamp out of valid range")
        return ts
    except (ValueError, TypeError):
        raise ValidationError("Invalid timestamp format")

# Common validation schemas for API endpoints
SCHEMAS = {
    # Pump control schemas
    'pump_control': {
        'command': {'type': 'choice', 'choices': ['start', 'stop', 'set_rate'], 'required': True},
        'duration': {'type': 'integer', 'min': 1, 'max': 600, 'required': False},
        'flow_rate': {'type': 'integer', 'min': 10, 'max': 500, 'required': False}
    },
    
    'pac_dosing': {
        'duration': {'type': 'integer', 'min': 1, 'max': 600, 'required': True},
        'flow_rate': {'type': 'integer', 'min': 60, 'max': 150, 'required': True}
    },
    
    # Settings schemas
    'chemistry_targets': {
        'ph_min': {'type': 'number', 'min': 6.0, 'max': 8.5, 'required': True},
        'ph_max': {'type': 'number', 'min': 6.0, 'max': 8.5, 'required': True},
        'orp_min': {'type': 'integer', 'min': 650, 'max': 850, 'required': True},
        'orp_max': {'type': 'integer', 'min': 650, 'max': 850, 'required': True},
        'chlorine_min': {'type': 'number', 'min': 0.0, 'max': 5.0, 'required': True},
        'chlorine_max': {'type': 'number', 'min': 0.0, 'max': 5.0, 'required': True},
        'turbidity_target': {'type': 'number', 'min': 0.0, 'max': 1.0, 'required': True}
    },
    
    'notification_settings': {
        'email': {'type': 'email', 'required': True},
        'email_enabled': {'type': 'boolean', 'required': False},
        'alert_threshold': {'type': 'integer', 'min': 1, 'max': 60, 'required': False},
        'alert_types': {'type': 'string', 'required': False}  # Comma-separated list
    },
    
    'system_config': {
        'system_name': {'type': 'string', 'max': 100, 'required': False},
        'location': {'type': 'string', 'max': 200, 'required': False},
        'pool_volume': {'type': 'number', 'min': 1, 'max': 1000000, 'required': False},
        'timezone': {'type': 'string', 'max': 50, 'required': False}
    },
    
    'pump_config': {
        'ph_pump_flow_rate': {'type': 'integer', 'min': 10, 'max': 500, 'required': False},
        'chlorine_pump_flow_rate': {'type': 'integer', 'min': 10, 'max': 500, 'required': False},
        'pac_pump_flow_rate': {'type': 'integer', 'min': 60, 'max': 150, 'required': False},
        'dosing_interval': {'type': 'integer', 'min': 60, 'max': 3600, 'required': False}
    },
    
    'turbidity_settings': {
        'high_threshold': {'type': 'number', 'min': 0.1, 'max': 2.0, 'required': True},
        'low_threshold': {'type': 'number', 'min': 0.05, 'max': 0.5, 'required': True},
        'target': {'type': 'number', 'min': 0.05, 'max': 0.5, 'required': True},
        'dosing_mode': {'type': 'choice', 'choices': ['AUTOMATIC', 'MANUAL'], 'required': False}
    },
    
    # User management schemas
    'user_registration': {
        'email': {'type': 'email', 'required': True},
        'password': {'type': 'string', 'min': 8, 'max': 128, 'required': True, 'pattern': r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'},
        'name': {'type': 'string', 'min': 1, 'max': 100, 'required': True},
        'confirm_password': {'type': 'string', 'required': True}
    },
    
    'user_login': {
        'email': {'type': 'email', 'required': True},
        'password': {'type': 'string', 'required': True},
        'remember_me': {'type': 'boolean', 'required': False}
    },
    
    'password_change': {
        'current_password': {'type': 'string', 'required': True},
        'new_password': {'type': 'string', 'min': 8, 'max': 128, 'required': True, 'pattern': r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'},
        'confirm_password': {'type': 'string', 'required': True}
    },
    
    # Pool management schemas
    'pool_creation': {
        'name': {'type': 'string', 'min': 1, 'max': 100, 'required': True},
        'location': {'type': 'string', 'max': 200, 'required': False},
        'volume_m3': {'type': 'number', 'min': 1, 'max': 10000, 'required': False},
        'device_id': {'type': 'string', 'max': 50, 'required': False, 'pattern': r'^[a-zA-Z0-9_-]+$'}
    },
    
    'pool_update': {
        'name': {'type': 'string', 'min': 1, 'max': 100, 'required': False},
        'location': {'type': 'string', 'max': 200, 'required': False},
        'volume_m3': {'type': 'number', 'min': 1, 'max': 10000, 'required': False}
    },
    
    # Dosing control schemas
    'dosing_mode': {
        'mode': {'type': 'choice', 'choices': ['AUTOMATIC', 'MANUAL', 'SCHEDULED'], 'required': True}
    },
    
    'dosing_schedule': {
        'timestamp': {'type': 'integer', 'min': 1577836800, 'required': True},  # 2020-01-01
        'duration': {'type': 'integer', 'min': 1, 'max': 600, 'required': True},
        'flow_rate': {'type': 'integer', 'min': 60, 'max': 150, 'required': True},
        'repeat': {'type': 'choice', 'choices': ['once', 'daily', 'weekly'], 'required': False}
    },
    
    # Simulator control schemas
    'simulator_control': {
        'command': {'type': 'choice', 'choices': ['set_parameter', 'set_time_scale', 'trigger_event'], 'required': True},
        'parameter': {'type': 'choice', 'choices': ['ph', 'orp', 'turbidity', 'temperature', 'free_chlorine', 'combined_chlorine'], 'required': False},
        'value': {'type': 'number', 'required': False},
        'time_scale': {'type': 'number', 'min': 0.1, 'max': 100.0, 'required': False},
        'event_type': {'type': 'string', 'max': 50, 'required': False}
    },
    
    # Data export schemas
    'data_export': {
        'start_date': {'type': 'string', 'required': True, 'pattern': r'^\d{4}-\d{2}-\d{2}$'},
        'end_date': {'type': 'string', 'required': True, 'pattern': r'^\d{4}-\d{2}-\d{2}$'},
        'parameters': {'type': 'string', 'required': False},  # Comma-separated list
        'format': {'type': 'choice', 'choices': ['csv', 'json', 'xlsx'], 'required': False}
    },
    
    # Test notification schema
    'test_notification': {
        'email': {'type': 'email', 'required': True},
        'message': {'type': 'string', 'max': 500, 'required': False}
    }
}