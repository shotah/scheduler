import React, { useState } from 'react';
import { AppMode } from '../hooks/useSessionManager';

interface RoomControlsProps {
  mode: AppMode;
  roomId: string;
  onStartHosting: () => void;
  onJoinRoom: (roomId: string) => void;
  onReset: () => void;
}

export function RoomControls({ mode, roomId, onStartHosting, onJoinRoom, onReset }: RoomControlsProps) {
  if (mode === 'idle') {
    return (
      <>
        <button onClick={onStartHosting} style={{ marginRight: "8px" }}>
          🏠 Host workspace
        </button>
        <button onClick={onReset} style={{ marginRight: "16px" }}>
          🔄 Reset
        </button>
        <div style={{ marginTop: 16 }}>
          <JoinForm onJoin={onJoinRoom} />
        </div>
      </>
    );
  }

  if (mode === 'hosting') {
    return (
      <div style={{ marginBottom: "16px" }}>
        <p>
          <strong>Room ID:</strong> <code style={{ 
            background: "#f5f5f5", 
            padding: "4px 8px", 
            borderRadius: "4px",
            fontSize: "16px"
          }}>{roomId}</code>
        </p>
        <p style={{ color: "#666", fontSize: "14px" }}>
          Share this ID with your teammate to sync tasks!
        </p>
        <button onClick={onReset} style={{ marginTop: "8px" }}>
          🔄 Reset
        </button>
      </div>
    );
  }

  if (mode === 'joining') {
    return (
      <div style={{ marginBottom: "16px" }}>
        <p>Joining room: <code>{roomId}</code></p>
        <button onClick={onReset}>🔄 Reset</button>
      </div>
    );
  }

  return null;
}

function JoinForm({ onJoin }: { onJoin: (roomId: string) => void }) {
  const [id, setId] = useState("");
  
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <input
        placeholder="Enter room ID to join..."
        value={id}
        onChange={(e) => setId(e.target.value)}
        style={{ 
          flex: 1, 
          padding: "8px", 
          border: "1px solid #ddd", 
          borderRadius: "4px" 
        }}
      />
      <button 
        onClick={() => onJoin(id)} 
        disabled={!id.trim()}
        style={{ 
          opacity: id.trim() ? 1 : 0.6,
          cursor: id.trim() ? "pointer" : "not-allowed"
        }}
      >
        🔗 Join
      </button>
    </div>
  );
} 