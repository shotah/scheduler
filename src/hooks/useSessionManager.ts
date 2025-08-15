import { useState, useCallback, useEffect } from 'react';

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
    
    // Update URL using URLSearchParams 
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('room', roomId);
    window.history.replaceState({}, '', `?${urlParams.toString()}`);
    
    setRoomId(roomId);
    setMode(mode);
  }, []);

  const loadSession = useCallback((): SessionData | null => {
    // Check URL first, then localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get('room');
    const storedRoomId = localStorage.getItem('scheduler_room_id');
    const storedModeRaw = localStorage.getItem('scheduler_mode');
    const storedMode = (storedModeRaw === 'hosting' || storedModeRaw === 'joining') ? storedModeRaw : null;

    const sessionRoomId = storedRoomId || urlRoomId;
    
    if (sessionRoomId) {
      // If we have a room ID from URL but no stored mode, default to joining
      const sessionMode = storedMode || (urlRoomId ? 'joining' : null);
      if (sessionMode) {
        setRoomId(sessionRoomId);
        setMode(sessionMode);
        return { roomId: sessionRoomId, mode: sessionMode };
      }
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

  // Auto-load session data on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

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