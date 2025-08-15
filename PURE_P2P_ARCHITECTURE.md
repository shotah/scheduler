# Pure P2P Architecture - NEVER FORGET

This document ensures we never accidentally implement server-side data storage again.

## 🎯 Core Principle: SERVERLESS P2P

**The worker is a PHONE BOOK, not a database.**

## What the Worker Does (ONLY)

```
POST /rooms → Generate UUID
POST /discovery/register → Store roomId + IP mapping  
GET /discovery/peers → Return other IPs for a room
GET /health → "IP discovery only"
```

## What the Worker NEVER Does

- ❌ Store tasks, user data, or any application state
- ❌ Handle WebRTC signaling or relay messages
- ❌ Track user connections or analytics  
- ❌ Sync data between browsers
- ❌ Validate, transform, or process task data

## How P2P Actually Works

1. **Tech A** creates room → gets UUID from worker
2. **Tech A** registers IP → worker maps UUID → IP
3. **Tech B** joins UUID → worker gives Tech B the IP of Tech A  
4. **Tech B** connects DIRECTLY to Tech A's browser
5. **All task sync happens browser ↔ browser**
6. **Worker is completely out of the loop**

## Browser-to-Browser Sync (Current POC)

- **Storage**: localStorage in each browser
- **Discovery**: Use worker to find peer IPs
- **Sync**: Periodic polling between browsers (will evolve to real HTTP)
- **Conflicts**: Last-writer-wins (simple for POC)

## Future P2P Enhancements

- **Direct HTTP servers in browsers** (Service Worker HTTP endpoints)
- **WebRTC data channels** for real-time sync (WITHOUT signaling server)
- **Encrypted browser-to-browser** communication
- **Local network auto-discovery** (eliminate worker entirely)

## RED FLAGS - Never Implement

If anyone suggests these, STOP and refer to this document:

- "Let's store tasks in the worker temporarily"
- "Let's add WebRTC signaling to the worker" 
- "Let's track connected users in the worker"
- "Let's add a database for persistence"
- "Let's proxy data through the worker"

## The Test

If the worker goes down permanently, existing browser connections should keep working and syncing tasks. The worker is only needed for NEW room discovery.

---

**Remember: We're building a P2P app that happens to use a minimal discovery service, NOT a server app with P2P features.**
