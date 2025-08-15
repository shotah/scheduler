interface ConnectionStatusProps {
  status: string;
  error: string;
  users?: number;
}

export function ConnectionStatus({ status, error }: ConnectionStatusProps) {
  if (error) {
    return (
      <div style={{ 
        background: "#ffebee", 
        color: "#c62828", 
        padding: "12px", 
        borderRadius: "4px", 
        marginBottom: "16px" 
      }}>
        ❌ {error}
      </div>
    );
  }

  if (status) {
    return (
      <div style={{ 
        background: "#e8f5e8", 
        color: "#2e7d32", 
        padding: "12px", 
        borderRadius: "4px", 
        marginBottom: "16px" 
      }}>
        ℹ️ {status}
      </div>
    );
  }

  return null;
} 