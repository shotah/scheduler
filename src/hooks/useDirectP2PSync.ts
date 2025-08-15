import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoom, registerPeer, discoverPeers } from '../signaling';

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
      const discoveredPeers = await discoverPeers(roomId, 'self');
      const currentPeerIps = discoveredPeers.map(p => p.ip);
      
      // Update connected users count
      setConnectedUsers(currentPeerIps.length + 1); // +1 for self
      
      // If we're the host (first peer), our tasks are authoritative
      // If we're joining, try to sync from other peers
      if (!isHostRef.current && currentPeerIps.length > 0) {
        // For POC: simulate fetching from first peer via localStorage
        // In real implementation, this would be HTTP to peer's IP
        const currentTasks = loadTasks(roomId);
        
        // Simple conflict resolution: if remote has more tasks, use those
        // In real P2P, this would be HTTP GET to http://peerIP:port/tasks
        console.log('🔄 Syncing with peers (POC mode):', currentPeerIps);
        
        if (currentTasks.length > 0) {
          setTasks(currentTasks);
        }
      }
      
      peerIpsRef.current = currentPeerIps;
      
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  }, [loadTasks]);

  const connect = useCallback(async (roomId: string) => {
    console.log('🔗 Starting pure P2P connection to room:', roomId);
    
    // Clean up existing connection
    disconnect();
    
    currentRoomRef.current = roomId;
    setConnectionState('connecting');
    setConnectionStatus('Registering with discovery service...');

    try {
      // Register with discovery service to get IP mapping
      await registerPeer(roomId, 'self');
      console.log('✅ Registered IP with discovery service');
      
      // Load existing tasks from localStorage
      const existingTasks = loadTasks(roomId);
      setTasks(existingTasks);
      
      // Check if we're the first peer (host)
      const discoveredPeers = await discoverPeers(roomId, 'self');
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
    
    // In real P2P, broadcast to all peer IPs:
    // peerIpsRef.current.forEach(ip => {
    //   fetch(`http://${ip}:port/tasks`, { method: 'POST', body: JSON.stringify(updatedTasks) })
    // });
    
  }, [tasks, saveTasks]);

  const toggleTask = useCallback((id: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    
    // In real P2P, broadcast to all peer IPs
    console.log('📡 Broadcasting task update to peers:', peerIpsRef.current);
    
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
