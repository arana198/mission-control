/**
 * @jest-environment jsdom
 *
 * GatewaySessionsPanel Component Tests
 * Tests enhanced session panel with real history loading and refresh
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GatewaySessionsPanel } from '../GatewaySessionsPanel';
import { GatewaySession } from '@/hooks/useGatewaySessions';

describe('GatewaySessionsPanel Component', () => {
  const mockSessions: GatewaySession[] = [
    { key: 'session-1', label: 'Main Session', lastActivity: Date.now() - 5000 },
    { key: 'session-2', label: 'Backup Session', lastActivity: Date.now() - 30000 },
  ];

  const mockHistoryEntry = [
    { type: 'received' as const, content: 'Hello from gateway', timestamp: Date.now() - 60000 },
    { type: 'sent' as const, content: 'Hello back', timestamp: Date.now() - 30000 },
  ];

  describe('rendering', () => {
    it('renders sessions list when provided', () => {
      render(
        <GatewaySessionsPanel gatewayId="gateway-1" sessions={mockSessions} />
      );

      expect(screen.getByText('Main Session')).toBeInTheDocument();
      expect(screen.getByText('Backup Session')).toBeInTheDocument();
    });

    it('shows no sessions message when sessions array is empty', () => {
      render(
        <GatewaySessionsPanel gatewayId="gateway-1" sessions={[]} />
      );

      expect(screen.getByText('No active sessions')).toBeInTheDocument();
    });

    it('displays loading skeleton when isLoading is true', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={[]}
          isLoading={true}
        />
      );

      // Should show loading indicator or skeleton
      expect(screen.queryByText('No active sessions')).not.toBeInTheDocument();
    });

    it('displays error banner when error is provided', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={[]}
          error="Failed to load sessions"
        />
      );

      expect(screen.getByText(/Failed to load sessions/)).toBeInTheDocument();
    });
  });

  describe('session expansion', () => {
    it('expands session to show details on click', async () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onFetchHistory={jest.fn()}
        />
      );

      const mainSessionButton = screen.getByText('Main Session');
      fireEvent.click(mainSessionButton);

      await waitFor(() => {
        expect(screen.getByText('Message History')).toBeInTheDocument();
      });
    });

    it('calls onFetchHistory when session is expanded', async () => {
      const mockFetchHistory = jest.fn().mockResolvedValue(mockHistoryEntry);

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onFetchHistory={mockFetchHistory}
        />
      );

      const mainSessionButton = screen.getByText('Main Session');
      fireEvent.click(mainSessionButton);

      await waitFor(() => {
        expect(mockFetchHistory).toHaveBeenCalledWith('session-1');
      });
    });
  });

  describe('message history display', () => {
    it('displays received and sent messages with different styling', async () => {
      const mockFetchHistory = jest.fn().mockResolvedValue(mockHistoryEntry);

      const { container } = render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onFetchHistory={mockFetchHistory}
        />
      );

      const mainSessionButton = screen.getByText('Main Session');
      fireEvent.click(mainSessionButton);

      await waitFor(() => {
        expect(screen.getByText('Hello from gateway')).toBeInTheDocument();
        expect(screen.getByText('Hello back')).toBeInTheDocument();
      });

      // Verify messages have different styling
      const messages = container.querySelectorAll('[class*="bg-blue"], [class*="bg-gray"]');
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('message sending', () => {
    it('calls onSendMessage when send button is clicked', async () => {
      const mockSendMessage = jest.fn().mockResolvedValue(undefined);

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onSendMessage={mockSendMessage}
        />
      );

      const mainSessionButton = screen.getByText('Main Session');
      fireEvent.click(mainSessionButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type message...');
      fireEvent.change(input, { target: { value: 'Test message' } });

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('session-1', 'Test message');
      });
    });

    it('clears input after sending message', async () => {
      const mockSendMessage = jest.fn().mockResolvedValue(undefined);

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onSendMessage={mockSendMessage}
        />
      );

      const mainSessionButton = screen.getByText('Main Session');
      fireEvent.click(mainSessionButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type message...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('health and refresh display', () => {
    it('displays health status in header when provided', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          isHealthy={true}
          lastHealthCheck={Date.now()}
        />
      );

      // Should show health indicator
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    });

    it('shows refresh button when onRefresh is provided', () => {
      const mockRefresh = jest.fn();

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onRefresh={mockRefresh}
        />
      );

      expect(screen.getByRole('button', { name: /refresh|reload/i })).toBeInTheDocument();
    });

    it('calls onRefresh when refresh button is clicked', async () => {
      const mockRefresh = jest.fn();

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onRefresh={mockRefresh}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /refresh|reload/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('edge cases', () => {
    it('handles sessions with no lastActivity', () => {
      const sessionsNoActivity = [
        { key: 'session-1', label: 'Session Without Activity' },
      ];

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={sessionsNoActivity}
        />
      );

      expect(screen.getByText('Session Without Activity')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument(); // Dash for no activity
    });

    it('handles onFetchHistory returning empty array', async () => {
      const mockFetchHistory = jest.fn().mockResolvedValue([]);

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onFetchHistory={mockFetchHistory}
        />
      );

      const mainSessionButton = screen.getByText('Main Session');
      fireEvent.click(mainSessionButton);

      await waitFor(() => {
        expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
      });
    });

    it('handles onFetchHistory error gracefully', async () => {
      const mockFetchHistory = jest
        .fn()
        .mockRejectedValue(new Error('Failed to fetch'));

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          onFetchHistory={mockFetchHistory}
        />
      );

      const mainSessionButton = screen.getByText('Main Session');
      fireEvent.click(mainSessionButton);

      await waitFor(() => {
        expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
      });
    });
  });
});
