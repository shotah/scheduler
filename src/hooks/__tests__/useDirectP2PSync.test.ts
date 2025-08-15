import { renderHook, act } from '@testing-library/react';
import { useDirectP2PSync } from '../useDirectP2PSync';

// Mock the signaling module
jest.mock('../../signaling', () => ({
  createRoom: jest.fn().mockResolvedValue('test-room-123'),
  registerPeer: jest.fn().mockResolvedValue('192.168.1.100'),
  discoverPeers: jest.fn().mockResolvedValue([
    { peerId: 'peer-1', ip: '192.168.1.101' },
    { peerId: 'peer-2', ip: '192.168.1.102' }
  ])
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('useDirectP2PSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDirectP2PSync());

    expect(result.current.tasks).toEqual([]);
    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.connectionStatus).toBe('Not connected');
    expect(result.current.connectedUsers).toBe(0);
  });

  it('should create a room', async () => {
    const { result } = renderHook(() => useDirectP2PSync());

    await act(async () => {
      const roomId = await result.current.createRoom();
      expect(roomId).toBe('test-room-123');
    });
  });

  it('should connect to a room as host', async () => {
    // Mock empty peers array consistently to simulate being the first/host
    const { discoverPeers } = require('../../signaling');
    // const originalMock = discoverPeers.getMockImplementation();
    discoverPeers.mockResolvedValue([]); // Temporarily override for this test

    const { result } = renderHook(() => useDirectP2PSync());

    await act(async () => {
      await result.current.connect('test-room-123');
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.connectionStatus).toContain('Connected as host');
    expect(result.current.connectedUsers).toBe(1);

    // Restore original mock for other tests
    discoverPeers.mockResolvedValue([
      { peerId: 'peer-1', ip: '192.168.1.101' },
      { peerId: 'peer-2', ip: '192.168.1.102' }
    ]);
  });

  it('should add a task', async () => {
    const { result } = renderHook(() => useDirectP2PSync());

    await act(async () => {
      await result.current.connect('test-room-123');
    });

    act(() => {
      result.current.addTask('Test task');
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].text).toBe('Test task');
    expect(result.current.tasks[0].done).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should toggle a task', async () => {
    const { result } = renderHook(() => useDirectP2PSync());

    await act(async () => {
      await result.current.connect('test-room-123');
    });

    act(() => {
      result.current.addTask('Test task');
    });

    const taskId = result.current.tasks[0].id;

    act(() => {
      result.current.toggleTask(taskId);
    });

    expect(result.current.tasks[0].done).toBe(true);
  });

  it('should load existing tasks from localStorage', async () => {
    const existingTasks = [
      { id: '1', text: 'Existing task', done: false }
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existingTasks));

    const { result } = renderHook(() => useDirectP2PSync());

    await act(async () => {
      await result.current.connect('test-room-123');
    });

    expect(result.current.tasks).toEqual(existingTasks);
  });

  it('should disconnect properly', async () => {
    const { result } = renderHook(() => useDirectP2PSync());

    await act(async () => {
      await result.current.connect('test-room-123');
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.connectionStatus).toBe('Not connected');
    expect(result.current.connectedUsers).toBe(0);
  });

  it('should handle connection errors gracefully', async () => {
    const { registerPeer } = require('../../signaling');
    registerPeer.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDirectP2PSync());

    await act(async () => {
      await result.current.connect('test-room-123');
    });

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.connectionStatus).toBe('Connection failed');
  });
});
