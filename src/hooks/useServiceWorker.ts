import { useEffect, useState } from 'react';

/**
 * Service Worker Registration Hook
 * Phase 5D: PWA Support
 *
 * Registers the service worker for:
 * - Offline support
 * - Caching strategies
 * - Background sync
 * - Push notifications (future)
 */

interface ServiceWorkerStatus {
  isInstalled: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
}

export function useServiceWorker(): ServiceWorkerStatus {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    isInstalled: false,
    isOnline: navigator.onLine,
    updateAvailable: false,
  });

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('[useServiceWorker] Service Worker not supported');
      return;
    }

    // Register service worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        console.log('[Service Worker] Registered successfully:', registration);
        setStatus((prev) => ({ ...prev, isInstalled: true }));

        // Check for updates
        const checkForUpdates = () => {
          registration.update();
        };

        // Check for updates every 60 seconds
        const updateInterval = setInterval(checkForUpdates, 60000);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('[Service Worker] Update available');
              setStatus((prev) => ({ ...prev, updateAvailable: true }));

              // Optionally notify user
              if (window.confirm('A new version of Mission Control is available. Reload to update?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });

        // Clean up interval on unmount
        return () => clearInterval(updateInterval);
      } catch (error) {
        console.error('[Service Worker] Registration failed:', error);
      }
    };

    registerServiceWorker();

    // Listen for online/offline events
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      console.log('[Service Worker] App is online');
      // Trigger background sync when coming back online
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.sync.register('sync-tasks').catch((error) => {
            console.error('[Service Worker] Background sync registration failed:', error);
          });
        });
      }
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
      console.log('[Service Worker] App is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Controller change listener (for updates)
    const handleControllerChange = () => {
      console.log('[Service Worker] Controller changed, reloading...');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return status;
}

/**
 * Hook to notify service worker to clear caches
 */
export function useClearServiceWorkerCache() {
  return () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_CACHE',
      });
      console.log('[Service Worker] Cache clear requested');
    }
  };
}

/**
 * Hook to request service worker update
 */
export function useRequestServiceWorkerUpdate() {
  return () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
        console.log('[Service Worker] Update check requested');
      });
    }
  };
}
