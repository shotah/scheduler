export interface Env {}

// Simple in-memory storage for UUID to IP address discovery
// Maps roomId -> Map<peerId, { ip: string, timestamp: number }>
const peerDiscovery = new Map<string, Map<string, { ip: string; timestamp: number }>>();

// Minimal WebRTC signaling for LAN-only handshake (temporary storage)
interface OfferData {
  offer: any;
  fromPeerId: string;
  targetPeerId: string;
  timestamp: number;
}

interface AnswerData {
  answer: any;
  fromPeerId: string;
  targetPeerId: string;
  timestamp: number;
}

const signalingOffers = new Map<string, OfferData>();
const signalingAnswers = new Map<string, AnswerData>();

// NO TASK STORAGE - this is pure IP discovery only!

// Helper function to extract client IP for local development
function getClientIPFromSocket(request: Request): string | null {
  try {
    // For local development, try to get IP from connection
    const url = new URL(request.url);
    
    // If it's localhost/127.0.0.1, try to get actual LAN IP
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      // In local dev, we can't detect the real client IP reliably
      // Return null to trigger IP discovery from client side
      return null;
    }
    
    return null;
  } catch {
    return null;
  }
}

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
        const { roomId, peerId, clientIP: providedIP } = await request.json();
        
        if (!roomId || !peerId) {
          return json({ error: "Missing required fields: roomId, peerId" }, 400);
        }

        // Use provided IP first (for local dev), then try headers
        const clientIP = providedIP ||
                        request.headers.get('CF-Connecting-IP') || 
                        request.headers.get('X-Forwarded-For') || 
                        request.headers.get('X-Real-IP') ||
                        request.headers.get('x-forwarded-for') ||
                        getClientIPFromSocket(request) ||
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

        // Clean up old entries (older than 8 hours - full clinic day)
        const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
        for (const [id, data] of roomPeers.entries()) {
          if (data.timestamp < eightHoursAgo) {
            roomPeers.delete(id);
          }
        }

        // Debug logging for development (remove in production)
        console.log(`🔍 [REGISTER] Room: ${roomId}, Peer: ${peerId}, IP: ${clientIP}`);
        console.log(`📊 [REGISTER] Room ${roomId} now has ${roomPeers.size} peers`);
        
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
      
      // Debug logging for development
      console.log(`🔍 [DISCOVER] Room: ${roomId}, Requester: ${peerId.substring(0,8)}...`);
      console.log(`📊 [DISCOVER] Found ${otherPeers.length} other peers:`, otherPeers.map(p => `${p.peerId.substring(0,8)}...→${p.ip}`));
      
      return json({ peers: otherPeers });
    }

    // NO TASK ENDPOINTS - browsers sync directly with each other!

    // WebRTC Signaling - POST offer
    if (request.method === "POST" && pathname === "/webrtc/offer") {
      try {
        const { roomId, peerId, targetPeerId, offer } = await request.json();
        if (!roomId || !peerId || !offer) {
          return json({ error: "Missing required fields: roomId, peerId, offer" }, 400);
        }
        
        // Store offer with room-specific key (multiple offers per room)
        // If targetPeerId specified, use targeted key; otherwise use broadcast key
        const key = targetPeerId ? `${roomId}:${targetPeerId}` : `${roomId}:broadcast:${peerId}`;
        signalingOffers.set(key, { 
          offer, 
          fromPeerId: peerId,
          targetPeerId: targetPeerId || 'broadcast',
          timestamp: Date.now() 
        });
        
        // Debug logging for development
        console.log(`📤 [OFFER] Stored offer from ${peerId.substring(0,8)}... ${targetPeerId ? `to ${targetPeerId.substring(0,8)}...` : 'as broadcast'} in room ${roomId}`);
        console.log(`📊 [OFFER] Key: ${key}, Total offers stored: ${signalingOffers.size}`);
        
        // Cleanup old offers (30 minutes - allow for breaks/delays)
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
        for (const [k, v] of signalingOffers.entries()) {
          if (v.timestamp < thirtyMinutesAgo) {
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
      
      // Look for offers targeted to this peer first
      const targetedKey = `${roomId}:${peerId}`;
      let offerData = signalingOffers.get(targetedKey);
      
      // If no targeted offer, look for broadcast offers from other peers
      if (!offerData) {
        for (const [key, data] of signalingOffers.entries()) {
          if (key.startsWith(`${roomId}:broadcast:`) && data.fromPeerId !== peerId) {
            offerData = data;
            break;
          }
        }
      }
      
      // Debug logging for development
      console.log(`📨 [GET OFFER] Request from ${peerId.substring(0,8)}... in room ${roomId}`);
      console.log(`📊 [GET OFFER] Checked targeted key: ${targetedKey}`);
      console.log(`📊 [GET OFFER] Offer ${offerData ? 'FOUND' : 'NOT FOUND'} ${offerData ? `from ${offerData.fromPeerId.substring(0,8)}...` : ''}`);
      
      if (!offerData) {
        console.log(`🔍 [GET OFFER] Available offers:`, Array.from(signalingOffers.keys()));
      }
      
      return json({ 
        offer: offerData?.offer || null,
        fromPeerId: offerData?.fromPeerId || null
      });
    }

    // WebRTC Signaling - POST answer
    if (request.method === "POST" && pathname === "/webrtc/answer") {
      try {
        const { roomId, peerId, targetPeerId, answer } = await request.json();
        if (!roomId || !peerId || !answer) {
          return json({ error: "Missing required fields: roomId, peerId, answer" }, 400);
        }
        
        // Store answer targeted to the original offer sender
        const key = targetPeerId ? `${roomId}:${targetPeerId}` : `${roomId}:${peerId}`;
        signalingAnswers.set(key, { 
          answer, 
          fromPeerId: peerId,
          targetPeerId: targetPeerId || 'unknown',
          timestamp: Date.now() 
        });
        
        // Debug logging for development
        console.log(`📥 [ANSWER] Stored answer from ${peerId.substring(0,8)}... ${targetPeerId ? `to ${targetPeerId.substring(0,8)}...` : 'as broadcast'} in room ${roomId}`);
        console.log(`📊 [ANSWER] Key: ${key}, Total answers stored: ${signalingAnswers.size}`);
        
        // Cleanup old answers (30 minutes - allow for breaks/delays)
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
        for (const [k, v] of signalingAnswers.entries()) {
          if (v.timestamp < thirtyMinutesAgo) {
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
      
      // Debug logging for development
      console.log(`📨 [GET ANSWER] Request from ${peerId.substring(0,8)}... in room ${roomId}`);
      console.log(`📊 [GET ANSWER] Answer ${answerData ? 'FOUND' : 'NOT FOUND'} for key: ${key}`);
      
      if (!answerData) {
        console.log(`🔍 [GET ANSWER] Available answers:`, Array.from(signalingAnswers.keys()));
      }
      
      return json({ answer: answerData?.answer || null });
    }

    // Debug endpoint to view current state
    if (request.method === "GET" && pathname === "/debug") {
      return json({
        status: "debug",
        timestamp: new Date().toISOString(),
        rooms: Array.from(peerDiscovery.entries()).map(([roomId, peers]) => ({
          roomId,
          peerCount: peers.size,
          peers: Array.from(peers.entries()).map(([peerId, data]) => ({
            peerId: peerId.substring(0,8) + '...',
            ip: data.ip,
            age: Math.round((Date.now() - data.timestamp) / 1000) + 's'
          }))
        })),
        offers: {
          count: signalingOffers.size,
          keys: Array.from(signalingOffers.keys())
        },
        answers: {
          count: signalingAnswers.size,
          keys: Array.from(signalingAnswers.keys())
        }
      });
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