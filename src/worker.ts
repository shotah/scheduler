export interface Env {}

// Cloudflare Workers WebSocket API types  
declare const WebSocketPair: {
  new(): [WebSocket, WebSocket];
};

interface CloudflareWebSocket extends WebSocket {
  accept(): void;
}

// Store WebSocket connections for each room
const roomConnections = new Map<string, Set<WebSocket>>();

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // Create a room
    if (request.method === "POST" && pathname === "/rooms") {
      const roomId = crypto.randomUUID();
      roomConnections.set(roomId, new Set());
      return json({ roomId });
    }

    // WebSocket upgrade for Y.js collaboration
    // Y.js WebsocketProvider sends to /rooms/ROOM_ID format
    const roomMatch = pathname.match(/^\/rooms\/([^/]+)$/);
    if (roomMatch && request.headers.get("Upgrade") === "websocket") {
      const roomId = roomMatch[1];
      
      // Ensure room exists
      if (!roomConnections.has(roomId)) {
        roomConnections.set(roomId, new Set());
      }

      const [client, server] = new WebSocketPair();
      (server as CloudflareWebSocket).accept();
      
      // Add to room
      const connections = roomConnections.get(roomId)!;
      connections.add(server);

      // Handle messages - broadcast to all other clients in the room
      server.addEventListener('message', (event: MessageEvent) => {
        console.log(`[Room ${roomId}] Broadcasting message to ${connections.size - 1} other clients`);
        const data = event.data;
        connections.forEach(ws => {
          if (ws !== server && ws.readyState === 1) { // 1 = OPEN
            ws.send(data);
          }
        });
      });

      // Clean up on close
      server.addEventListener('close', () => {
        console.log(`[Room ${roomId}] Client disconnected. Remaining: ${connections.size - 1}`);
        connections.delete(server);
        if (connections.size === 0) {
          console.log(`[Room ${roomId}] Room empty, cleaning up`);
          roomConnections.delete(roomId);
        }
      });

      console.log(`[Room ${roomId}] Client connected. Total: ${connections.size}`);

      return new Response(null, {
        status: 101,
        // @ts-ignore - Cloudflare Workers WebSocket API
        webSocket: client,
        headers: corsHeaders(),
      });
    }

    // Health check
    if (request.method === "GET" && pathname === "/health") {
      return json({ 
        status: "ok", 
        activeRooms: roomConnections.size,
        totalConnections: Array.from(roomConnections.values())
          .reduce((sum, conns) => sum + conns.size, 0)
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
