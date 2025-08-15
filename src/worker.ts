export interface Env {}

// Simple in-memory storage for UUID to IP address discovery
// Maps roomId -> Map<peerId, { ip: string, timestamp: number }>
const peerDiscovery = new Map<string, Map<string, { ip: string; timestamp: number }>>();

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

    // Health check
    if (request.method === "GET" && pathname === "/health") {
      return json({ 
        status: "ok", 
        service: "IP discovery only"
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