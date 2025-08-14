import React, { useEffect, useCallback } from "react";
import { createRoom } from "./signaling";
import { useYjsCollaboration } from "./hooks/useYjsCollaboration";
import { useSessionManager } from "./hooks/useSessionManager";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { RoomControls } from "./components/RoomControls";
import { TaskList } from "./components/TaskList";

export default function App() {
  const collaboration = useYjsCollaboration();
  const session = useSessionManager();

  // Initialize session restoration
  useEffect(() => {
    const sessionData = session.loadSession();
    if (sessionData) {
      collaboration.connect(sessionData.roomId);
    }
  }, []);

  // Handle host workspace
  const handleStartHosting = useCallback(async () => {
    try {
      const roomId = await createRoom();
      session.saveSession(roomId, 'hosting');
      collaboration.connect(roomId);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  }, [collaboration, session]);

  // Handle join room
  const handleJoinRoom = useCallback(async (roomId: string) => {
    session.saveSession(roomId, 'joining');
    collaboration.connect(roomId);
  }, [collaboration, session]);

  // Handle reset
  const handleReset = useCallback(() => {
    session.clearSession();
    collaboration.disconnect();
  }, [session, collaboration]);

  const showTasks = session.mode === 'hosting' || session.mode === 'joining';

  // Create enhanced status message
  const enhancedStatus = collaboration.connectionStatus + 
    (collaboration.connectedUsers > 0 ? ` (${collaboration.connectedUsers} users connected)` : '');

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>🚀 Real-time Task Sync (Y.js CRDT)</h1>
      
      <ConnectionStatus 
        status={enhancedStatus} 
        error={collaboration.connectionState === 'disconnected' && session.mode !== 'idle' ? 'Connection lost' : ''} 
      />

      <RoomControls
        mode={session.mode}
        roomId={session.roomId}
        onStartHosting={handleStartHosting}
        onJoinRoom={handleJoinRoom}
        onReset={handleReset}
      />

      <TaskList
        tasks={collaboration.tasks}
        onAddTask={collaboration.addTask}
        onToggleTask={collaboration.toggleTask}
        showTasks={showTasks}
      />
    </div>
  );
}
