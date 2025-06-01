/**
 * Jest setup file for frontend tests
 */

// Mock global functions and objects that are commonly used
global.escapeHtml = function(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
};

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1
}));

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};
global.sessionStorage = sessionStorageMock;

// Mock window.location
delete window.location;
window.location = {
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    reload: jest.fn(),
    assign: jest.fn()
};

// Mock window.navigator
Object.defineProperty(window, 'navigator', {
    value: {
        onLine: true,
        userAgent: 'Mozilla/5.0 (Test Environment)'
    },
    writable: true
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock setTimeout and setInterval for more predictable tests
jest.useFakeTimers();

// Setup DOM environment
document.body.innerHTML = `
    <div id="app">
        <div id="dashboard">
            <div class="parameter-display" data-parameter="ph">
                <span class="value">7.2</span>
                <span class="unit">pH</span>
            </div>
            <div class="parameter-display" data-parameter="turbidity">
                <span class="value">0.15</span>
                <span class="unit">NTU</span>
            </div>
            <button id="pac-start-btn">Start PAC</button>
            <button id="pac-stop-btn">Stop PAC</button>
        </div>
        <div id="settings-modal" class="modal">
            <form id="chemistry-targets-form">
                <input type="number" id="ph-target" value="7.2">
                <input type="number" id="orp-target" value="720">
            </form>
        </div>
        <div id="toast-container"></div>
    </div>
`;

// Add custom matchers
expect.extend({
    toBeWithinRange(received, floor, ceiling) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            };
        }
    }
});

// Reset all mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset localStorage
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    
    // Reset sessionStorage
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    sessionStorageMock.clear.mockClear();
    
    // Reset fetch
    global.fetch.mockClear();
    
    // Reset DOM to initial state
    document.querySelectorAll('.toast').forEach(toast => toast.remove());
});