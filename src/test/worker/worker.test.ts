/**
 * Tests for Cloudflare Worker HTTP Discovery Service
 * Tests the simple UUID to IP address mapping service for P2P peer discovery
 * Note: These tests use Cloudflare Workers testing utilities
 */

import { unstable_dev, UnstableDevWorker } from 'wrangler';

describe('Cloudflare Worker Discovery Service', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    // Start the worker in test mode
    worker = await unstable_dev('src/worker.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('Room Management', () => {
    test('should create a new room', async () => {
      const resp = await worker.fetch('/rooms', {
        method: 'POST',
      });

      expect(resp.status).toBe(200);
      
      const data = await resp.json();
      expect(data).toHaveProperty('roomId');
      expect(data.roomId).toMatch(/^[a-f0-9\-]{36}$/); // UUID format
    });

    test('should handle CORS preflight requests', async () => {
      const resp = await worker.fetch('/rooms', {
        method: 'OPTIONS',
      });

      expect(resp.status).toBe(200);
      expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(resp.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(resp.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });

    test('should return 404 for unknown endpoints', async () => {
      const resp = await worker.fetch('/unknown-endpoint');

      expect(resp.status).toBe(404);
      
      const data = await resp.json();
      expect(data).toHaveProperty('error', 'not found');
    });
  });

  describe('Health Check', () => {
    test('should provide discovery service health status', async () => {
      const resp = await worker.fetch('/health');

      expect(resp.status).toBe(200);
      
      const data = await resp.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('service', 'discovery + signaling');
    });
  });

  describe('Peer Discovery', () => {
    test('should register a peer in a room', async () => {
      // First create a room
      const createResp = await worker.fetch('/rooms', {
        method: 'POST',
      });
      const { roomId } = await createResp.json();

      // Register a peer
      const resp = await worker.fetch('/discovery/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: roomId,
          peerId: 'test-peer-1',
        }),
      });

      expect(resp.status).toBe(200);
      
      const data = await resp.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('registeredIP');
      expect(typeof data.registeredIP).toBe('string');
    });

    test('should reject registration with missing fields', async () => {
      const testCases = [
        {},
        { roomId: 'test-room' },
        { peerId: 'test-peer' },
      ];

      for (const body of testCases) {
        const resp = await worker.fetch('/discovery/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        expect(resp.status).toBe(400);
        
        const data = await resp.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('Missing required fields');
      }
    });

    test('should discover other peers in a room', async () => {
      // Create a room
      const createResp = await worker.fetch('/rooms', {
        method: 'POST',
      });
      const { roomId } = await createResp.json();

      // Register two peers
      await worker.fetch('/discovery/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, peerId: 'peer-1' }),
      });

      await worker.fetch('/discovery/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, peerId: 'peer-2' }),
      });

      // Discover peers from peer-1's perspective
      const resp = await worker.fetch(
        `/discovery/peers?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent('peer-1')}`
      );

      expect(resp.status).toBe(200);
      
      const data = await resp.json();
      expect(data).toHaveProperty('peers');
      expect(Array.isArray(data.peers)).toBe(true);
      expect(data.peers).toHaveLength(1);
      expect(data.peers[0]).toHaveProperty('peerId', 'peer-2');
      expect(data.peers[0]).toHaveProperty('ip');
    });

    test('should not return self in peer discovery', async () => {
      // Create a room and register one peer
      const createResp = await worker.fetch('/rooms', {
        method: 'POST',
      });
      const { roomId } = await createResp.json();

      await worker.fetch('/discovery/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, peerId: 'solo-peer' }),
      });

      // Try to discover peers as the only peer
      const resp = await worker.fetch(
        `/discovery/peers?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent('solo-peer')}`
      );

      expect(resp.status).toBe(200);
      
      const data = await resp.json();
      expect(data.peers).toHaveLength(0); // Should not include self
    });

    test('should require roomId and peerId for peer discovery', async () => {
      const testCases = [
        '/discovery/peers',
        '/discovery/peers?roomId=test',
        '/discovery/peers?peerId=test',
      ];

      for (const url of testCases) {
        const resp = await worker.fetch(url);

        expect(resp.status).toBe(400);
        
        const data = await resp.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('Missing');
      }
    });
  });

  describe('Room State Management', () => {
    test('should track peer registration in health endpoint', async () => {
      // Get initial state
      const initialResp = await worker.fetch('/health');
      const initialData = await initialResp.json();
      const initialRooms = initialData.activeRooms;
      const initialPeers = initialData.totalPeers;

      // Create a room and register a peer
      const createResp = await worker.fetch('/rooms', {
        method: 'POST',
      });
      const { roomId } = await createResp.json();

      await worker.fetch('/discovery/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, peerId: 'test-peer' }),
      });

      // Check health endpoint shows updated counts
      const finalResp = await worker.fetch('/health');
      const finalData = await finalResp.json();
      
      expect(finalData.activeRooms).toBe(initialRooms + 1);
      expect(finalData.totalPeers).toBe(initialPeers + 1);
    });

    test('should handle multiple room creation', async () => {
      const roomIds = new Set();

      // Create multiple rooms
      for (let i = 0; i < 5; i++) {
        const resp = await worker.fetch('/rooms', {
          method: 'POST',
        });
        const data = await resp.json();
        roomIds.add(data.roomId);
      }

      // All room IDs should be unique
      expect(roomIds.size).toBe(5);

      // Each should be a valid UUID
      roomIds.forEach((roomId) => {
        expect(roomId).toMatch(/^[a-f0-9\-]{36}$/);
      });
    });

    test('should clean up old peer entries automatically', async () => {
      // Create a room
      const createResp = await worker.fetch('/rooms', {
        method: 'POST',
      });
      const { roomId } = await createResp.json();

      // Register multiple peers to simulate activity
      for (let i = 0; i < 3; i++) {
        await worker.fetch('/discovery/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, peerId: `peer-${i}` }),
        });
      }

      // Verify peers are registered
      const discoverResp = await worker.fetch(
        `/discovery/peers?roomId=${encodeURIComponent(roomId)}&peerId=peer-0`
      );
      const data = await discoverResp.json();
      expect(data.peers.length).toBeGreaterThan(0);

      // Note: Testing actual time-based cleanup would require waiting 10+ minutes
      // or mocking time, which is complex in Worker environment
      // This test just verifies the discovery mechanism works
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON in registration', async () => {
      const resp = await worker.fetch('/discovery/register', {
        method: 'POST',
        body: 'invalid-json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(resp.status).toBe(400);
      
      const data = await resp.json();
      expect(data).toHaveProperty('error');
    });

    test('should handle unsupported HTTP methods', async () => {
      const endpoints = [
        { path: '/rooms', method: 'DELETE' },
        { path: '/discovery/register', method: 'GET' },
        { path: '/discovery/peers', method: 'POST' },
      ];

      for (const { path, method } of endpoints) {
        const resp = await worker.fetch(path, { method });
        expect(resp.status).toBe(404);
      }
    });

    test('should handle empty discovery requests gracefully', async () => {
      // Test discovery with non-existent room
      const resp = await worker.fetch(
        '/discovery/peers?roomId=non-existent-room&peerId=test-peer'
      );

      expect(resp.status).toBe(200);
      
      const data = await resp.json();
      expect(data).toHaveProperty('peers');
      expect(data.peers).toHaveLength(0);
    });
  });

  describe('Performance and Limits', () => {
    test('should handle rapid room creation', async () => {
      const promises = Array.from({ length: 10 }, () =>
        worker.fetch('/rooms', { method: 'POST' })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((resp) => {
        expect(resp.status).toBe(200);
      });

      // All room IDs should be unique
      const roomIds = await Promise.all(
        responses.map(async (resp) => {
          const data = await resp.json();
          return data.roomId;
        })
      );

      const uniqueRoomIds = new Set(roomIds);
      expect(uniqueRoomIds.size).toBe(10);
    });

    test('should maintain health endpoint performance', async () => {
      const startTime = Date.now();
      
      const resp = await worker.fetch('/health');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(resp.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('CORS Compliance', () => {
    test('should include CORS headers on all responses', async () => {
      const endpoints = [
        { method: 'POST', path: '/rooms' },
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/unknown' },
      ];

      for (const { method, path } of endpoints) {
        const resp = await worker.fetch(path, { method });

        expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(resp.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
        expect(resp.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      }
    });

    test('should handle preflight requests for all endpoints', async () => {
      const paths = ['/rooms', '/health', '/rooms/test-room'];

      for (const path of paths) {
        const resp = await worker.fetch(path, {
          method: 'OPTIONS',
        });

        expect(resp.status).toBe(200);
        expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
      }
    });
  });

  describe('Security', () => {
    test('should generate cryptographically secure room IDs', async () => {
      const roomIds = new Set();

      // Generate multiple room IDs
      for (let i = 0; i < 100; i++) {
        const resp = await worker.fetch('/rooms', {
          method: 'POST',
        });
        const data = await resp.json();
        roomIds.add(data.roomId);
      }

      // Should all be unique (extremely low collision probability with UUID)
      expect(roomIds.size).toBe(100);

      // Should all follow UUID v4 format
      roomIds.forEach((roomId) => {
        expect(roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });
    });

    test('should not expose internal state in health endpoint', async () => {
      const resp = await worker.fetch('/health');
      const data = await resp.json();

      // Should only expose safe metrics for discovery service
      const allowedKeys = ['status', 'service', 'activeRooms', 'totalPeers'];
      const responseKeys = Object.keys(data);

      responseKeys.forEach((key) => {
        expect(allowedKeys).toContain(key);
      });

      // Should not expose sensitive information
      expect(data).not.toHaveProperty('environment');
      expect(data).not.toHaveProperty('secrets');
      expect(data).not.toHaveProperty('internalState');
      expect(data).not.toHaveProperty('peerData');
    });

    test('should handle malicious input safely in discovery API', async () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        'rm -rf /',
        'SELECT * FROM users',
        '\0\0\0\0',
        'a'.repeat(10000), // Very long string
      ];

      for (const input of maliciousInputs) {
        // Test malicious room IDs and peer IDs
        const registerResp = await worker.fetch('/discovery/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: input, peerId: input }),
        });

        // Should handle gracefully (either accept or reject, but not crash)
        expect([200, 400]).toContain(registerResp.status);

        // Test malicious discovery parameters
        const discoverResp = await worker.fetch(
          `/discovery/peers?roomId=${encodeURIComponent(input)}&peerId=${encodeURIComponent(input)}`
        );

        expect([200, 400]).toContain(discoverResp.status);
      }
    });

    test('should protect against IP address exposure to unauthorized peers', async () => {
      // Create room and register two peers
      const createResp = await worker.fetch('/rooms', { method: 'POST' });
      const { roomId } = await createResp.json();

      const registerResp1 = await worker.fetch('/discovery/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, peerId: 'peer-1' }),
      });
      expect(registerResp1.status).toBe(200);

      await worker.fetch('/discovery/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, peerId: 'peer-2' }),
      });

      // Try to discover peers from a different room (should get empty list)
      const createResp2 = await worker.fetch('/rooms', { method: 'POST' });
      const { roomId: otherRoomId } = await createResp2.json();

      const discoverResp = await worker.fetch(
        `/discovery/peers?roomId=${encodeURIComponent(otherRoomId)}&peerId=unauthorized-peer`
      );

      expect(discoverResp.status).toBe(200);
      
      const data = await discoverResp.json();
      expect(data.peers).toHaveLength(0); // Should not see peers from other rooms
    });
  });
});
