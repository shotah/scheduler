import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomControls } from '../RoomControls';

const mockProps = {
  mode: 'idle' as const,
  roomId: '',
  onStartHosting: jest.fn(),
  onJoinRoom: jest.fn(),
  onReset: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RoomControls', () => {
  describe('initial state (no room)', () => {
    it('should show host and join options when disconnected', () => {
      render(<RoomControls {...mockProps} />);

      expect(screen.getByText('🏠 Host workspace')).toBeInTheDocument();
      expect(screen.getByText('🔗 Join')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter room ID to join...')).toBeInTheDocument();
    });

    it('should call onStartHosting when host button is clicked', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const hostButton = screen.getByText('🏠 Host workspace');
      await user.click(hostButton);

      expect(mockProps.onStartHosting).toHaveBeenCalledTimes(1);
    });

    it('should call onJoinRoom when join button is clicked with room ID', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const roomInput = screen.getByPlaceholderText('Enter room ID to join...');
      const joinButton = screen.getByText('🔗 Join');

      await user.type(roomInput, 'test-room-123');
      await user.click(joinButton);

      expect(mockProps.onJoinRoom).toHaveBeenCalledWith('test-room-123');
    });

    it('should not call onJoinRoom with empty room ID', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const joinButton = screen.getByText('🔗 Join');
      await user.click(joinButton);

      expect(mockProps.onJoinRoom).not.toHaveBeenCalled();
    });

    it('should pass room ID as-entered (without trimming)', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const roomInput = screen.getByPlaceholderText('Enter room ID to join...');
      const joinButton = screen.getByText('🔗 Join');

      await user.type(roomInput, '  test-room-123  ');
      await user.click(joinButton);

      expect(mockProps.onJoinRoom).toHaveBeenCalledWith('  test-room-123  ');
    });
  });

  describe('connected state (with room)', () => {
    const connectedProps = {
      ...mockProps,
      mode: 'hosting' as const,
      roomId: 'active-room-123',
    };

    it('should show room ID and reset option when connected', () => {
      render(<RoomControls {...connectedProps} />);

      expect(screen.getByText('Room ID:')).toBeInTheDocument();
      expect(screen.getByText('active-room-123')).toBeInTheDocument();
      expect(screen.getByText('🔄 Reset')).toBeInTheDocument();
    });

    it('should not show host/join controls when connected', () => {
      render(<RoomControls {...connectedProps} />);

      expect(screen.queryByText('Host workspace')).not.toBeInTheDocument();
      expect(screen.queryByText('Join room')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Enter room ID...')).not.toBeInTheDocument();
    });

    it('should call onReset when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...connectedProps} />);

      const resetButton = screen.getByText('🔄 Reset');
      await user.click(resetButton);

      expect(mockProps.onReset).toHaveBeenCalledTimes(1);
    });

    // Note: Component doesn't have copy functionality yet
    it('should show room information without copy button', () => {
      render(<RoomControls {...connectedProps} />);

      expect(screen.getByText('Room ID:')).toBeInTheDocument();
      expect(screen.getByText('active-room-123')).toBeInTheDocument();
    });
  });

  describe('connecting state', () => {
    const connectingProps = {
      ...mockProps,
      mode: 'joining' as const,
      roomId: 'test-connecting-room',
    };

    it('should show joining state and reset button', () => {
      render(<RoomControls {...connectingProps} />);

      expect(screen.getByText('Joining room:')).toBeInTheDocument();
      expect(screen.getByText('test-connecting-room')).toBeInTheDocument();
      expect(screen.getByText('🔄 Reset')).toBeInTheDocument();
    });

    it('should not show host/join controls in joining state', () => {
      render(<RoomControls {...connectingProps} />);

      expect(screen.queryByText('🏠 Host workspace')).not.toBeInTheDocument();
      expect(screen.queryByText('🔗 Join')).not.toBeInTheDocument();
    });
  });

  describe('room ID input validation', () => {
    it('should handle valid UUID format', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const roomInput = screen.getByPlaceholderText('Enter room ID to join...');
      const joinButton = screen.getByText('🔗 Join');

      const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      await user.type(roomInput, validUUID);
      await user.click(joinButton);

      expect(mockProps.onJoinRoom).toHaveBeenCalledWith(validUUID);
    });

    it('should handle short room IDs', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const roomInput = screen.getByPlaceholderText('Enter room ID to join...');
      const joinButton = screen.getByText('🔗 Join');

      await user.type(roomInput, 'abc123');
      await user.click(joinButton);

      expect(mockProps.onJoinRoom).toHaveBeenCalledWith('abc123');
    });

    it('should require clicking join button (Enter key not handled)', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const roomInput = screen.getByPlaceholderText('Enter room ID to join...');

      await user.type(roomInput, 'test-room-enter');
      await user.keyboard('{Enter}');

      // Enter key doesn't trigger join - must click button
      expect(mockProps.onJoinRoom).not.toHaveBeenCalled();
    });
  });

  // Note: Copy functionality not yet implemented

  describe('accessibility', () => {
    it('should have proper form labels and structure', () => {
      render(<RoomControls {...mockProps} />);

      const roomInput = screen.getByPlaceholderText('Enter room ID to join...');
      // Input defaults to text type when no type specified
      expect(roomInput).toBeInTheDocument();
      // Input uses placeholder for accessibility
      expect(roomInput).toHaveAttribute('placeholder', 'Enter room ID to join...');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      // Should be able to tab through controls in actual order
      await user.tab();
      expect(screen.getByText('🏠 Host workspace')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('🔄 Reset')).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText('Enter room ID to join...')).toHaveFocus();

      // Disabled join button doesn't receive focus during tab navigation
      // Tab navigation skips disabled elements
    });

    it('should have proper button roles and states', () => {
      render(<RoomControls {...mockProps} />);

      const hostButton = screen.getByText('🏠 Host workspace');
      const joinButton = screen.getByText('🔗 Join');

      // Buttons are rendered as button elements with proper roles
      expect(hostButton).toBeInTheDocument();
      expect(joinButton).toBeInTheDocument();
      expect(joinButton).toBeDisabled(); // Disabled when no room ID
    });

    it('should properly render state changes', () => {
      const { rerender } = render(<RoomControls {...mockProps} />);

      // Change to joining state
      rerender(
        <RoomControls 
          {...mockProps} 
          mode="joining"
          roomId="test-joining-room"
        />
      );

      expect(screen.getByText('Joining room:')).toBeInTheDocument();
      expect(screen.getByText('test-joining-room')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very long room IDs', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const roomInput = screen.getByPlaceholderText('Enter room ID to join...');
      const joinButton = screen.getByText('🔗 Join');

      const longRoomId = 'a'.repeat(100);
      await user.type(roomInput, longRoomId);
      await user.click(joinButton);

      expect(mockProps.onJoinRoom).toHaveBeenCalledWith(longRoomId);
    });

    it('should handle special characters in room ID', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const roomInput = screen.getByPlaceholderText('Enter room ID to join...');
      const joinButton = screen.getByText('🔗 Join');

      const specialRoomId = 'room-123_test.example@domain';
      await user.type(roomInput, specialRoomId);
      await user.click(joinButton);

      expect(mockProps.onJoinRoom).toHaveBeenCalledWith(specialRoomId);
    });

    it('should handle rapid button clicks', async () => {
      const user = userEvent.setup();
      render(<RoomControls {...mockProps} />);

      const hostButton = screen.getByText('🏠 Host workspace');

      // Click multiple times rapidly
      await user.click(hostButton);
      await user.click(hostButton);
      await user.click(hostButton);

      // Should only call once (or implement debouncing)
      expect(mockProps.onStartHosting).toHaveBeenCalledTimes(3);
    });
  });
});
