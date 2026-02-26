/**
 * @jest-environment jsdom
 *
 * useGatewaySessions Hook Tests
 * Tests real-time gateway session fetching and management
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useGatewaySessions } from '../useGatewaySessions';

describe('useGatewaySessions Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('starts with empty sessions and isLoading=true', () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(() => {
          /* never resolves */
        })
      );

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      expect(result.current.sessions).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('skips fetching when gatewayId is null', () => {
      const { result } = renderHook(() => useGatewaySessions(null));

      expect(result.current.sessions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('session fetching', () => {
    it('populates sessions from API response', async () => {
      const mockSessions = [
        { key: 'session-1', label: 'Main Session' },
        { key: 'session-2', label: 'Backup Session' },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: mockSessions }),
      });

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sessions).toEqual(mockSessions);
      expect(result.current.error).toBeNull();
    });

    it('sets error when API returns 500', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.sessions).toEqual([]);
    });

    it('sets error when network fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('polling', () => {
    it('fetches sessions on mount and at intervals', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      const { unmount } = renderHook(() => useGatewaySessions('gateway-1'));

      // Initial fetch
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Fast forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Should have fetched again
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Fast forward another 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      unmount();
      jest.useRealTimers();
    });

    it('cleans up interval on unmount', () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() => useGatewaySessions('gateway-1'));
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('sendMessage', () => {
    it('sends message to gateway session', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: [{ key: 'session-1', label: 'Main Session' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true }),
        });

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      await waitFor(() => {
        expect(result.current.sessions.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.sendMessage('session-1', 'Deploy to production');
      });

      // Check that POST was called
      const postCall = (global.fetch as jest.Mock).mock.calls.find(
        (call) => call[1]?.method === 'POST'
      );
      expect(postCall).toBeDefined();
      expect(postCall[1].body).toContain('Deploy to production');
    });

    it('handles send failure gracefully', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: [{ key: 'session-1', label: 'Main Session' }],
          }),
        })
        .mockRejectedValueOnce(new Error('Send failed'));

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      await waitFor(() => {
        expect(result.current.sessions.length).toBeGreaterThan(0);
      });

      await expect(
        act(async () => {
          await result.current.sendMessage('session-1', 'Test message');
        })
      ).rejects.toThrow();
    });
  });

  describe('fetchHistory', () => {
    it('fetches session message history', async () => {
      const mockHistory = [
        { type: 'received', content: 'Hello', timestamp: Date.now() - 5000 },
        { type: 'sent', content: 'Hi there', timestamp: Date.now() },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessions: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ history: mockHistory }),
        });

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const history = await result.current.fetchHistory('session-1');

      expect(history).toEqual(mockHistory);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('action=history'),
        expect.any(Object)
      );
    });

    it('returns empty array on error', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sessions: [] }),
        })
        .mockRejectedValueOnce(new Error('Failed to fetch history'));

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const history = await result.current.fetchHistory('session-1');

      expect(history).toEqual([]);
    });
  });

  describe('refresh', () => {
    it('manually triggers session refresh', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      const { result } = renderHook(() => useGatewaySessions('gateway-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });
  });
});
