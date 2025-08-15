import { renderHook, act } from '@testing-library/react';
import { useSessionManager } from '../useSessionManager';

// Mock URLSearchParams
const mockURLSearchParams = {
  get: jest.fn(),
  set: jest.fn(),
  toString: jest.fn(() => ''),
};

beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset localStorage mock
  (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
  (window.localStorage.setItem as jest.Mock).mockClear();
  (window.localStorage.removeItem as jest.Mock).mockClear();
  
  // Reset URLSearchParams mock
  mockURLSearchParams.get.mockReturnValue(null);
  mockURLSearchParams.set.mockClear();
  mockURLSearchParams.toString.mockReturnValue('');
  
  // Mock URLSearchParams constructor
  global.URLSearchParams = jest.fn(() => mockURLSearchParams) as any;
  
  // Mock window.history
  Object.defineProperty(window, 'history', {
    value: {
      replaceState: jest.fn(),
    },
    writable: true,
  });
});

describe('useSessionManager', () => {
  describe('initial state', () => {
    it('should initialize with empty session data', () => {
      const { result } = renderHook(() => useSessionManager());

      expect(result.current.roomId).toBe('');
      expect(result.current.mode).toBe('idle');
    });

    it('should load session from localStorage on mount', () => {
      (window.localStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'scheduler_room_id') return 'stored-room-id';
        if (key === 'scheduler_mode') return 'hosting';
        return null;
      });

      const { result } = renderHook(() => useSessionManager());

      expect(result.current.roomId).toBe('stored-room-id');
      expect(result.current.mode).toBe('hosting');
    });

    it('should load roomId from URL parameters if not in localStorage', () => {
      mockURLSearchParams.get.mockImplementation((key) => {
        if (key === 'room') return 'url-room-id';
        return null;
      });

      const { result } = renderHook(() => useSessionManager());

      expect(result.current.roomId).toBe('url-room-id');
      expect(result.current.mode).toBe('joining'); // defaults to joining when loading from URL
    });

    it('should prioritize localStorage over URL parameters', () => {
      (window.localStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'scheduler_room_id') return 'stored-room-id';
        if (key === 'scheduler_mode') return 'hosting';
        return null;
      });

      mockURLSearchParams.get.mockImplementation((key) => {
        if (key === 'room') return 'url-room-id';
        return null;
      });

      const { result } = renderHook(() => useSessionManager());

      expect(result.current.roomId).toBe('stored-room-id');
      expect(result.current.mode).toBe('hosting');
    });
  });

  describe('saveSession', () => {
    it('should save session to localStorage and update URL', () => {
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.saveSession('test-room-id', 'hosting');
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'scheduler_room_id',
        'test-room-id'
      );
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'scheduler_mode',
        'hosting'
      );

      expect(result.current.roomId).toBe('test-room-id');
      expect(result.current.mode).toBe('hosting');

      // Should update URL with room parameter
      expect(mockURLSearchParams.set).toHaveBeenCalledWith('room', 'test-room-id');
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    it('should handle different user modes', () => {
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.saveSession('join-room-id', 'joining');
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'scheduler_room_id',
        'join-room-id'
      );
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'scheduler_mode',
        'joining'
      );

      expect(result.current.roomId).toBe('join-room-id');
      expect(result.current.mode).toBe('joining');
    });
  });

  describe('loadSession', () => {
    it('should return session data from localStorage', () => {
      (window.localStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'scheduler_room_id') return 'loaded-room-id';
        if (key === 'scheduler_mode') return 'hosting';
        return null;
      });

      const { result } = renderHook(() => useSessionManager());

      const session = result.current.loadSession();

      expect(session).toEqual({
        roomId: 'loaded-room-id',
        mode: 'hosting',
      });
    });

    it('should return null if no session exists', () => {
      const { result } = renderHook(() => useSessionManager());

      const session = result.current.loadSession();

      expect(session).toBeNull();
    });

    it('should handle corrupted localStorage data', () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValue('invalid-json');

      const { result } = renderHook(() => useSessionManager());

      const session = result.current.loadSession();

      expect(session).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('should clear localStorage and reset state', () => {
      // Set up initial state
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.saveSession('test-room-id', 'hosting');
      });

      // Clear session
      act(() => {
        result.current.clearSession();
      });

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('scheduler_room_id');
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('scheduler_mode');
      expect(result.current.roomId).toBe('');
      expect(result.current.mode).toBe('idle');
    });

    it('should update URL to remove room parameter', () => {
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.saveSession('test-room-id', 'hosting');
      });

      act(() => {
        result.current.clearSession();
      });

      // Should remove room parameter from URL
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        window.location.pathname
      );
    });
  });

  describe('URL parameter handling', () => {
    it('should handle missing URL search parameters gracefully', () => {
      // Mock no search parameters
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          search: '',
        },
        writable: true,
      });

      const { result } = renderHook(() => useSessionManager());

      expect(result.current.roomId).toBe('');
      expect(result.current.mode).toBe('idle');
    });

    it('should handle URL with existing parameters', () => {
      mockURLSearchParams.get.mockImplementation((key) => {
        if (key === 'room') return 'url-room-123';
        return null;
      });
      mockURLSearchParams.toString.mockReturnValue('room=url-room-123&other=param');

      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.saveSession('new-room-id', 'hosting');
      });

      expect(mockURLSearchParams.set).toHaveBeenCalledWith('room', 'new-room-id');
    });
  });

  describe('session persistence across browser refreshes', () => {
    it('should maintain session data after page reload simulation', () => {
      // First render - save session
      const { result: result1 } = renderHook(() => useSessionManager());

      act(() => {
        result1.current.saveSession('persistent-room', 'hosting');
      });

      // Simulate page reload by setting up localStorage mock
      (window.localStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'scheduler_room_id') return 'persistent-room';
        if (key === 'scheduler_mode') return 'hosting';
        return null;
      });

      // Second render - should load from localStorage
      const { result: result2 } = renderHook(() => useSessionManager());

      expect(result2.current.roomId).toBe('persistent-room');
      expect(result2.current.mode).toBe('hosting');
    });
  });
});
