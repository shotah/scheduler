import '@testing-library/jest-dom';

// Mock WebSocket for tests
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-1234-5678-9abc-def0'),
  },
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    hostname: 'localhost',
    host: 'localhost:3001',
    href: 'http://localhost:3001',
    search: '',
    hash: '',
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock URLSearchParams
global.URLSearchParams = jest.fn().mockImplementation((search) => {
  const params = new Map();
  if (search) {
    search.replace(/^\?/, '').split('&').forEach((param: string) => {
      const [key, value] = param.split('=');
      if (key) params.set(key, decodeURIComponent(value || ''));
    });
  }
  return {
    get: (key: string) => params.get(key),
    set: (key: string, value: string) => params.set(key, value),
    toString: () => Array.from(params.entries()).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'),
  };
});
