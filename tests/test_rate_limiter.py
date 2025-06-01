"""
Tests for rate limiting functionality
"""

import pytest
import time
from unittest.mock import patch, MagicMock

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'utils'))

from rate_limiter import (
    TokenBucket, SlidingWindowCounter, RateLimiter, 
    rate_limit, check_global_rate_limit, RateLimitExceeded
)


class TestTokenBucket:
    """Test TokenBucket algorithm"""
    
    def test_init(self):
        """Test TokenBucket initialization"""
        bucket = TokenBucket(capacity=10, refill_rate=1.0)
        
        assert bucket.capacity == 10
        assert bucket.tokens == 10
        assert bucket.refill_rate == 1.0
        assert bucket.last_refill > 0
    
    def test_consume_success(self):
        """Test successful token consumption"""
        bucket = TokenBucket(capacity=10, refill_rate=1.0)
        
        assert bucket.consume(5) is True
        assert bucket.tokens == 5
    
    def test_consume_insufficient_tokens(self):
        """Test token consumption with insufficient tokens"""
        bucket = TokenBucket(capacity=5, refill_rate=1.0)
        
        assert bucket.consume(10) is False
        assert bucket.tokens == 5  # Should remain unchanged
    
    def test_refill_over_time(self):
        """Test token refill over time"""
        bucket = TokenBucket(capacity=10, refill_rate=2.0)  # 2 tokens per second
        
        # Consume all tokens
        bucket.consume(10)
        assert bucket.tokens == 0
        
        # Simulate 1 second passing
        bucket.last_refill -= 1.0
        bucket._refill()
        
        assert bucket.tokens == 2  # Should have refilled 2 tokens
    
    def test_refill_not_exceed_capacity(self):
        """Test that refill doesn't exceed capacity"""
        bucket = TokenBucket(capacity=5, refill_rate=10.0)  # High refill rate
        
        # Simulate 10 seconds passing
        bucket.last_refill -= 10.0
        bucket._refill()
        
        assert bucket.tokens == 5  # Should not exceed capacity
    
    def test_time_until_available(self):
        """Test time calculation until tokens are available"""
        bucket = TokenBucket(capacity=10, refill_rate=1.0)
        
        # Consume all tokens
        bucket.consume(10)
        
        # Should take 5 seconds to get 5 tokens
        time_needed = bucket.time_until_available(5)
        assert time_needed == 5.0


class TestSlidingWindowCounter:
    """Test SlidingWindowCounter algorithm"""
    
    def test_init(self):
        """Test SlidingWindowCounter initialization"""
        window = SlidingWindowCounter(window_size=60, max_requests=10)
        
        assert window.window_size == 60
        assert window.max_requests == 10
        assert len(window.requests) == 0
    
    def test_allow_request_within_limit(self):
        """Test allowing requests within limit"""
        window = SlidingWindowCounter(window_size=60, max_requests=5)
        
        # Should allow first 5 requests
        for i in range(5):
            assert window.allow_request() is True
        
        assert len(window.requests) == 5
    
    def test_deny_request_over_limit(self):
        """Test denying requests over limit"""
        window = SlidingWindowCounter(window_size=60, max_requests=3)
        
        # Allow first 3 requests
        for i in range(3):
            assert window.allow_request() is True
        
        # 4th request should be denied
        assert window.allow_request() is False
        assert len(window.requests) == 3  # Should not add denied request
    
    def test_window_sliding(self):
        """Test that window slides over time"""
        window = SlidingWindowCounter(window_size=2, max_requests=2)  # 2 second window
        
        # Add requests at specific times
        current_time = time.time()
        with patch('time.time', return_value=current_time):
            assert window.allow_request() is True
            assert window.allow_request() is True
            assert window.allow_request() is False  # Over limit
        
        # Move forward 3 seconds (past window)
        with patch('time.time', return_value=current_time + 3):
            assert window.allow_request() is True  # Should be allowed again
    
    def test_time_until_available(self):
        """Test time calculation until next request is allowed"""
        window = SlidingWindowCounter(window_size=10, max_requests=2)
        
        current_time = time.time()
        with patch('time.time', return_value=current_time):
            window.allow_request()
            window.allow_request()
        
        # Should need to wait for window to slide
        time_needed = window.time_until_available()
        assert time_needed > 0
        assert time_needed <= 10


class TestRateLimiter:
    """Test RateLimiter class"""
    
    def test_init(self):
        """Test RateLimiter initialization"""
        limiter = RateLimiter()
        
        assert isinstance(limiter.token_buckets, dict)
        assert isinstance(limiter.sliding_windows, dict)
        assert isinstance(limiter.blocked_ips, dict)
    
    def test_get_client_id(self):
        """Test client ID generation"""
        limiter = RateLimiter()
        
        with patch('rate_limiter.request') as mock_request:
            mock_request.headers.get.side_effect = lambda key, default='': {
                'X-Real-IP': '192.168.1.1',
                'User-Agent': 'Test Browser'
            }.get(key, default)
            mock_request.remote_addr = '192.168.1.1'
            
            client_id = limiter.get_client_id()
            
            assert client_id is not None
            assert len(client_id) == 12  # MD5 hash truncated to 12 chars
    
    def test_ip_blocking(self):
        """Test IP blocking functionality"""
        limiter = RateLimiter()
        client_id = "test-client"
        
        # Block IP for 60 seconds
        limiter.block_ip(client_id, 60)
        
        assert limiter.is_ip_blocked(client_id) is True
        
        # Simulate time passing
        limiter.blocked_ips[client_id] = time.time() - 1  # Expired
        
        assert limiter.is_ip_blocked(client_id) is False
        assert client_id not in limiter.blocked_ips  # Should be cleaned up
    
    def test_check_rate_limit_sliding_window(self):
        """Test rate limiting with sliding window"""
        limiter = RateLimiter()
        
        with patch.object(limiter, 'get_client_id', return_value='test-client'):
            # Should allow first few requests
            for i in range(5):
                allowed, retry_after = limiter.check_rate_limit('test', 10, 60)
                assert allowed is True
                assert retry_after is None
            
            # Exceed limit
            for i in range(10):
                limiter.check_rate_limit('test', 10, 60)
            
            # Should be rate limited
            allowed, retry_after = limiter.check_rate_limit('test', 10, 60)
            assert allowed is False
            assert retry_after is not None
            assert retry_after > 0
    
    def test_check_rate_limit_token_bucket(self):
        """Test rate limiting with token bucket"""
        limiter = RateLimiter()
        
        with patch.object(limiter, 'get_client_id', return_value='test-client'):
            # Should allow requests up to capacity
            for i in range(5):
                allowed, retry_after = limiter.check_rate_limit('test', 5, 1.0, 'token_bucket')
                assert allowed is True
            
            # Should deny when bucket is empty
            allowed, retry_after = limiter.check_rate_limit('test', 5, 1.0, 'token_bucket')
            assert allowed is False
            assert retry_after is not None
    
    def test_blocked_ip_check(self):
        """Test that blocked IPs are rejected immediately"""
        limiter = RateLimiter()
        client_id = "blocked-client"
        
        limiter.block_ip(client_id, 60)
        
        with patch.object(limiter, 'get_client_id', return_value=client_id):
            allowed, retry_after = limiter.check_rate_limit('test', 10, 60)
            
            assert allowed is False
            assert retry_after > 0
    
    def test_cleanup_old_data(self):
        """Test cleanup of old rate limiting data"""
        limiter = RateLimiter()
        
        # Add some old data
        limiter.blocked_ips['old-client'] = time.time() - 3600  # 1 hour ago
        limiter.sliding_windows['old-key'] = SlidingWindowCounter(60, 10)
        
        # Add old requests to window
        old_window = limiter.sliding_windows['old-key']
        old_window.requests.append(time.time() - 300)  # 5 minutes ago
        
        # Run cleanup
        limiter._cleanup_old_data()
        
        # Old blocked IP should be removed
        assert 'old-client' not in limiter.blocked_ips


class TestRateLimitDecorator:
    """Test rate_limit decorator"""
    
    def test_decorator_allows_request(self):
        """Test that decorator allows requests within limit"""
        @rate_limit('test_limit')
        def test_function():
            return "success"
        
        with patch('rate_limiter.RATE_LIMITS', {'test_limit': {'max_requests': 10, 'window': 60}}), \
             patch('rate_limiter.rate_limiter') as mock_limiter:
            mock_limiter.check_rate_limit.return_value = (True, None)
            
            result = test_function()
            assert result == "success"
    
    def test_decorator_blocks_request(self):
        """Test that decorator blocks requests over limit"""
        @rate_limit('test_limit')
        def test_function():
            return "success"
        
        with patch('rate_limiter.RATE_LIMITS', {'test_limit': {'max_requests': 5, 'window': 60}}), \
             patch('rate_limiter.rate_limiter') as mock_limiter, \
             patch('rate_limiter.jsonify') as mock_jsonify:
            mock_limiter.check_rate_limit.return_value = (False, 30)
            mock_limiter.get_client_id.return_value = 'test-client'
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.headers = {}
            mock_jsonify.return_value = mock_response
            
            result = test_function()
            
            assert result.status_code == 429
            assert mock_jsonify.called
    
    def test_decorator_auto_block(self):
        """Test auto-blocking functionality"""
        @rate_limit('test_limit', auto_block=True, block_duration=300)
        def test_function():
            return "success"
        
        with patch('rate_limiter.RATE_LIMITS', {'test_limit': {'max_requests': 5, 'window': 60}}), \
             patch('rate_limiter.rate_limiter') as mock_limiter, \
             patch('rate_limiter.jsonify') as mock_jsonify, \
             patch('rate_limiter.time.time', return_value=1000):
            mock_limiter.check_rate_limit.return_value = (False, 30)
            mock_limiter.get_client_id.return_value = 'test-client'
            mock_limiter.request_counts = {
                'test-client:violations:test_limit': {
                    0: 5,  # 5 violations in current hour
                    -1: 3,  # 3 violations in previous hour
                    -2: 2   # 2 violations 2 hours ago
                }
            }
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.headers = {}
            mock_jsonify.return_value = mock_response
            
            result = test_function()
            
            # Should trigger auto-block
            assert mock_limiter.block_ip.called
    
    def test_decorator_unknown_limit_type(self):
        """Test decorator with unknown limit type"""
        @rate_limit('unknown_limit')
        def test_function():
            return "success"
        
        with patch('rate_limiter.RATE_LIMITS', {}), \
             patch('rate_limiter.logger') as mock_logger:
            result = test_function()
            
            # Should still execute function and log error
            assert result == "success"
            assert mock_logger.error.called
    
    def test_decorator_exception_handling(self):
        """Test decorator handles exceptions gracefully"""
        @rate_limit('test_limit')
        def test_function():
            return "success"
        
        with patch('rate_limiter.RATE_LIMITS', {'test_limit': {'max_requests': 10, 'window': 60}}), \
             patch('rate_limiter.rate_limiter') as mock_limiter, \
             patch('rate_limiter.logger') as mock_logger:
            mock_limiter.check_rate_limit.side_effect = Exception("Test error")
            
            result = test_function()
            
            # Should still execute function and log error
            assert result == "success"
            assert mock_logger.error.called


class TestGlobalRateLimit:
    """Test global rate limiting"""
    
    def test_check_global_rate_limit_success(self):
        """Test successful global rate limit check"""
        with patch('rate_limiter.rate_limiter') as mock_limiter:
            mock_limiter.check_rate_limit.return_value = (True, None)
            
            result = check_global_rate_limit()
            assert result is None
    
    def test_check_global_rate_limit_burst_exceeded(self):
        """Test global rate limit with burst limit exceeded"""
        with patch('rate_limiter.rate_limiter') as mock_limiter, \
             patch('rate_limiter.jsonify') as mock_jsonify:
            # First call (burst) fails, second call (general) succeeds
            mock_limiter.check_rate_limit.side_effect = [(False, 5), (True, None)]
            
            result = check_global_rate_limit()
            
            assert result is not None
            assert result[1] == 429
            assert mock_jsonify.called
    
    def test_check_global_rate_limit_general_exceeded(self):
        """Test global rate limit with general limit exceeded"""
        with patch('rate_limiter.rate_limiter') as mock_limiter, \
             patch('rate_limiter.jsonify') as mock_jsonify:
            # Burst succeeds, general fails
            mock_limiter.check_rate_limit.side_effect = [(True, None), (False, 30)]
            
            result = check_global_rate_limit()
            
            assert result is not None
            assert result[1] == 429
            assert mock_jsonify.called
    
    def test_check_global_rate_limit_exception(self):
        """Test global rate limit with exception"""
        with patch('rate_limiter.rate_limiter') as mock_limiter, \
             patch('rate_limiter.logger') as mock_logger:
            mock_limiter.check_rate_limit.side_effect = Exception("Test error")
            
            result = check_global_rate_limit()
            
            assert result is None  # Should not block on error
            assert mock_logger.error.called


class TestRateLimitConfiguration:
    """Test rate limit configuration"""
    
    def test_rate_limits_config(self):
        """Test that rate limits configuration is valid"""
        from rate_limiter import RATE_LIMITS
        
        # Check that all required keys are present
        for limit_type, config in RATE_LIMITS.items():
            assert 'max_requests' in config
            assert 'window' in config
            assert isinstance(config['max_requests'], int)
            assert isinstance(config['window'], int)
            assert config['max_requests'] > 0
            assert config['window'] > 0
    
    def test_rate_limit_strategies(self):
        """Test that rate limit strategies are valid"""
        from rate_limiter import RATE_LIMITS
        
        valid_strategies = ['sliding_window', 'token_bucket']
        
        for limit_type, config in RATE_LIMITS.items():
            strategy = config.get('strategy', 'sliding_window')
            assert strategy in valid_strategies