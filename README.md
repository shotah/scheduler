# scheduler
p2p scheduling service

- Hosts the SPA on Cloudflare Pages (or wherever).
- Uses a tiny Cloudflare Worker only to pass SDP offers/answers between two peers.
- LAN-only WebRTC (no STUN/TURN) → works perfectly on same network without any configuration.
- Uses Y.js (CRDT) for conflict-free real-time collaboration via WebSockets.

## Roadmap (quick)

Today

- Ship this LAN-only prototype.
- Validate the UX promise: “No cloud DB. We only connect you once.”

Next

- ✅ Migrated to Y.js (CRDT) for bulletproof real-time collaboration
- Move Worker state to Durable Objects.
- Add optional TURN (paid plan) for off-LAN / remote sync.

Later

- Package a local helper (brew/choco) for truly serverless discovery (no Worker at all).
- Ship export/import/backup to encrypted file.

Want me to:

- Refactor the client to use Y.js + y-webrtc against this same Worker?
- Rewrite the Worker using Durable Objects so it’s production-stable?
- Add a TURN-enabled paid tier path (architecture + code)?
- Tell me which direction you want to harden first, and I’ll ship the next code drop. 💪


## Structure:

### Cloudflare Worker (signaling relay)

Job: store & relay offer, answer, and (optionally) ICE candidates for a room.
This is the bare-bones prototype. For production, move the state to Durable Objects / KV.

src/worker.ts

### React SPA (very small demo)

Key choices:

- Y.js CRDT → automatic conflict resolution, works across any network.
- No trickle ICE → we wait until ICE gathering is complete and send a single SDP blob (simplifies signaling).
- Y.js CRDT for conflict-free collaborative editing.

src/signaling.ts
src/webrtc.ts
src/App.tsx

## Quick Start

### 1. Setup
```bash
npm run setup
```

### 2. Development (runs both frontend and worker)
```bash
npm start
```

This will start:
- **Cloudflare Worker** (WebSocket relay) on `http://0.0.0.0:8787`
- **React Frontend** on `http://0.0.0.0:3000` (or 3001 if 3000 is busy)

### 🌐 LAN Access Setup

To access from other devices on your network:

1. **Check your IP address:**
   ```bash
   # Quick way - just run ipconfig and look for your WiFi/Ethernet adapter
   ipconfig
   
   # Or use our filtered script
   npm run network:info
   npm run network:urls
   ```
   
   Look for an IP like `192.168.x.x` or `10.x.x.x` (not `172.x.x.x` - that's Docker!)

2. **Allow through Windows Firewall:**
   ```bash
   # Allow inbound connections (run as Administrator)
   netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=3000
   netsh advfirewall firewall add rule name="Cloudflare Worker Dev" dir=in action=allow protocol=TCP localport=8787
   ```

3. **Update signaling URL** in other device's browser:
   - Instead of `127.0.0.1:8787`, use your actual IP (from step 1)
   - Or set `VITE_SIGNAL_URL=http://YOUR_IP:8787` in .env

### 3. Test P2P Sync

**Local Testing (same device):**
1. Open `http://localhost:3001` in your browser (check terminal for actual port)
2. Click **"Host workspace"** to create a room
3. Copy the room ID that appears
4. Open another browser tab/window to `http://localhost:3001`
5. Enter the room ID and click **"Join"**
6. Add tasks on either side - they sync in real-time via Y.js CRDT! 🎉

**LAN Testing (multiple devices):**
1. Find your IP: `npm run network:info` (look for 192.168.x.x)
2. On host device: Go to `http://YOUR_IP:3001` and create room
3. On other device: Go to `http://YOUR_IP:3001` and join room
4. Tasks sync instantly via Y.js WebSocket with automatic conflict resolution! 🌐

**Note**: Y.js CRDT provides automatic conflict resolution and works reliably across any network via WebSocket. No more WebRTC headaches!

**Development Note**: When you restart the worker dev server (`npm run worker:dev`), room data is cleared but rooms auto-recreate when accessed. URLs and room IDs remain valid!

### Alternative Commands

```bash
# Run components separately
npm run worker:dev    # Just the signaling server
npm run dev          # Just the frontend

# Test the connection
npm run test:connection

# Get network info for LAN access
npm run network:info

# Build for production
npm run build

# Keep dependencies up to date
npm run upgrade:check    # Check for available updates
npm run upgrade          # Upgrade all dependencies to latest

# Deploy to Cloudflare
npm run worker:deploy    # Deploy worker
npm run pages:deploy     # Deploy frontend to Pages
```

## Deploy

### Worker (Signaling Server)
```bash
npm run worker:deploy
```

### Frontend (Cloudflare Pages)
```bash
npm run pages:deploy
```

Update `.env.production` with your deployed worker URL before deploying the frontend.


# Allow inbound connections for both ports
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Cloudflare Worker Dev" dir=in action=allow protocol=TCP localport=8787