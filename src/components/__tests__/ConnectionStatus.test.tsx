import { render, screen } from '@testing-library/react';
import { ConnectionStatus } from '../ConnectionStatus';

const mockProps = {
  status: 'Connected! 🎉 Real-time sync active',
  error: '',
  users: 3,
};

describe('ConnectionStatus', () => {
  describe('status display', () => {
    it('should show status message with info styling', () => {
      render(<ConnectionStatus {...mockProps} />);

      const statusElement = screen.getByText('ℹ️ Connected! 🎉 Real-time sync active');
      expect(statusElement).toBeInTheDocument();
      expect(statusElement).toHaveStyle('background: #e8f5e8');
      expect(statusElement).toHaveStyle('color: #2e7d32');
    });

    it('should show error message with error styling', () => {
      const errorProps = {
        status: '',
        error: 'Connection failed',
        users: 0,
      };

      render(<ConnectionStatus {...errorProps} />);

      const errorElement = screen.getByText('❌ Connection failed');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveStyle('background: #ffebee');
      expect(errorElement).toHaveStyle('color: #c62828');
    });

    it('should prioritize error over status', () => {
      const errorWithStatusProps = {
        status: 'Connected',
        error: 'Something went wrong',
        users: 2,
      };

      render(<ConnectionStatus {...errorWithStatusProps} />);

      expect(screen.getByText('❌ Something went wrong')).toBeInTheDocument();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    });

    it('should render nothing when no status or error', () => {
      const emptyProps = {
        status: '',
        error: '',
        users: 0,
      };

      const { container } = render(<ConnectionStatus {...emptyProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('different status types', () => {
    it('should handle connection status messages', () => {
      const statusProps = {
        status: 'Connecting to server...',
        error: '',
        users: 0,
      };

      render(<ConnectionStatus {...statusProps} />);
      expect(screen.getByText('ℹ️ Connecting to server...')).toBeInTheDocument();
    });

    it('should handle success status messages', () => {
      const successProps = {
        status: 'Successfully connected!',
        error: '',
        users: 2,
      };

      render(<ConnectionStatus {...successProps} />);
      expect(screen.getByText('ℹ️ Successfully connected!')).toBeInTheDocument();
    });

    it('should handle long status messages', () => {
      const longStatusProps = {
        status: 'This is a very long status message that should still display correctly',
        error: '',
        users: 1,
      };

      render(<ConnectionStatus {...longStatusProps} />);
      expect(screen.getByText('ℹ️ This is a very long status message that should still display correctly')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle empty error messages', () => {
      const emptyErrorProps = {
        status: 'Working normally',
        error: '',
        users: 1,
      };

      render(<ConnectionStatus {...emptyErrorProps} />);
      expect(screen.getByText('ℹ️ Working normally')).toBeInTheDocument();
    });

    it('should handle different error types', () => {
      const networkErrorProps = {
        status: '',
        error: 'Network connection failed',
        users: 0,
      };

      render(<ConnectionStatus {...networkErrorProps} />);
      expect(screen.getByText('❌ Network connection failed')).toBeInTheDocument();
    });

    it('should handle authentication errors', () => {
      const authErrorProps = {
        status: '',
        error: 'Authentication failed',
        users: 0,
      };

      render(<ConnectionStatus {...authErrorProps} />);
      expect(screen.getByText('❌ Authentication failed')).toBeInTheDocument();
    });
  });

  describe('styling and presentation', () => {
    it('should apply correct styles to status messages', () => {
      render(<ConnectionStatus {...mockProps} />);

      const statusElement = screen.getByText('ℹ️ Connected! 🎉 Real-time sync active');
      expect(statusElement).toHaveStyle('padding: 12px');
      expect(statusElement).toHaveStyle('border-radius: 4px');
      expect(statusElement).toHaveStyle('margin-bottom: 16px');
    });

    it('should apply correct styles to error messages', () => {
      const errorProps = {
        status: '',
        error: 'Test error',
        users: 0,
      };

      render(<ConnectionStatus {...errorProps} />);

      const errorElement = screen.getByText('❌ Test error');
      expect(errorElement).toHaveStyle('padding: 12px');
      expect(errorElement).toHaveStyle('border-radius: 4px');
      expect(errorElement).toHaveStyle('margin-bottom: 16px');
    });
  });

  describe('component behavior', () => {
    it('should update when props change', () => {
      const { rerender } = render(<ConnectionStatus {...mockProps} />);

      expect(screen.getByText('ℹ️ Connected! 🎉 Real-time sync active')).toBeInTheDocument();

      // Update to error state
      rerender(
        <ConnectionStatus
          status=""
          error="Connection lost"
          users={0}
        />
      );

      expect(screen.getByText('❌ Connection lost')).toBeInTheDocument();
      expect(screen.queryByText('Connected! 🎉 Real-time sync active')).not.toBeInTheDocument();
    });

    it('should handle switching between status and error', () => {
      const { rerender } = render(<ConnectionStatus {...mockProps} />);

      // Start with status
      expect(screen.getByText('ℹ️ Connected! 🎉 Real-time sync active')).toBeInTheDocument();

      // Switch to error
      rerender(
        <ConnectionStatus
          status="Connected"
          error="Network issue"
          users={1}
        />
      );

      expect(screen.getByText('❌ Network issue')).toBeInTheDocument();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();

      // Back to status only
      rerender(
        <ConnectionStatus
          status="Reconnected successfully"
          error=""
          users={2}
        />
      );

      expect(screen.getByText('ℹ️ Reconnected successfully')).toBeInTheDocument();
      expect(screen.queryByText('Network issue')).not.toBeInTheDocument();
    });
  });
});
