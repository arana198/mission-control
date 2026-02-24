import { useEffect, useState } from 'react';

/**
 * Orientation Hook
 * Phase 5D: Mobile Support
 *
 * Detects and handles device orientation changes
 * Handles portrait/landscape transitions
 */

export type Orientation = 'portrait' | 'landscape';

interface OrientationState {
  orientation: Orientation;
  angle: number;
  isPortrait: boolean;
  isLandscape: boolean;
}

export function useOrientation(): OrientationState {
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get initial orientation
    const updateOrientation = () => {
      // Try to use screen.orientation API first (more reliable)
      if (screen.orientation) {
        const currentType = screen.orientation.type;
        const newOrientation = currentType.includes('portrait') ? 'portrait' : 'landscape';
        const newAngle = screen.orientation.angle || 0;

        setOrientation(newOrientation);
        setAngle(newAngle);
      } else {
        // Fallback to window.innerHeight/Width
        const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        setOrientation(newOrientation);
        setAngle(0);
      }
    };

    // Initial call
    updateOrientation();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      updateOrientation();
      console.log('[Orientation] Changed:', { orientation, angle: screen.orientation?.angle });
    };

    // Set up listeners
    window.addEventListener('orientationchange', handleOrientationChange);
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    }
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return {
    orientation,
    angle,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
  };
}

/**
 * Hook to lock/unlock device orientation
 */
export async function useLockOrientation(
  orientations: ('portrait' | 'landscape')[]
): Promise<boolean> {
  try {
    if (!screen.orientation) {
      console.warn('[Orientation] screen.orientation API not available');
      return false;
    }

    await screen.orientation.lock(orientations);
    console.log('[Orientation] Locked to:', orientations);
    return true;
  } catch (error) {
    console.error('[Orientation] Lock failed:', error);
    return false;
  }
}

/**
 * Hook to unlock device orientation
 */
export function useUnlockOrientation(): boolean {
  try {
    if (!screen.orientation) {
      return false;
    }

    screen.orientation.unlock();
    console.log('[Orientation] Unlocked');
    return true;
  } catch (error) {
    console.error('[Orientation] Unlock failed:', error);
    return false;
  }
}

/**
 * Hook for full-screen handling on mobile
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const requestFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (error) {
      console.error('[Fullscreen] Request failed:', error);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('[Fullscreen] Exit failed:', error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return {
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
  };
}
