import { useState, useCallback } from 'react';

export type AppMode = 'idle' | 'hosting' | 'joining';

interface SessionData {
  roomId: string;
  mode: AppMode;
}

interface UseSessionManagerReturn {
  roomId: string;
  mode: AppMode;
  setRoomId: (id: string) => void;
  setMode: (mode: AppMode) => void;
  saveSession: (roomId: string, mode: 'hosting' | 'joining') => void;
  loadSession: () => SessionData | null;
  clearSession: () => void;
}

export function useSessionManager(): UseSessionManagerReturn {
  const [roomId, setRoomId] = useState<string>('');
  const [mode, setMode] = useState<AppMode>('idle');

  const saveSession = useCallback((roomId: string, mode: 'hosting' | 'joining') => {
    localStorage.setItem('scheduler_room_id', roomId);
    localStorage.setItem('scheduler_mode', mode);
    window.history.replaceState({}, '', `?room=${roomId}`);
    setRoomId(roomId);
    setMode(mode);
  }, []);

  const loadSession = useCallback((): SessionData | null => {
    // Check URL first, then localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get('room');
    const storedRoomId = localStorage.getItem('scheduler_room_id');
    const storedMode = localStorage.getItem('scheduler_mode') as 'hosting' | 'joining' | null;

    const sessionRoomId = urlRoomId || storedRoomId;
    
    if (sessionRoomId && storedMode) {
      setRoomId(sessionRoomId);
      setMode(storedMode);
      return { roomId: sessionRoomId, mode: storedMode };
    }
    return null;
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('scheduler_room_id');
    localStorage.removeItem('scheduler_mode');
    window.history.replaceState({}, '', window.location.pathname);
    setRoomId('');
    setMode('idle');
  }, []);

  return {
    roomId,
    mode,
    setRoomId,
    setMode,
    saveSession,
    loadSession,
    clearSession
  };
} 