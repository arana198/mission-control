'use client';

import { useEffect } from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';

/**
 * PWA Initializer Component
 * Phase 5D: PWA Support
 *
 * Handles service worker registration and PWA features
 * Should be placed in a layout or root provider
 */

export function PWAInitializer() {
  const { isInstalled, isOnline, updateAvailable } = useServiceWorker();

  useEffect(() => {
    if (isInstalled) {
      console.log('[PWA] Service Worker installed and ready');
    }
  }, [isInstalled]);

  useEffect(() => {
    if (!isOnline) {
      console.warn('[PWA] Application is offline');
      // Could show an offline banner here
    } else {
      console.log('[PWA] Application is online');
    }
  }, [isOnline]);

  useEffect(() => {
    if (updateAvailable) {
      console.log('[PWA] Update available');
      // Could show update notification here
    }
  }, [updateAvailable]);

  // Handle install prompt (for "Add to Home Screen")
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] Install prompt triggered');
      // Store event for later use in install button
      // This would typically be stored in context or state
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle app installed
  useEffect(() => {
    const handleAppInstalled = () => {
      console.log('[PWA] App installed to home screen');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return null;
}
