const BASE = import.meta.env.VITE_SIGNAL_URL || "http://127.0.0.1:8787"; // e.g. https://webrtc-signal.yourdomain.workers.dev

export async function createRoom(): Promise<string> {
  const res = await fetch(`${BASE}/rooms`, { method: "POST" });
  const { roomId } = await res.json();
  return roomId;
}

export async function postOffer(roomId: string, offer: any) {
  await fetch(`${BASE}/rooms/${roomId}/offer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(offer),
  });
}

export async function getOffer(roomId: string) {
  const res = await fetch(`${BASE}/rooms/${roomId}/offer`);
  return res.json();
}

export async function postAnswer(roomId: string, answer: any) {
  await fetch(`${BASE}/rooms/${roomId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answer),
  });
}

export async function getAnswer(roomId: string) {
  const res = await fetch(`${BASE}/rooms/${roomId}/answer`);
  return res.json();
}
