# Multi-User Testing Guide

## 🧪 **Testing 3-4 Users Simultaneously**

### **Quick Test Setup**
1. **Host device**: `http://192.168.1.40:3001` → Create room
2. **Join devices**: Same URL → Join with room ID
3. **Simulate load**: Open multiple tabs on each device

### **Test Scenarios**

#### **Scenario 1: Concurrent Task Creation**
```bash
# All users simultaneously add tasks
User 1: "Task from User 1" 
User 2: "Task from User 2"
User 3: "Task from User 3" 
User 4: "Task from User 4"

# Expected: All 4 tasks appear on all devices instantly
# Y.js CRDT ensures no conflicts! ✅
```

#### **Scenario 2: Simultaneous Edits**
```bash
# Multiple users edit the same task area
User 1: Toggle task #1 done → undone → done
User 2: Toggle task #1 undone → done  
User 3: Add new task while others edit
User 4: Join mid-session

# Expected: Final state converges consistently across all users
```

#### **Scenario 3: Network Interruption**
```bash
# Test offline resilience
1. User disconnects WiFi for 30 seconds
2. Other users continue adding/editing tasks
3. User reconnects

# Expected: Y.js syncs all missed changes automatically
```

### **Performance Monitoring**

#### **Browser DevTools Checks**
```javascript
// Check WebSocket connection in console
console.log('Connected users:', connectedUsers);
console.log('Y.js doc size:', ydoc.share.size);
console.log('WebSocket state:', provider.ws.readyState);
```

#### **Worker Logs** 
```bash
# Check Cloudflare Worker terminal output
[Room abc123] Broadcasting message to 3 other clients
[Room abc123] Client connected. Total: 4
[Room abc123] Client disconnected. Remaining: 3
```

### **Expected Results for 3-4 Users**

| Metric | **Expected** | **Excellent** |
|--------|-------------|---------------|
| **Sync Latency** | < 100ms | < 50ms |
| **Memory Usage** | < 50MB total | < 20MB total |
| **Connection Stability** | > 99% uptime | 100% uptime |
| **Conflict Resolution** | Automatic | Instant |

### **Troubleshooting Multi-User Issues**

#### **If sync is slow (>200ms):**
- Check network latency to worker
- Monitor browser memory usage
- Verify WebSocket connection stability

#### **If conflicts occur:**
- This shouldn't happen with Y.js CRDT!
- Check console for Y.js errors
- Verify all clients use same Y.js version

#### **If users can't connect:**
- Verify firewall rules allow :8787
- Check if worker is accessible: `curl http://192.168.1.40:8787/health`
- Test room creation: `curl -X POST http://192.168.1.40:8787/rooms`

### **Scaling Beyond 4 Users**

Our current setup handles:
- ✅ **1-4 users**: Perfect performance
- ✅ **5-10 users**: Excellent performance  
- ⚠️ **10-20 users**: Good performance (monitor memory)
- ❌ **20+ users**: Need Durable Objects migration

Next upgrade path: Cloudflare Durable Objects for persistent, scalable state!
