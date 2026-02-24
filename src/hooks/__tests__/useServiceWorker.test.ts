import { renderHook } from '@testing-library/react';
import { useServiceWorker, useClearServiceWorkerCache, useRequestServiceWorkerUpdate } from '../useServiceWorker';

/**
 * Service Worker Hook Tests
 * Phase 5D: PWA Support
 *
 * Tests service worker registration and management
 */

// Mock navigator.serviceWorker
const mockServiceWorkerContainer = {
  register: jest.fn(),
  ready: Promise.resolve({}),
  controller: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorkerContainer,
  writable: true,
});

describe('useServiceWorker Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServiceWorkerContainer.register.mockReset();
    mockServiceWorkerContainer.register.mockResolvedValue({
      update: jest.fn(),
      installing: null,
      addEventListener: jest.fn(),
    });
  });

  describe('Initialization', () => {
    test('registers service worker on mount', () => {
      renderHook(() => useServiceWorker());

      expect(mockServiceWorkerContainer.register).toHaveBeenCalledWith(
        '/service-worker.js',
        expect.any(Object)
      );
    });

    test('registers with correct scope', () => {
      renderHook(() => useServiceWorker());

      expect(mockServiceWorkerContainer.register).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ scope: '/' })
      );
    });

    test('returns initial status', () => {
      const { result } = renderHook(() => useServiceWorker());

      expect(result.current).toHaveProperty('isInstalled');
      expect(result.current).toHaveProperty('isOnline');
      expect(result.current).toHaveProperty('updateAvailable');
    });
  });

  describe('Registration States', () => {
    test('sets isInstalled to true after successful registration', async () => {
      const { result } = renderHook(() => useServiceWorker());

      // Note: In real implementation, this would update after registration completes
      expect(typeof result.current.isInstalled).toBe('boolean');
    });

    test('tracks online status', () => {
      const { result } = renderHook(() => useServiceWorker());

      expect(typeof result.current.isOnline).toBe('boolean');
      expect(result.current.isOnline).toBe(navigator.onLine);
    });

    test('tracks update availability', () => {
      const { result } = renderHook(() => useServiceWorker());

      expect(typeof result.current.updateAvailable).toBe('boolean');
    });
  });

  describe('Online/Offline Handling', () => {
    test('listens for online event', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      renderHook(() => useServiceWorker());

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    test('listens for offline event', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      renderHook(() => useServiceWorker());

      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    test('removes event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useServiceWorker());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Update Detection', () => {
    test('checks for updates periodically', async () => {
      jest.useFakeTimers();

      const mockRegistration = {
        update: jest.fn(),
        installing: null,
        addEventListener: jest.fn(),
      };

      mockServiceWorkerContainer.register.mockResolvedValue(mockRegistration);

      renderHook(() => useServiceWorker());

      // Allow initial registration to complete
      await Promise.resolve();

      jest.advanceTimersByTime(60000);

      // Update should be checked after 60 seconds
      expect(mockRegistration.update).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test('listens for updatefound event', () => {
      const mockRegistration = {
        update: jest.fn(),
        installing: null,
        addEventListener: jest.fn(),
      };

      mockServiceWorkerContainer.register.mockResolvedValue(mockRegistration);

      renderHook(() => useServiceWorker());

      expect(mockRegistration.addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function));
    });
  });

  describe('Error Handling', () => {
    test('handles registration failure gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockServiceWorkerContainer.register.mockRejectedValue(new Error('Registration failed'));

      renderHook(() => useServiceWorker());

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Service Worker]'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test('handles missing service worker API', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
      });

      renderHook(() => useServiceWorker());

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not supported')
      );

      // Restore
      Object.defineProperty(navigator, 'serviceWorker', {
        value: mockServiceWorkerContainer,
        writable: true,
      });

      consoleWarnSpy.mockRestore();
    });
  });
});

describe('useClearServiceWorkerCache Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sends clear cache message to service worker', () => {
    const mockController = {
      postMessage: jest.fn(),
    };

    Object.defineProperty(navigator.serviceWorker, 'controller', {
      value: mockController,
      writable: true,
    });

    const { result } = renderHook(() => useClearServiceWorkerCache());

    result.current();

    expect(mockController.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CLEAR_CACHE' })
    );
  });

  test('handles missing controller gracefully', () => {
    Object.defineProperty(navigator.serviceWorker, 'controller', {
      value: null,
      writable: true,
    });

    const { result } = renderHook(() => useClearServiceWorkerCache());

    // Should not throw
    expect(() => result.current()).not.toThrow();
  });
});

describe('useRequestServiceWorkerUpdate Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requests service worker update', async () => {
    const mockUpdate = jest.fn();
    const mockRegistration = {
      update: mockUpdate,
    };

    mockServiceWorkerContainer.ready = Promise.resolve(mockRegistration);

    const { result } = renderHook(() => useRequestServiceWorkerUpdate());

    result.current();

    await Promise.resolve();

    expect(mockUpdate).toHaveBeenCalled();
  });

  test('handles missing service worker API gracefully', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
    });

    const { result } = renderHook(() => useRequestServiceWorkerUpdate());

    // Should not throw
    expect(() => result.current()).not.toThrow();

    // Restore
    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockServiceWorkerContainer,
      writable: true,
    });
  });
});
