import React, { useEffect, useCallback } from "react";
import { createRoom } from "./signaling";
import { useDirectP2PSync } from "./hooks/useDirectP2PSync";
import { useSessionManager } from "./hooks/useSessionManager";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { RoomControls } from "./components/RoomControls";
import { TaskList } from "./components/TaskList";

export default function App() {
  const collaboration = useDirectP2PSync();
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
      <h1>🚀 Direct P2P Task Sync</h1>
      
      <ConnectionStatus 
        status={enhancedStatus} 
        error={collaboration.connectionState === 'disconnected' && session.mode !== 'idle' ? 'Connection lost' : ''} 
      />

      {/* Show connected users count always */}
      <div style={{ 
        marginBottom: "16px", 
        padding: "8px", 
        background: "#f5f5f5", 
        borderRadius: "4px",
        fontSize: "14px",
        color: "#666"
      }}>
        Connected users: {collaboration.connectedUsers}
      </div>

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
