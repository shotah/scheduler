export interface Env {}

// Simple in-memory storage for UUID to IP address discovery
// Maps roomId -> Map<peerId, { ip: string, timestamp: number }>
const peerDiscovery = new Map<string, Map<string, { ip: string; timestamp: number }>>();

// Minimal WebRTC signaling for LAN-only handshake (temporary storage)
const signalingOffers = new Map<string, { offer: any; timestamp: number }>();
const signalingAnswers = new Map<string, { answer: any; timestamp: number }>();

// NO TASK STORAGE - this is pure IP discovery only!

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS for all requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // Create a room (generates UUID)
    if (request.method === "POST" && pathname === "/rooms") {
      const roomId = crypto.randomUUID();
      return json({ roomId });
    }

    // Register peer IP address for discovery
    if (request.method === "POST" && pathname === "/discovery/register") {
      try {
        const { roomId, peerId } = await request.json();
        
        if (!roomId || !peerId) {
          return json({ error: "Missing required fields: roomId, peerId" }, 400);
        }

        // Get client IP from request headers
        const clientIP = request.headers.get('CF-Connecting-IP') || 
                        request.headers.get('X-Forwarded-For') || 
                        request.headers.get('X-Real-IP') || 
                        'unknown';

        // Initialize room if it doesn't exist
        if (!peerDiscovery.has(roomId)) {
          peerDiscovery.set(roomId, new Map());
        }

        const roomPeers = peerDiscovery.get(roomId)!;
        roomPeers.set(peerId, {
          ip: clientIP,
          timestamp: Date.now()
        });

        // Clean up old entries (older than 10 minutes)
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        for (const [id, data] of roomPeers.entries()) {
          if (data.timestamp < tenMinutesAgo) {
            roomPeers.delete(id);
          }
        }

        // No logging of who's in what room - privacy first!
        return json({ success: true, registeredIP: clientIP });
        
      } catch (error) {
        console.error('Error registering peer:', error);
        return json({ error: "Invalid request" }, 400);
      }
    }

    // Discover peer IP addresses in a room
    if (request.method === "GET" && pathname === "/discovery/peers") {
      const roomId = url.searchParams.get('roomId');
      const peerId = url.searchParams.get('peerId');
      
      if (!roomId || !peerId) {
        return json({ error: "Missing roomId or peerId parameter" }, 400);
      }

      const roomPeers = peerDiscovery.get(roomId) || new Map();
      
      // Return IP addresses of other peers (exclude self)
      const otherPeers = Array.from(roomPeers.entries())
        .filter(([id]) => id !== peerId)
        .map(([id, data]) => ({ peerId: id, ip: data.ip }));
      
              // No logging of discovery activity - privacy first!
      return json({ peers: otherPeers });
    }

    // NO TASK ENDPOINTS - browsers sync directly with each other!

    // WebRTC Signaling - POST offer
    if (request.method === "POST" && pathname === "/webrtc/offer") {
      try {
        const { roomId, peerId, offer } = await request.json();
        if (!roomId || !peerId || !offer) {
          return json({ error: "Missing required fields: roomId, peerId, offer" }, 400);
        }
        
        const key = `${roomId}:${peerId}`;
        signalingOffers.set(key, { offer, timestamp: Date.now() });
        
        // Cleanup old offers (2 minutes)
        const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
        for (const [k, v] of signalingOffers.entries()) {
          if (v.timestamp < twoMinutesAgo) {
            signalingOffers.delete(k);
          }
        }
        
        return json({ success: true });
      } catch (error) {
        return json({ error: "Invalid JSON" }, 400);
      }
    }

    // WebRTC Signaling - GET offer
    if (request.method === "GET" && pathname === "/webrtc/offer") {
      const roomId = url.searchParams.get('roomId');
      const peerId = url.searchParams.get('peerId');
      
      if (!roomId || !peerId) {
        return json({ error: "Missing required parameters: roomId, peerId" }, 400);
      }
      
      const key = `${roomId}:${peerId}`;
      const offerData = signalingOffers.get(key);
      
      return json({ offer: offerData?.offer || null });
    }

    // WebRTC Signaling - POST answer
    if (request.method === "POST" && pathname === "/webrtc/answer") {
      try {
        const { roomId, peerId, answer } = await request.json();
        if (!roomId || !peerId || !answer) {
          return json({ error: "Missing required fields: roomId, peerId, answer" }, 400);
        }
        
        const key = `${roomId}:${peerId}`;
        signalingAnswers.set(key, { answer, timestamp: Date.now() });
        
        // Cleanup old answers (2 minutes)
        const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
        for (const [k, v] of signalingAnswers.entries()) {
          if (v.timestamp < twoMinutesAgo) {
            signalingAnswers.delete(k);
          }
        }
        
        return json({ success: true });
      } catch (error) {
        return json({ error: "Invalid JSON" }, 400);
      }
    }

    // WebRTC Signaling - GET answer
    if (request.method === "GET" && pathname === "/webrtc/answer") {
      const roomId = url.searchParams.get('roomId');
      const peerId = url.searchParams.get('peerId');
      
      if (!roomId || !peerId) {
        return json({ error: "Missing required parameters: roomId, peerId" }, 400);
      }
      
      const key = `${roomId}:${peerId}`;
      const answerData = signalingAnswers.get(key);
      
      return json({ answer: answerData?.answer || null });
    }

    // Health check
    if (request.method === "GET" && pathname === "/health") {
      return json({ 
        status: "ok", 
        service: "IP discovery + minimal WebRTC signaling"
      });
    }

    return notFound();
  },
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(),
    },
  });
}

function notFound() {
  return json({ error: "not found" }, 404);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}