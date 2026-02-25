/**
 * useGatewaySessions Hook
 * Real-time gateway session fetching and management
 *
 * Fetches sessions from `/api/gateway/[gatewayId]?action=sessions`
 * Auto-polls every 30 seconds
 * Provides functions to send messages and fetch history
 */

import { useState, useEffect, useCallback } from 'react';

export interface GatewaySession {
  key: string;
  label: string;
  lastActivity?: number;
}

interface UseGatewaySessionsReturn {
  sessions: GatewaySession[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sendMessage: (sessionKey: string, content: string) => Promise<void>;
  fetchHistory: (sessionKey: string) => Promise<any[]>;
}

export function useGatewaySessions(gatewayId: string | null): UseGatewaySessionsReturn {
  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions from API
  const fetchSessions = useCallback(async () => {
    // Skip if no gatewayId
    if (!gatewayId) {
      setIsLoading(false);
      setSessions([]);
      return;
    }

    try {
      setError(null);
      const response = await fetch(
        `/api/gateway/${gatewayId}?action=sessions`
      );

      if (!response.ok) {
        throw new Error(
          `API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      setSessions(data.sessions || []);
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setSessions([]);
      setIsLoading(false);
    }
  }, [gatewayId]);

  // Polling effect
  useEffect(() => {
    if (!gatewayId) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchSessions();

    // Set up polling interval (30 seconds)
    const interval = setInterval(() => {
      fetchSessions();
    }, 30000);

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, [gatewayId, fetchSessions]);

  // Send message to session
  const sendMessage = useCallback(
    async (sessionKey: string, content: string) => {
      if (!gatewayId) {
        throw new Error('No gateway selected');
      }

      const response = await fetch(
        `/api/gateway/${gatewayId}?action=message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionKey,
            content,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
    },
    [gatewayId]
  );

  // Fetch message history for a session
  const fetchHistory = useCallback(
    async (sessionKey: string): Promise<any[]> => {
      if (!gatewayId) {
        return [];
      }

      try {
        const response = await fetch(
          `/api/gateway/${gatewayId}?action=history&sessionKey=${sessionKey}`,
          { method: 'GET' }
        );

        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        return data.history || [];
      } catch {
        return [];
      }
    },
    [gatewayId]
  );

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refresh,
    sendMessage,
    fetchHistory,
  };
}
