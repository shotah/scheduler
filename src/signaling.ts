const BASE = import.meta.env.VITE_SIGNAL_URL || "http://127.0.0.1:8787"; // Discovery service URL

export async function createRoom(): Promise<string> {
  const res = await fetch(`${BASE}/rooms`, { method: "POST" });
  const { roomId } = await res.json();
  return roomId;
}

// Register this peer's IP address for discovery
export async function registerPeer(roomId: string, peerId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/discovery/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, peerId }),
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
export async function sendWebRTCOffer(roomId: string, peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
  const response = await fetch(`${BASE}/webrtc/offer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomId, peerId, offer }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send WebRTC offer: ${response.statusText}`);
  }
}

export async function getWebRTCOffer(roomId: string, peerId: string): Promise<RTCSessionDescriptionInit | null> {
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
  return data.offer;
}

export async function sendWebRTCAnswer(roomId: string, peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
  const response = await fetch(`${BASE}/webrtc/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomId, peerId, answer }),
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
