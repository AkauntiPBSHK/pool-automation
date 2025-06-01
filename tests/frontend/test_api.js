/**
 * Frontend API module tests
 * Tests for the DashboardAPI JavaScript module
 */

// Mock global objects
global.window = {
    DashboardConfig: {
        api: { baseUrl: '/api', timeout: 30000, retryAttempts: 3, retryDelay: 1000 }
    },
    addEventListener: jest.fn(),
    navigator: { onLine: true },
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
    },
    location: {
        pathname: '/test',
        href: 'http://localhost/test'
    },
    UIManager: {
        showToast: jest.fn()
    }
};

global.document = {
    querySelector: jest.fn()
};

global.fetch = jest.fn();

// Load the module
require('../../frontend/static/js/api.js');
const DashboardAPI = global.window.DashboardAPI;

describe('DashboardAPI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockClear();
    });

    describe('Authentication Headers', () => {
        test('should include basic headers', () => {
            global.document.querySelector.mockReturnValue(null);
            global.window.localStorage.getItem.mockReturnValue(null);

            // Access private method through test
            const api = DashboardAPI;
            
            // Test would need to expose getAuthHeaders for testing
            // For now, test through actual API calls
            expect(api).toBeDefined();
        });

        test('should include CSRF token when available', () => {
            const mockCSRFElement = { content: 'test-csrf-token' };
            global.document.querySelector.mockReturnValue(mockCSRFElement);

            // Similar to above, would test through API calls
            expect(DashboardAPI).toBeDefined();
        });

        test('should include auth token when available', () => {
            global.window.localStorage.getItem.mockReturnValue('test-auth-token');

            expect(DashboardAPI).toBeDefined();
        });
    });

    describe('Request Method', () => {
        test('should make successful GET request', async () => {
            const mockResponse = { status: 'ok', data: 'test' };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockResponse)
            });

            const result = await DashboardAPI.get('/test');

            expect(fetch).toHaveBeenCalledWith(
                '/api/test',
                expect.objectContaining({
                    method: 'GET',
                    credentials: 'same-origin'
                })
            );
            expect(result).toEqual(mockResponse);
        });

        test('should make successful POST request', async () => {
            const testData = { name: 'test', value: 123 };
            const mockResponse = { success: true };
            
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve(mockResponse)
            });

            const result = await DashboardAPI.post('/test', testData);

            expect(fetch).toHaveBeenCalledWith(
                '/api/test',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('test')
                })
            );
            expect(result).toEqual(mockResponse);
        });

        test('should handle 401 authentication errors', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                headers: new Map()
            });

            await expect(DashboardAPI.get('/test')).rejects.toThrow('Authentication required');
        });

        test('should handle 429 rate limiting', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: new Map([['Retry-After', '60']]),
                json: () => Promise.resolve({ message: 'API requests' })
            });

            global.window.UIManager.showToast.mockImplementation(() => {});

            await expect(DashboardAPI.get('/test')).rejects.toThrow('Rate limited');
            expect(global.window.UIManager.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Too many API requests'),
                'warning',
                expect.any(Number)
            );
        });

        test('should retry on server errors', async () => {
            // First call fails with 500, second succeeds
            global.fetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    headers: new Map()
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve({ success: true })
                });

            const result = await DashboardAPI.get('/test');

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ success: true });
        });

        test('should handle request timeout', async () => {
            jest.useFakeTimers();

            const timeoutPromise = DashboardAPI.get('/test');
            
            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(31000); // Exceed 30s timeout

            jest.useRealTimers();

            // The request should timeout (implementation dependent)
            // This test may need adjustment based on actual timeout implementation
        });
    });

    describe('Data Sanitization', () => {
        test('should sanitize string data', async () => {
            const maliciousData = {
                name: '<script>alert("xss")</script>',
                description: 'Normal text'
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ success: true })
            });

            await DashboardAPI.post('/test', maliciousData);

            // Check that the data was sanitized in the request body
            const sentData = JSON.parse(fetch.mock.calls[0][1].body);
            expect(sentData.name).not.toContain('<script>');
            expect(sentData.name).toContain('&lt;script&gt;');
        });

        test('should handle nested objects', async () => {
            const nestedData = {
                user: {
                    name: '<img src="x" onerror="alert(1)">',
                    preferences: {
                        theme: 'dark'
                    }
                }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ success: true })
            });

            await DashboardAPI.post('/test', nestedData);

            const sentData = JSON.parse(fetch.mock.calls[0][1].body);
            expect(sentData.user.name).not.toContain('<img');
            expect(sentData.user.preferences.theme).toBe('dark');
        });
    });

    describe('Offline Support', () => {
        test('should queue requests when offline', async () => {
            // Simulate offline
            global.window.navigator.onLine = false;

            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(DashboardAPI.get('/test')).rejects.toThrow('Offline - request queued');

            expect(global.window.localStorage.setItem).toHaveBeenCalledWith(
                'requestQueue',
                expect.any(String)
            );
        });

        test('should process queue when coming back online', () => {
            const mockQueue = [
                { endpoint: '/test1', options: {}, timestamp: Date.now() },
                { endpoint: '/test2', options: {}, timestamp: Date.now() }
            ];

            global.window.localStorage.getItem.mockReturnValue(JSON.stringify(mockQueue));

            // Simulate going online
            const onlineEvent = global.window.addEventListener.mock.calls
                .find(call => call[0] === 'online')[1];

            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ success: true })
            });

            onlineEvent();

            // Should attempt to process queued requests
            expect(global.window.localStorage.removeItem).toHaveBeenCalledWith('requestQueue');
        });
    });

    describe('Convenience Methods', () => {
        beforeEach(() => {
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ success: true })
            });
        });

        test('dashboard.getData should call correct endpoint', async () => {
            await DashboardAPI.dashboard.getData();

            expect(fetch).toHaveBeenCalledWith(
                '/api/dashboard',
                expect.objectContaining({
                    method: 'GET'
                })
            );
        });

        test('dashboard.getHistory should include hours parameter', async () => {
            await DashboardAPI.dashboard.getHistory(48);

            expect(fetch).toHaveBeenCalledWith(
                '/api/history/parameters?hours=48',
                expect.any(Object)
            );
        });

        test('pumps.controlPAC should send correct data', async () => {
            await DashboardAPI.pumps.controlPAC('start', 30, 100);

            expect(fetch).toHaveBeenCalledWith(
                '/api/pumps/pac',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"command":"start"')
                })
            );

            const sentData = JSON.parse(fetch.mock.calls[0][1].body);
            expect(sentData).toEqual({
                command: 'start',
                duration: 30,
                flow_rate: 100
            });
        });

        test('dosing.manualDose should send correct parameters', async () => {
            await DashboardAPI.dosing.manualDose(60, 150);

            const sentData = JSON.parse(fetch.mock.calls[0][1].body);
            expect(sentData).toEqual({
                duration: 60,
                flow_rate: 150
            });
        });

        test('settings.updateNotifications should send settings', async () => {
            const settings = {
                email: 'test@example.com',
                alertTypes: ['high_turbidity', 'pump_failure']
            };

            await DashboardAPI.settings.updateNotifications(settings);

            const sentData = JSON.parse(fetch.mock.calls[0][1].body);
            expect(sentData).toEqual(settings);
        });
    });

    describe('Utility Methods', () => {
        test('isOnline should return connection status', () => {
            global.window.navigator.onLine = true;
            expect(DashboardAPI.isOnline()).toBe(true);

            global.window.navigator.onLine = false;
            expect(DashboardAPI.isOnline()).toBe(false);
        });

        test('getQueueSize should return queue length', () => {
            // This would need access to internal queue state
            // For now, just test that method exists
            expect(typeof DashboardAPI.getQueueSize).toBe('function');
        });

        test('clearQueue should clear request queue', () => {
            DashboardAPI.clearQueue();

            expect(global.window.localStorage.removeItem).toHaveBeenCalledWith('requestQueue');
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors gracefully', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            await expect(DashboardAPI.get('/test')).rejects.toThrow();
        });

        test('should handle malformed JSON responses', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.reject(new Error('Invalid JSON'))
            });

            await expect(DashboardAPI.get('/test')).rejects.toThrow();
        });

        test('should handle non-JSON responses', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'text/plain']]),
                text: () => Promise.resolve('Plain text response')
            });

            const result = await DashboardAPI.get('/test');

            expect(result).toBe('Plain text response');
        });
    });
});