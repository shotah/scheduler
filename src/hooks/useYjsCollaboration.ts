import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export type Task = { id: string; text: string; done: boolean };
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface UseYjsCollaborationReturn {
  tasks: Task[];
  connectionState: ConnectionState;
  connectionStatus: string;
  connectedUsers: number;
  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  connect: (roomId: string) => void;
  disconnect: () => void;
}

// UUID generator with fallback for older browsers
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function useYjsCollaboration(): UseYjsCollaborationReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [connectedUsers, setConnectedUsers] = useState<number>(0);
  
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const ytasksRef = useRef<Y.Array<Task> | null>(null);

  const updateTasksFromYjs = useCallback(() => {
    if (ytasksRef.current) {
      const yjsTasks = ytasksRef.current.toArray();
      console.log('Updating from Y.js:', yjsTasks.length, 'tasks');
      setTasks(yjsTasks);
    }
  }, []);

  const connect = useCallback((roomId: string) => {
    console.log('Connecting to Y.js room:', roomId);
    
    // Clean up existing connection
    disconnect();

    // Create new Y.js document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Get tasks array from Y.js document
    const ytasks = ydoc.getArray<Task>('tasks');
    ytasksRef.current = ytasks;

    // Listen for changes
    ytasks.observe(updateTasksFromYjs);
    
    // Initial load
    updateTasksFromYjs();

    // Create WebSocket provider
    // Note: WebsocketProvider automatically appends roomId to the URL, so don't include it
    const host = window.location.hostname; // Get just the IP/hostname without port
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = `${wsProtocol}//${host}:8787/rooms`;
    console.log('Connecting to WebSocket base:', baseUrl);
    console.log('Room ID:', roomId);
    
    const provider = new WebsocketProvider(baseUrl, roomId, ydoc);
    providerRef.current = provider;

    setConnectionState('connecting');
    setConnectionStatus('Connecting to collaboration server...');

    // Handle connection events
    provider.on('status', (event: { status: string }) => {
      console.log('Y.js connection status:', event.status);
      
      switch (event.status) {
        case 'connecting':
          setConnectionState('connecting');
          setConnectionStatus('Connecting to collaboration server...');
          break;
        case 'connected':
          setConnectionState('connected');
          setConnectionStatus('Connected! 🎉 Real-time sync active');
          break;
        case 'disconnected':
          setConnectionState('disconnected');
          setConnectionStatus('Disconnected - will retry automatically');
          break;
        case 'reconnecting':
          setConnectionState('reconnecting');
          setConnectionStatus('Reconnecting...');
          break;
      }
    });

    // Handle connection errors with more detail
    provider.on('connection-error', (event: Event) => {
      console.error('Y.js connection error:', event);
      setConnectionState('disconnected');
      setConnectionStatus('Connection failed - retrying automatically');
    });

    // Track connected users
    provider.awareness.on('change', () => {
      const users = Array.from(provider.awareness.getStates().keys()).length;
      setConnectedUsers(users);
      console.log('Connected users:', users);
    });

  }, [updateTasksFromYjs]);

  const disconnect = useCallback(() => {
    console.log('Disconnecting from Y.js');
    
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }
    
    ytasksRef.current = null;
    setConnectionState('disconnected');
    setConnectionStatus('');
    setConnectedUsers(0);
  }, []);

  const addTask = useCallback((text: string) => {
    if (!ytasksRef.current) {
      console.warn('Cannot add task: not connected');
      return;
    }

    const task: Task = {
      id: generateUUID(),
      text,
      done: false
    };

    console.log('Adding task via Y.js:', task.text);
    ytasksRef.current.push([task]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    if (!ytasksRef.current) {
      console.warn('Cannot toggle task: not connected');
      return;
    }

    console.log('Toggling task via Y.js:', id);
    
    // Find and update the task
    const tasks = ytasksRef.current.toArray();
    const index = tasks.findIndex(task => task.id === id);
    
    if (index !== -1) {
      const task = tasks[index];
      const updatedTask = { ...task, done: !task.done };
      ytasksRef.current.delete(index, 1);
      ytasksRef.current.insert(index, [updatedTask]);
    }
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
    addTask,
    toggleTask,
    connect,
    disconnect
  };
} 