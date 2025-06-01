"""
Rate limiting middleware for Pool Automation API
Provides protection against abuse, DoS attacks, and excessive requests
"""

import time
import hashlib
import json
from typing import Dict, Optional, Tuple
from functools import wraps
from collections import defaultdict, deque
from flask import request, jsonify, g
import logging

logger = logging.getLogger(__name__)

class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded"""
    def __init__(self, limit: int, window: int, retry_after: int):
        self.limit = limit
        self.window = window
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded: {limit} requests per {window}s")

class TokenBucket:
    """Token bucket algorithm for rate limiting"""
    
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_refill = time.time()
    
    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens from bucket"""
        self._refill()
        
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False
    
    def _refill(self):
        """Refill tokens based on time elapsed"""
        now = time.time()
        time_elapsed = now - self.last_refill
        tokens_to_add = time_elapsed * self.refill_rate
        
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now
    
    def time_until_available(self, tokens: int = 1) -> float:
        """Calculate time until enough tokens are available"""
        self._refill()
        
        if self.tokens >= tokens:
            return 0
        
        tokens_needed = tokens - self.tokens
        return tokens_needed / self.refill_rate

class SlidingWindowCounter:
    """Sliding window counter for more precise rate limiting"""
    
    def __init__(self, window_size: int, max_requests: int):
        self.window_size = window_size
        self.max_requests = max_requests
        self.requests = deque()
    
    def allow_request(self) -> bool:
        """Check if request is allowed"""
        now = time.time()
        
        # Remove old requests outside window
        while self.requests and self.requests[0] <= now - self.window_size:
            self.requests.popleft()
        
        # Check if limit exceeded
        if len(self.requests) >= self.max_requests:
            return False
        
        # Add current request
        self.requests.append(now)
        return True
    
    def time_until_available(self) -> float:
        """Calculate time until next request is allowed"""
        if len(self.requests) < self.max_requests:
            return 0
        
        oldest_request = self.requests[0]
        return oldest_request + self.window_size - time.time()

class RateLimiter:
    """Main rate limiter class with multiple strategies"""
    
    def __init__(self):
        # In-memory storage for rate limiting data
        # In production, consider using Redis for distributed rate limiting
        self.token_buckets: Dict[str, TokenBucket] = {}
        self.sliding_windows: Dict[str, SlidingWindowCounter] = {}
        self.request_counts: Dict[str, Dict[str, int]] = defaultdict(dict)
        self.blocked_ips: Dict[str, float] = {}  # IP -> unblock_time
        
        # Cleanup old entries periodically
        self.last_cleanup = time.time()
        self.cleanup_interval = 300  # 5 minutes
    
    def get_client_id(self) -> str:
        """Get unique identifier for client"""
        # Try to get real IP from headers (for proxy/load balancer setups)
        real_ip = request.headers.get('X-Real-IP')
        forwarded_for = request.headers.get('X-Forwarded-For')
        
        if real_ip:
            client_ip = real_ip
        elif forwarded_for:
            # X-Forwarded-For can have multiple IPs, take the first one
            client_ip = forwarded_for.split(',')[0].strip()
        else:
            client_ip = request.remote_addr or 'unknown'
        
        # Include user agent for additional fingerprinting
        user_agent = request.headers.get('User-Agent', '')
        
        # Create hash for privacy (don't store raw IPs in logs)
        client_hash = hashlib.md5(f"{client_ip}:{user_agent}".encode()).hexdigest()[:12]
        
        return client_hash
    
    def is_ip_blocked(self, client_id: str) -> bool:
        """Check if IP is temporarily blocked"""
        if client_id in self.blocked_ips:
            if time.time() < self.blocked_ips[client_id]:
                return True
            else:
                # Unblock expired entries
                del self.blocked_ips[client_id]
        return False
    
    def block_ip(self, client_id: str, duration: int):
        """Temporarily block an IP"""
        self.blocked_ips[client_id] = time.time() + duration
        logger.warning(f"Blocked client {client_id} for {duration} seconds")
    
    def check_rate_limit(self, limit_type: str, max_requests: int, 
                        window_seconds: int, strategy: str = 'sliding_window') -> Tuple[bool, Optional[int]]:
        """
        Check if request should be allowed
        
        Args:
            limit_type: Type of limit (e.g., 'api_general', 'login_attempts')
            max_requests: Maximum requests allowed
            window_seconds: Time window in seconds
            strategy: 'sliding_window' or 'token_bucket'
        
        Returns:
            (allowed, retry_after_seconds)
        """
        client_id = self.get_client_id()
        
        # Check if IP is blocked
        if self.is_ip_blocked(client_id):
            return False, int(self.blocked_ips[client_id] - time.time())
        
        # Cleanup old entries periodically
        self._cleanup_if_needed()
        
        key = f"{client_id}:{limit_type}"
        
        if strategy == 'token_bucket':
            return self._check_token_bucket(key, max_requests, window_seconds)
        else:
            return self._check_sliding_window(key, max_requests, window_seconds)
    
    def _check_sliding_window(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, Optional[int]]:
        """Check sliding window rate limit"""
        if key not in self.sliding_windows:
            self.sliding_windows[key] = SlidingWindowCounter(window_seconds, max_requests)
        
        window = self.sliding_windows[key]
        
        if window.allow_request():
            return True, None
        else:
            retry_after = int(window.time_until_available()) + 1
            return False, retry_after
    
    def _check_token_bucket(self, key: str, capacity: int, refill_rate: float) -> Tuple[bool, Optional[int]]:
        """Check token bucket rate limit"""
        if key not in self.token_buckets:
            self.token_buckets[key] = TokenBucket(capacity, refill_rate)
        
        bucket = self.token_buckets[key]
        
        if bucket.consume():
            return True, None
        else:
            retry_after = int(bucket.time_until_available()) + 1
            return False, retry_after
    
    def _cleanup_if_needed(self):
        """Clean up old rate limiting data"""
        now = time.time()
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_data()
            self.last_cleanup = now
    
    def _cleanup_old_data(self):
        """Remove old rate limiting data"""
        current_time = time.time()
        
        # Clean up blocked IPs
        expired_blocks = [ip for ip, unblock_time in self.blocked_ips.items() 
                         if current_time > unblock_time]
        for ip in expired_blocks:
            del self.blocked_ips[ip]
        
        # Clean up old sliding windows (keep only recently active ones)
        inactive_windows = []
        for key, window in self.sliding_windows.items():
            if not window.requests or (current_time - window.requests[-1]) > window.window_size * 2:
                inactive_windows.append(key)
        
        for key in inactive_windows:
            del self.sliding_windows[key]
        
        # Clean up old token buckets (keep only recently used ones)
        inactive_buckets = []
        for key, bucket in self.token_buckets.items():
            if (current_time - bucket.last_refill) > 3600:  # 1 hour
                inactive_buckets.append(key)
        
        for key in inactive_buckets:
            del self.token_buckets[key]
        
        logger.debug(f"Cleaned up {len(expired_blocks)} blocked IPs, {len(inactive_windows)} windows, {len(inactive_buckets)} buckets")

# Global rate limiter instance
rate_limiter = RateLimiter()

# Rate limiting configurations
RATE_LIMITS = {
    # General API limits
    'api_general': {'max_requests': 100, 'window': 60, 'strategy': 'sliding_window'},  # 100 req/min
    'api_burst': {'max_requests': 10, 'window': 1, 'strategy': 'sliding_window'},      # 10 req/sec burst
    
    # Authentication limits
    'login_attempts': {'max_requests': 5, 'window': 300, 'strategy': 'sliding_window'},  # 5 attempts per 5 min
    'register_attempts': {'max_requests': 3, 'window': 3600, 'strategy': 'sliding_window'},  # 3 attempts per hour
    
    # Critical operations
    'pump_control': {'max_requests': 20, 'window': 60, 'strategy': 'sliding_window'},    # 20 pump operations per minute
    'dosing_control': {'max_requests': 10, 'window': 300, 'strategy': 'sliding_window'}, # 10 dosing operations per 5 min
    'settings_update': {'max_requests': 10, 'window': 60, 'strategy': 'sliding_window'}, # 10 settings updates per minute
    
    # Data access
    'data_export': {'max_requests': 5, 'window': 300, 'strategy': 'sliding_window'},     # 5 exports per 5 min
    'history_request': {'max_requests': 30, 'window': 60, 'strategy': 'sliding_window'}, # 30 history requests per minute
}

def rate_limit(limit_type: str, auto_block: bool = False, block_duration: int = 300):
    """
    Decorator for rate limiting Flask routes
    
    Args:
        limit_type: Type of rate limit to apply (from RATE_LIMITS)
        auto_block: Automatically block IP after repeated violations
        block_duration: How long to block IP in seconds
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                if limit_type not in RATE_LIMITS:
                    logger.error(f"Unknown rate limit type: {limit_type}")
                    return f(*args, **kwargs)
                
                config = RATE_LIMITS[limit_type]
                allowed, retry_after = rate_limiter.check_rate_limit(
                    limit_type,
                    config['max_requests'],
                    config['window'],
                    config.get('strategy', 'sliding_window')
                )
                
                if not allowed:
                    client_id = rate_limiter.get_client_id()
                    
                    # Log rate limit violation
                    logger.warning(f"Rate limit exceeded for {limit_type} by client {client_id}")
                    
                    # Auto-block repeat offenders
                    if auto_block:
                        violation_key = f"{client_id}:violations:{limit_type}"
                        violations = rate_limiter.request_counts.get(violation_key, {})
                        current_hour = int(time.time() / 3600)
                        violations[current_hour] = violations.get(current_hour, 0) + 1
                        
                        # Block if too many violations in recent hours
                        recent_violations = sum(violations.get(hour, 0) 
                                              for hour in range(current_hour - 2, current_hour + 1))
                        
                        if recent_violations >= 10:  # 10 violations in 3 hours
                            rate_limiter.block_ip(client_id, block_duration)
                            logger.warning(f"Auto-blocked client {client_id} for repeated violations")
                    
                    # Return rate limit error
                    response = jsonify({
                        'error': 'Rate limit exceeded',
                        'message': f'Too many {limit_type} requests',
                        'retry_after': retry_after,
                        'limit': config['max_requests'],
                        'window': config['window']
                    })
                    response.status_code = 429
                    response.headers['Retry-After'] = str(retry_after)
                    response.headers['X-RateLimit-Limit'] = str(config['max_requests'])
                    response.headers['X-RateLimit-Window'] = str(config['window'])
                    response.headers['X-RateLimit-Retry-After'] = str(retry_after)
                    
                    return response
                
                # Add rate limit headers to successful responses
                response = f(*args, **kwargs)
                if hasattr(response, 'headers'):
                    response.headers['X-RateLimit-Limit'] = str(config['max_requests'])
                    response.headers['X-RateLimit-Window'] = str(config['window'])
                
                return response
                
            except Exception as e:
                logger.error(f"Rate limiting error: {e}")
                # Don't block requests due to rate limiting errors
                return f(*args, **kwargs)
        
        return decorated_function
    return decorator

def check_global_rate_limit():
    """Global rate limit check for all requests"""
    try:
        # Check burst limit
        burst_allowed, burst_retry = rate_limiter.check_rate_limit(
            'api_burst', 
            RATE_LIMITS['api_burst']['max_requests'],
            RATE_LIMITS['api_burst']['window']
        )
        
        if not burst_allowed:
            return jsonify({
                'error': 'Rate limit exceeded',
                'message': 'Too many requests per second',
                'retry_after': burst_retry
            }), 429
        
        # Check general limit
        general_allowed, general_retry = rate_limiter.check_rate_limit(
            'api_general',
            RATE_LIMITS['api_general']['max_requests'], 
            RATE_LIMITS['api_general']['window']
        )
        
        if not general_allowed:
            return jsonify({
                'error': 'Rate limit exceeded', 
                'message': 'Too many API requests',
                'retry_after': general_retry
            }), 429
        
        return None
        
    except Exception as e:
        logger.error(f"Global rate limit check error: {e}")
        return None

def get_rate_limit_status(limit_type: str) -> Dict:
    """Get current rate limit status for debugging"""
    if limit_type not in RATE_LIMITS:
        return {'error': 'Unknown limit type'}
    
    config = RATE_LIMITS[limit_type]
    client_id = rate_limiter.get_client_id()
    key = f"{client_id}:{limit_type}"
    
    status = {
        'limit_type': limit_type,
        'max_requests': config['max_requests'],
        'window_seconds': config['window'],
        'strategy': config.get('strategy', 'sliding_window'),
        'client_id': client_id,
        'is_blocked': rate_limiter.is_ip_blocked(client_id)
    }
    
    if key in rate_limiter.sliding_windows:
        window = rate_limiter.sliding_windows[key]
        status['current_requests'] = len(window.requests)
        status['time_until_reset'] = max(0, window.time_until_available())
    
    return status