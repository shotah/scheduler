import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoom, registerPeer, discoverPeers, sendWebRTCOffer, getWebRTCOffer, sendWebRTCAnswer, getWebRTCAnswer } from '../signaling';

export type Task = { id: string; text: string; done: boolean };
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface UseDirectP2PSyncReturn {
  tasks: Task[];
  connectionState: ConnectionState;
  connectionStatus: string;
  connectedUsers: number;
  connect: (roomId: string) => Promise<void>;
  disconnect: () => void;
  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  createRoom: () => Promise<string>;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function useDirectP2PSync(): UseDirectP2PSyncReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionStatus, setConnectionStatus] = useState<string>('Not connected');
  const [connectedUsers, setConnectedUsers] = useState<number>(0);
  
  const currentRoomRef = useRef<string | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peerIpsRef = useRef<string[]>([]);
  const isHostRef = useRef<boolean>(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const myPeerIdRef = useRef<string>(generateUUID());

  // Save tasks to localStorage
  const saveTasks = useCallback((newTasks: Task[]) => {
    const roomId = currentRoomRef.current;
    if (roomId) {
      localStorage.setItem(`tasks_${roomId}`, JSON.stringify(newTasks));
    }
  }, []);

  // Load tasks from localStorage
  const loadTasks = useCallback((roomId: string): Task[] => {
    try {
      const saved = localStorage.getItem(`tasks_${roomId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  // Simple HTTP server simulation using Service Worker or direct peer communication
  // For POC, we'll use localStorage + polling for same-origin communication
  const syncWithPeers = useCallback(async () => {
    const roomId = currentRoomRef.current;
    if (!roomId) return;

    try {
      // Discover current peers
      const myPeerId = myPeerIdRef.current;
      const discoveredPeers = await discoverPeers(roomId, myPeerId);
      const currentPeerIps = discoveredPeers.map(p => p.ip);
      
      // Update connected users count
      setConnectedUsers(currentPeerIps.length + 1); // +1 for self
      
      // Load local tasks
      const currentTasks = loadTasks(roomId);
      setTasks(currentTasks);
      
      // Establish WebRTC P2P connections with discovered peers
      if (discoveredPeers.length > 0 && !peerConnectionRef.current) {
        console.log('🔄 Establishing WebRTC P2P connections:', discoveredPeers);
        
        try {
          if (isHostRef.current) {
            // Host creates offers to all joiners
            for (const peer of discoveredPeers) {
              await createWebRTCConnection(roomId, peer.peerId);
              break; // For now, just connect to first peer
            }
          } else {
            // Joiner looks for incoming offers from host
            await handleIncomingOffer(roomId);
          }
        } catch (error) {
          console.warn('WebRTC connection attempt failed, continuing with basic connection:', error);
        }
      }
      
      // Sync tasks via active WebRTC data channels
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        const message = {
          type: 'TASK_SYNC',
          tasks: currentTasks,
          timestamp: Date.now(),
          peerId: myPeerId
        };
        dataChannelRef.current.send(JSON.stringify(message));
        console.log('📡 Synced tasks via WebRTC data channel');
      }
      
      peerIpsRef.current = currentPeerIps;
      
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  }, [loadTasks]);

  // Merge two task lists with conflict resolution
  const mergeTaskLists = useCallback((local: Task[], remote: Task[]): Task[] => {
    const taskMap = new Map<string, Task>();
    
    // Add local tasks first
    local.forEach(task => taskMap.set(task.id, task));
    
    // Add remote tasks (will overwrite local if IDs match - last writer wins)
    remote.forEach(task => taskMap.set(task.id, task));
    
    return Array.from(taskMap.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  // Create LAN-only WebRTC connection (host side)
  const createWebRTCConnection = useCallback(async (roomId: string, targetPeerId: string) => {
    try {
      console.log('🔗 Creating LAN-only WebRTC connection to:', targetPeerId);
      console.log('🔍 Debug: WebRTC Configuration - LAN-only mode to avoid hairpin NAT issues');
      
      // Create peer connection with NO external servers (LAN-only!)
      // Force real IP candidates instead of mDNS
      const peerConnection = new RTCPeerConnection({
        iceServers: [], // LAN-only - no external STUN to avoid hairpin NAT issues
        iceCandidatePoolSize: 10,
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require'
      });
      
      peerConnectionRef.current = peerConnection;
      
      // Enhanced logging for connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('🔄 WebRTC Connection State:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          console.log('🎉 P2P CONNECTION ESTABLISHED! Direct browser-to-browser link active');
        } else if (peerConnection.connectionState === 'failed') {
          console.error('❌ P2P CONNECTION FAILED! Check firewall/network settings');
        }
      };
      
      // ICE connection state logging
      peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE Connection State:', peerConnection.iceConnectionState);
        
        if (peerConnection.iceConnectionState === 'failed') {
          console.error('❌ ICE connection failed - likely firewall blocking WebRTC ports');
          console.log('🔧 Try running: debug-firewall-setup.bat as Administrator');
        } else if (peerConnection.iceConnectionState === 'disconnected') {
          console.warn('⚠️ ICE connection disconnected');
        } else if (peerConnection.iceConnectionState === 'connected') {
          console.log('✅ ICE connection successful!');
        }
      };
      
      // ICE candidate logging with IP preference
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const isActualIP = event.candidate.address && 
                           !event.candidate.address.endsWith('.local') &&
                           /^\d+\.\d+\.\d+\.\d+$/.test(event.candidate.address);
          
          console.log(`🗳️ ICE Candidate found (${isActualIP ? 'REAL IP' : 'mDNS'}):`, {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
            priority: event.candidate.priority
          });
          
          if (!isActualIP && event.candidate.address.endsWith('.local')) {
            console.warn('⚠️ mDNS candidate detected - may cause connection issues between devices');
            console.log('💡 Suggestion: Both devices are on same LAN, try disabling mDNS in Chrome');
            console.log('💡 Alternative: Chrome flag --force-webrtc-ip-handling-policy=default');
          } else if (isActualIP && event.candidate.address.startsWith('192.168.')) {
            console.log('🎉 PERFECT! Found LAN IP candidate - this should work!');
          }
        } else {
          console.log('🏁 ICE candidate gathering complete');
        }
      };
      
      // Create data channel for task sync
      const dataChannel = peerConnection.createDataChannel('tasks', {
        ordered: true
      });
      
      dataChannelRef.current = dataChannel;
      
      // Handle data channel messages
      dataChannel.onopen = () => {
        console.log('🎉 WebRTC data channel opened - ready for P2P sync!');
        console.log('🔍 Data channel details:', {
          label: dataChannel.label,
          protocol: dataChannel.protocol,
          readyState: dataChannel.readyState,
          bufferedAmount: dataChannel.bufferedAmount
        });
        setConnectionStatus('Connected! 🎉 Real-time P2P active');
      };
      
      // Monitor data channel state transitions with timeout
      let connectingTimeout = 0;
      const monitorDataChannel = () => {
        console.log('📊 Data channel state:', dataChannel.readyState);
        if (dataChannel.readyState === 'connecting') {
          connectingTimeout++;
          console.log(`⏳ Data channel connecting... waiting for ICE to complete (${connectingTimeout}/30)`);
          
          if (connectingTimeout >= 30) {
            console.error('❌ Data channel connection timeout after 30 seconds');
            console.log('🔧 This suggests a firewall or NAT issue blocking the connection');
            setConnectionStatus('Connection timeout - check firewall settings');
            return;
          }
          
          setTimeout(monitorDataChannel, 1000);
        } else if (dataChannel.readyState === 'open') {
          console.log('✅ Data channel fully opened!');
          connectingTimeout = 0;
        } else if (dataChannel.readyState === 'closed') {
          console.log('❌ Data channel closed');
        }
      };
      setTimeout(monitorDataChannel, 100);
      
      dataChannel.onerror = (error) => {
        console.error('❌ Data channel error:', error);
      };
      
      dataChannel.onclose = () => {
        console.log('🔌 Data channel closed');
        setConnectionStatus('Connection lost - attempting to reconnect...');
      };
      
      dataChannel.onmessage = (event) => {
        try {
          console.log('📨 Raw message received:', event.data.length, 'bytes');
          const message = JSON.parse(event.data);
          console.log('📡 Parsed message:', {
            type: message.type,
            taskCount: message.tasks?.length || 0,
            peerId: message.peerId,
            timestamp: new Date(message.timestamp).toLocaleTimeString()
          });
          
          if (message.type === 'TASK_SYNC') {
            console.log('🔄 Processing task sync from peer:', message.peerId);
            const currentTasks = loadTasks(roomId);
            console.log('📋 Current local tasks:', currentTasks.length);
            console.log('📋 Incoming remote tasks:', message.tasks.length);
            
            const mergedTasks = mergeTaskLists(currentTasks, message.tasks);
            console.log('🔀 Merged task count:', mergedTasks.length);
            
            setTasks(mergedTasks);
            saveTasks(mergedTasks);
            console.log('✅ Task sync completed successfully');
          }
        } catch (error) {
          console.error('❌ Error handling WebRTC message:', error);
          console.error('Raw data that failed to parse:', event.data);
        }
      };
      
      // Create offer and send via signaling
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      await sendWebRTCOffer(roomId, myPeerIdRef.current, offer, targetPeerId);
      console.log('📤 Sent WebRTC offer via signaling server');
      
      // Wait for answer
      const checkForAnswer = async () => {
        const answer = await getWebRTCAnswer(roomId, myPeerIdRef.current);
        if (answer) {
          await peerConnection.setRemoteDescription(answer);
          console.log('📨 Received WebRTC answer - P2P connection established!');
        } else {
          // Keep checking for answer
          setTimeout(checkForAnswer, 1000);
        }
      };
      checkForAnswer();
      
    } catch (error) {
      console.error('❌ WebRTC connection failed:', error);
    }
  }, [loadTasks, saveTasks, mergeTaskLists]);

  // Handle incoming WebRTC offers (joiner side)
  const handleIncomingOffer = useCallback(async (roomId: string) => {
    try {
      const myPeerId = myPeerIdRef.current;
      const { offer, fromPeerId } = await getWebRTCOffer(roomId, myPeerId);
      if (!offer) {
        console.log('🔍 No WebRTC offer found yet, will check again later');
        return;
      }
      
      console.log('📨 Received WebRTC offer from', fromPeerId?.substring(0,8) + '...', 'creating answer...');
      
      // Create peer connection with NO external servers (LAN-only!)
      // Force real IP candidates instead of mDNS
      const peerConnection = new RTCPeerConnection({
        iceServers: [], // LAN-only - no external STUN to avoid hairpin NAT issues
        iceCandidatePoolSize: 10,
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require'
      });
      
      peerConnectionRef.current = peerConnection;
      
      // Handle incoming data channel
      peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        dataChannelRef.current = dataChannel;
        console.log('📞 Incoming data channel received:', dataChannel.label);
        
        dataChannel.onopen = () => {
          console.log('🎉 WebRTC data channel opened (incoming)');
          console.log('🔍 Incoming data channel details:', {
            label: dataChannel.label,
            protocol: dataChannel.protocol,
            readyState: dataChannel.readyState
          });
          setConnectionStatus('Connected! 🎉 Real-time P2P sync active');
        };
        
        dataChannel.onerror = (error) => {
          console.error('❌ Incoming data channel error:', error);
        };
        
        dataChannel.onclose = () => {
          console.log('🔌 Incoming data channel closed');
          setConnectionStatus('Connection lost - attempting to reconnect...');
        };
        
        dataChannel.onmessage = (event) => {
          try {
            console.log('📨 Raw message received (joiner):', event.data.length, 'bytes');
            const message = JSON.parse(event.data);
            console.log('📡 Parsed message (joiner):', {
              type: message.type,
              taskCount: message.tasks?.length || 0,
              peerId: message.peerId,
              timestamp: new Date(message.timestamp).toLocaleTimeString()
            });
            
            if (message.type === 'TASK_SYNC') {
              console.log('🔄 Processing task sync from peer (joiner):', message.peerId);
              const currentTasks = loadTasks(roomId);
              console.log('📋 Current local tasks (joiner):', currentTasks.length);
              console.log('📋 Incoming remote tasks (joiner):', message.tasks.length);
              
              const mergedTasks = mergeTaskLists(currentTasks, message.tasks);
              console.log('🔀 Merged task count (joiner):', mergedTasks.length);
              
              setTasks(mergedTasks);
              saveTasks(mergedTasks);
              console.log('✅ Task sync completed successfully (joiner)');
            }
          } catch (error) {
            console.error('❌ Error handling WebRTC message (joiner):', error);
            console.error('Raw data that failed to parse (joiner):', event.data);
          }
        };
      };
      
      // Set remote offer and create answer
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Send answer via signaling, targeted to the offer sender
      await sendWebRTCAnswer(roomId, myPeerId, answer, fromPeerId || undefined);
      console.log('📤 Sent WebRTC answer via signaling server to', fromPeerId?.substring(0,8) + '...');
      
    } catch (error) {
      console.error('❌ Error handling WebRTC offer:', error);
    }
  }, [loadTasks, saveTasks, mergeTaskLists]);

  const connect = useCallback(async (roomId: string) => {
    console.log('🔗 Starting pure P2P connection to room:', roomId);
    
    // Clean up existing connection
    disconnect();
    
    currentRoomRef.current = roomId;
    setConnectionState('connecting');
    setConnectionStatus('Registering with discovery service...');

    try {
               // Register with discovery service to get IP mapping
         const myPeerId = myPeerIdRef.current;
         await registerPeer(roomId, myPeerId);
      console.log('✅ Registered IP with discovery service');
      
      // Load existing tasks from localStorage
      const existingTasks = loadTasks(roomId);
      setTasks(existingTasks);
      
      // Removed problematic delay that was causing E2E test failures
      
               // Check if we're the first peer (host)
         const discoveredPeers = await discoverPeers(roomId, myPeerId);
      isHostRef.current = discoveredPeers.length === 0;
      
      setConnectionState('connected');
      setConnectionStatus(isHostRef.current ? 
        'Connected as host! 🎉 Waiting for others...' : 
        'Connected! 🎉 Syncing with peers...'
      );
      setConnectedUsers(discoveredPeers.length + 1);
      
      // Start periodic sync with other peers
      syncIntervalRef.current = setInterval(syncWithPeers, 3000);
      
               // Initial sync
         await syncWithPeers();
         
         console.log('🎯 Connection completed successfully!');
      
    } catch (error) {
      console.error('❌ Connection failed:', error);
      setConnectionState('disconnected');
      setConnectionStatus('Connection failed');
    }
  }, [loadTasks, syncWithPeers]);

  const disconnect = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    
    // Clean up WebRTC connections
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    currentRoomRef.current = null;
    peerIpsRef.current = [];
    isHostRef.current = false;
    setConnectionState('disconnected');
    setConnectionStatus('Not connected');
    setConnectedUsers(0);
  }, []);

  const addTask = useCallback((text: string) => {
    const newTask: Task = {
      id: generateUUID(),
      text,
      done: false
    };
    
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    
    // Broadcast via WebRTC data channel
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      const message = {
        type: 'TASK_SYNC',
        tasks: updatedTasks,
        timestamp: Date.now(),
        peerId: myPeerIdRef.current
      };
      const messageStr = JSON.stringify(message);
      console.log('📤 Broadcasting new task via WebRTC:', {
        taskCount: updatedTasks.length,
        messageSize: messageStr.length,
        dataChannelState: dataChannelRef.current.readyState,
        bufferedAmount: dataChannelRef.current.bufferedAmount
      });
      dataChannelRef.current.send(messageStr);
      console.log('✅ Task broadcast completed');
    } else {
      console.log('⚠️ Task added locally only - WebRTC not ready:', {
        hasDataChannel: !!dataChannelRef.current,
        readyState: dataChannelRef.current?.readyState || 'null'
      });
    }
    
  }, [tasks, saveTasks]);

  const toggleTask = useCallback((id: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    
    // Broadcast via WebRTC data channel
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      const message = {
        type: 'TASK_SYNC',
        tasks: updatedTasks,
        timestamp: Date.now(),
        peerId: myPeerIdRef.current
      };
      const messageStr = JSON.stringify(message);
      console.log('📤 Broadcasting task toggle via WebRTC:', {
        toggledTaskId: id,
        taskCount: updatedTasks.length,
        messageSize: messageStr.length,
        dataChannelState: dataChannelRef.current.readyState,
        bufferedAmount: dataChannelRef.current.bufferedAmount
      });
      dataChannelRef.current.send(messageStr);
      console.log('✅ Task toggle broadcast completed');
    } else {
      console.log('⚠️ Task toggled locally only - WebRTC not ready:', {
        hasDataChannel: !!dataChannelRef.current,
        readyState: dataChannelRef.current?.readyState || 'null'
      });
    }
    
  }, [tasks, saveTasks]);

  const createRoomWrapper = useCallback(async (): Promise<string> => {
    return await createRoom();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    tasks,
    connectionState,
    connectionStatus,
    connectedUsers,
    connect,
    disconnect,
    addTask,
    toggleTask,
    createRoom: createRoomWrapper
  };
}
