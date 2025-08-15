/**
 * Polyfills for Node.js environment when testing Cloudflare Workers
 */

const { TextEncoder, TextDecoder } = require('util');

// Polyfill Web APIs that Wrangler expects
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock crypto for Node.js environment
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  };
}

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = () => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  });
}

// Suppress Wrangler warnings during tests
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  // Filter out Wrangler-specific warnings
  if (args[0] && typeof args[0] === 'string' && args[0].includes('wrangler')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};
