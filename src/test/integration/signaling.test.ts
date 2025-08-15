/**
 * Integration tests for signaling functionality
 * Tests the client-side signaling module against the worker
 */

import { createRoom } from '../../signaling';
import { unstable_dev, UnstableDevWorker } from 'wrangler';

describe('Signaling Integration', () => {
  let worker: UnstableDevWorker;
  let baseUrl: string;

  beforeAll(async () => {
    // Start the worker for integration testing
    worker = await unstable_dev('src/worker.ts', {
      experimental: { disableExperimentalWarning: true },
    });
    
    baseUrl = `http://localhost:${worker.port}`;
    
    // Mock the BASE URL in signaling module
    process.env.VITE_SIGNAL_URL = baseUrl;
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('Room Creation', () => {
    test('should create room and return valid room ID', async () => {
      const roomId = await createRoom();

      expect(roomId).toBeTruthy();
      expect(typeof roomId).toBe('string');
      expect(roomId).toMatch(/^[a-f0-9\-]{36}$/); // UUID format
    });

    test('should create unique room IDs', async () => {
      const roomIds = await Promise.all([
        createRoom(),
        createRoom(),
        createRoom(),
      ]);

      // All should be different
      const uniqueIds = new Set(roomIds);
      expect(uniqueIds.size).toBe(3);
    });

    test('should handle network errors gracefully', async () => {
      // Temporarily stop the worker to simulate network error
      await worker.stop();

      await expect(createRoom()).rejects.toThrow();

      // Restart worker for subsequent tests
      worker = await unstable_dev('src/worker.ts', {
        experimental: { disableExperimentalWarning: true },
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle worker timeout', async () => {
      // This test might be environment-specific
      // Mock a slow response by overriding fetch temporarily
      const originalFetch = global.fetch;
      
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(new Response('{"roomId": "timeout-test"}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }));
          }, 5000); // 5 second delay
        })
      );

      // This should timeout or handle gracefully
      await expect(createRoom()).resolves.toBe('timeout-test');

      // Restore original fetch
      global.fetch = originalFetch;
    });

    test('should handle invalid JSON responses', async () => {
      // Mock fetch to return invalid JSON
      const originalFetch = global.fetch;
      
      global.fetch = jest.fn().mockResolvedValue(
        new Response('invalid json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(createRoom()).rejects.toThrow();

      // Restore original fetch
      global.fetch = originalFetch;
    });

    test('should handle HTTP error responses', async () => {
      // Mock fetch to return 500 error
      const originalFetch = global.fetch;
      
      global.fetch = jest.fn().mockResolvedValue(
        new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      await expect(createRoom()).rejects.toThrow();

      // Restore original fetch
      global.fetch = originalFetch;
    });
  });

  describe('Performance', () => {
    test('should create rooms quickly', async () => {
      const startTime = Date.now();
      
      await createRoom();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    test('should handle concurrent room creation', async () => {
      const startTime = Date.now();
      
      const promises = Array.from({ length: 10 }, () => createRoom());
      const roomIds = await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should succeed and be unique
      expect(roomIds).toHaveLength(10);
      expect(new Set(roomIds).size).toBe(10);
      
      // Should complete reasonably quickly even with concurrency
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Environment Handling', () => {
    test('should use correct base URL in different environments', async () => {
      // Test with different environment configurations
      const environments = [
        { protocol: 'http:', hostname: 'localhost', port: '8787' },
        { protocol: 'https:', hostname: 'example.com', port: '443' },
        { protocol: 'http:', hostname: '192.168.1.100', port: '8787' },
      ];

      for (const env of environments) {
        // Mock window.location for each environment
        Object.defineProperty(window, 'location', {
          value: env,
          writable: true,
        });

        // The signaling module should adapt to the environment
        // This is more of a unit test for URL construction
        const roomId = await createRoom();
        expect(roomId).toBeTruthy();
      }
    });
  });

  describe('CORS Compliance', () => {
    test('should handle CORS headers correctly', async () => {
      // Make direct fetch to test CORS headers
      const response = await fetch(`${baseUrl}/rooms`, {
        method: 'POST',
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.status).toBe(200);
    });

    test('should handle preflight requests', async () => {
      const response = await fetch(`${baseUrl}/rooms`, {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Real-world Scenarios', () => {
    test('should work with actual browser-like conditions', async () => {
      // Simulate browser environment
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '3001',
          host: 'localhost:3001',
        },
        writable: true,
      });

      // Create room as if from browser
      const roomId = await createRoom();

      expect(roomId).toBeTruthy();
      expect(typeof roomId).toBe('string');
    });

    test('should handle rapid successive calls', async () => {
      // Simulate user rapidly clicking "Host workspace"
      const roomId1 = await createRoom();
      const roomId2 = await createRoom();
      const roomId3 = await createRoom();

      expect(roomId1).not.toBe(roomId2);
      expect(roomId2).not.toBe(roomId3);
      expect(roomId1).not.toBe(roomId3);
    });

    test('should work with realistic network conditions', async () => {
      // Add small artificial delay to simulate real network
      const originalFetch = global.fetch;
      
      global.fetch = jest.fn().mockImplementation(async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 100)); // 0-100ms delay
        return originalFetch(...args);
      });

      const roomId = await createRoom();
      expect(roomId).toBeTruthy();

      // Restore original fetch
      global.fetch = originalFetch;
    });
  });
});
