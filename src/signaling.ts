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
