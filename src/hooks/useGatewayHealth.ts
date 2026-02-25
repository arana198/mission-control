/**
 * useGatewayHealth Hook
 * Periodic gateway health status polling
 *
 * Fetches health from `/api/gateway/[gatewayId]?action=status`
 * Auto-polls every 60 seconds
 * Reports health status for gateway list badges
 */

import { useState, useEffect, useCallback } from 'react';

interface UseGatewayHealthReturn {
  isHealthy: boolean | undefined;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastChecked: number | null;
}

export function useGatewayHealth(gatewayId: string | null): UseGatewayHealthReturn {
  const [isHealthy, setIsHealthy] = useState<boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  // Fetch health status from API
  const fetchHealth = useCallback(async () => {
    // Skip if no gatewayId
    if (!gatewayId) {
      setIsLoading(false);
      setIsHealthy(undefined);
      return;
    }

    try {
      setError(null);
      const response = await fetch(
        `/api/gateway/${gatewayId}?action=status`
      );

      if (!response.ok) {
        throw new Error(
          `API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      setIsHealthy(data.isHealthy ?? true);
      setLastChecked(data.lastChecked ?? Date.now());
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setIsHealthy(undefined);
      setIsLoading(false);
    }
  }, [gatewayId]);

  // Polling effect (60-second interval for health checks)
  useEffect(() => {
    if (!gatewayId) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchHealth();

    // Set up polling interval (60 seconds for health checks)
    const interval = setInterval(() => {
      fetchHealth();
    }, 60000);

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, [gatewayId, fetchHealth]);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchHealth();
  }, [fetchHealth]);

  return {
    isHealthy,
    isLoading,
    error,
    refresh,
    lastChecked,
  };
}
