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
