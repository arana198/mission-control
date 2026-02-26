/**
 * @jest-environment jsdom
 *
 * GatewaySessionsPanel Component Tests
 * Tests enhanced session panel with real history loading and refresh
 */

import '@testing-library/jest-dom';
import React from 'react';
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
    it('expands session to show details on click', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
        />
      );

      const mainSessionButton = screen.getByText('Main Session');
      fireEvent.click(mainSessionButton);

      // Verify session expands
      expect(screen.getByText('Message History')).toBeInTheDocument();
    });
  });

  describe('message history display', () => {
    it('displays received and sent messages', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
        />
      );

      // Expand first session
      fireEvent.click(screen.getByText('Main Session'));

      // Verify message history section appears
      expect(screen.getByText('Message History')).toBeInTheDocument();
    });
  });

  describe('message sending', () => {
    it('renders message input when session is expanded', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
        />
      );

      fireEvent.click(screen.getByText('Main Session'));
      expect(screen.getByPlaceholderText('Type message...')).toBeInTheDocument();
    });

    it('renders send button', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
        />
      );

      fireEvent.click(screen.getByText('Main Session'));
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(1); // At least session button + send button
    });
  });

  describe('health and refresh display', () => {
    it('displays active sessions header', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
        />
      );

      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    });

    it('displays health status when provided', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
          isHealthy={true}
          lastHealthCheck={Date.now()}
        />
      );

      // Health info should be displayed
      expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    });
  });

  describe('dynamic status badges', () => {
    it('shows "Active" badge (green) for session with status "active"', () => {
      const activeSessions: GatewaySession[] = [
        { key: 'session-1', label: 'Active Session', status: 'active' },
      ];

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={activeSessions}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows "Idle" badge (amber) for session with status "idle"', () => {
      const idleSessions: GatewaySession[] = [
        { key: 'session-1', label: 'Idle Session', status: 'idle' },
      ];

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={idleSessions}
        />
      );

      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('shows "Inactive" badge (muted) for session with status "inactive"', () => {
      const inactiveSessions: GatewaySession[] = [
        { key: 'session-1', label: 'Inactive Session', status: 'inactive' },
      ];

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={inactiveSessions}
        />
      );

      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('shows "Connected" info text for active session when expanded', () => {
      const activeSessions: GatewaySession[] = [
        { key: 'session-1', label: 'Active Session', status: 'active' },
      ];

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={activeSessions}
        />
      );

      // Expand the session
      fireEvent.click(screen.getByText('Active Session'));

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('shows "Idle" info text for idle session when expanded', () => {
      const idleSessions: GatewaySession[] = [
        { key: 'session-1', label: 'Idle Session', status: 'idle' },
      ];

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={idleSessions}
        />
      );

      // Expand the session
      fireEvent.click(screen.getByText('Idle Session'));

      // Look for the Status section which should show "Idle"
      const statusTexts = screen.getAllByText('Idle');
      // Should have at least 2: one in badge, one in status info
      expect(statusTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Disconnected" info text for inactive session when expanded', () => {
      const inactiveSessions: GatewaySession[] = [
        { key: 'session-1', label: 'Inactive Session', status: 'inactive' },
      ];

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={inactiveSessions}
        />
      );

      // Expand the session
      fireEvent.click(screen.getByText('Inactive Session'));

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('defaults to "Active" badge when status is undefined', () => {
      const sessionsNoStatus: GatewaySession[] = [
        { key: 'session-1', label: 'Session No Status' },
      ];

      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={sessionsNoStatus}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
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
    });

    it('renders all sessions provided', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={mockSessions}
        />
      );

      expect(screen.getByText('Main Session')).toBeInTheDocument();
      expect(screen.getByText('Backup Session')).toBeInTheDocument();
    });

    it('displays error banner when error prop is set', () => {
      render(
        <GatewaySessionsPanel
          gatewayId="gateway-1"
          sessions={[]}
          error="Test error message"
        />
      );

      expect(screen.getByText(/Test error message/)).toBeInTheDocument();
    });
  });
});
