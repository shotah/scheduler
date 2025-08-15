const BASE = import.meta.env.VITE_SIGNAL_URL || "http://127.0.0.1:8787"; // Discovery service URL

export async function createRoom(): Promise<string> {
  const res = await fetch(`${BASE}/rooms`, { method: "POST" });
  const { roomId } = await res.json();
  return roomId;
}

// Get client's own IP address for local network discovery
async function getClientIP(): Promise<string | null> {
  try {
    // For local development, extract IP from the discovery service URL
    const BASE_URL = import.meta.env.VITE_SIGNAL_URL || "http://127.0.0.1:8787";
    const url = new URL(BASE_URL);
    
    // If using a LAN IP for the discovery service, use that same IP
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      console.log('🏠 Using LAN IP from discovery service URL:', url.hostname);
      return url.hostname;
    }
    
    // Fallback: try to get local IP via WebRTC ICE candidates
    try {
      const pc = new RTCPeerConnection({iceServers:[]});
      pc.createDataChannel('test');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pc.close();
          resolve(null);
        }, 2000);
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const match = event.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (match && match[1] && !match[1].startsWith('127.') && !match[1].startsWith('169.254.')) {
              clearTimeout(timeout);
              pc.close();
              console.log('🗳️ Detected LAN IP via ICE candidate:', match[1]);
              resolve(match[1]);
            }
          }
        };
      });
    } catch (error) {
      console.warn('WebRTC IP detection failed:', error);
      return null;
    }
  } catch (error) {
    console.warn('Client IP detection failed:', error);
    return null;
  }
}

// Register this peer's IP address for discovery
export async function registerPeer(roomId: string, peerId: string): Promise<string | null> {
  try {
    // Auto-detect client IP for local development
    const clientIP = await getClientIP();
    console.log('🔍 Auto-detected client IP:', clientIP || 'detection failed');
    
    const res = await fetch(`${BASE}/discovery/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, peerId, clientIP }),
    });
    const data = await res.json();
    return data.success ? data.registeredIP : null;
  } catch (error) {
    console.error('Failed to register peer:', error);
    return null;
  }
}

// Discover other peers' IP addresses in the room
export async function discoverPeers(roomId: string, peerId: string): Promise<Array<{ peerId: string; ip: string }>> {
  try {
    const res = await fetch(`${BASE}/discovery/peers?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent(peerId)}`);
    const data = await res.json();
    return data.peers || [];
  } catch (error) {
    console.error('Failed to discover peers:', error);
    return [];
  }
}

// WebRTC Signaling Functions for LAN-only P2P
export async function sendWebRTCOffer(roomId: string, peerId: string, offer: RTCSessionDescriptionInit, targetPeerId?: string): Promise<void> {
  const response = await fetch(`${BASE}/webrtc/offer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomId, peerId, targetPeerId, offer }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send WebRTC offer: ${response.statusText}`);
  }
}

export async function getWebRTCOffer(roomId: string, peerId: string): Promise<{offer: RTCSessionDescriptionInit | null; fromPeerId: string | null}> {
  const response = await fetch(`${BASE}/webrtc/offer?roomId=${roomId}&peerId=${peerId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get WebRTC offer: ${response.statusText}`);
  }

  const data = await response.json();
  return { offer: data.offer, fromPeerId: data.fromPeerId };
}

export async function sendWebRTCAnswer(roomId: string, peerId: string, answer: RTCSessionDescriptionInit, targetPeerId?: string): Promise<void> {
  const response = await fetch(`${BASE}/webrtc/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomId, peerId, targetPeerId, answer }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send WebRTC answer: ${response.statusText}`);
  }
}

export async function getWebRTCAnswer(roomId: string, peerId: string): Promise<RTCSessionDescriptionInit | null> {
  const response = await fetch(`${BASE}/webrtc/answer?roomId=${roomId}&peerId=${peerId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get WebRTC answer: ${response.statusText}`);
  }

  const data = await response.json();
  return data.answer;
}
