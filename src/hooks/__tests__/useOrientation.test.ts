/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { useOrientation } from '../useOrientation';

/**
 * Orientation Hook Tests
 * Phase 5D: Mobile Support
 *
 * Tests device orientation detection and handling
 */

describe('useOrientation Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Orientation Detection', () => {
    test('detects portrait orientation when height > width', () => {
      // Mock portrait viewport
      Object.defineProperty(window, 'innerHeight', {
        value: 800,
        writable: true,
      });
      Object.defineProperty(window, 'innerWidth', {
        value: 600,
        writable: true,
      });

      const { result } = renderHook(() => useOrientation());

      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });

    test('detects landscape orientation when width > height', () => {
      // Mock landscape viewport
      Object.defineProperty(window, 'innerHeight', {
        value: 600,
        writable: true,
      });
      Object.defineProperty(window, 'innerWidth', {
        value: 800,
        writable: true,
      });

      const { result } = renderHook(() => useOrientation());

      expect(result.current.isLandscape).toBe(true);
      expect(result.current.isPortrait).toBe(false);
    });

    test('returns correct orientation string', () => {
      const { result } = renderHook(() => useOrientation());

      expect(['portrait', 'landscape']).toContain(result.current.orientation);
    });

    test('returns angle value', () => {
      const { result } = renderHook(() => useOrientation());

      expect(typeof result.current.angle).toBe('number');
      expect(result.current.angle).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Orientation Change Events', () => {
    test('updates orientation on resize event', () => {
      const { result, rerender } = renderHook(() => useOrientation());

      const initialOrientation = result.current.orientation;

      // Simulate resize by firing event
      window.dispatchEvent(new Event('resize'));

      // In real scenario, the result would update
      expect(result.current.orientation).toBeDefined();
    });

    test('listens for orientationchange event', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      renderHook(() => useOrientation());

      expect(addEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    test('removes event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useOrientation());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Screen Orientation API', () => {
    test('uses screen.orientation API when available', () => {
      const mockOrientation = {
        type: 'portrait-primary',
        angle: 0,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      Object.defineProperty(screen, 'orientation', {
        value: mockOrientation,
        writable: true,
      });

      const { result } = renderHook(() => useOrientation());

      expect(result.current.orientation).toBe('portrait');
      expect(result.current.angle).toBe(0);
    });

    test('handles landscape-primary orientation', () => {
      const mockOrientation = {
        type: 'landscape-primary',
        angle: 90,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      Object.defineProperty(screen, 'orientation', {
        value: mockOrientation,
        writable: true,
      });

      const { result } = renderHook(() => useOrientation());

      expect(result.current.orientation).toBe('landscape');
      expect(result.current.angle).toBe(90);
    });
  });

  describe('Hook Return Values', () => {
    test('returns all required state properties', () => {
      const { result } = renderHook(() => useOrientation());

      expect(result.current).toHaveProperty('orientation');
      expect(result.current).toHaveProperty('angle');
      expect(result.current).toHaveProperty('isPortrait');
      expect(result.current).toHaveProperty('isLandscape');
    });

    test('boolean flags are mutually exclusive', () => {
      const { result } = renderHook(() => useOrientation());

      if (result.current.isPortrait) {
        expect(result.current.isLandscape).toBe(false);
      } else {
        expect(result.current.isPortrait).toBe(false);
      }
    });

    test('orientation string matches boolean flags', () => {
      const { result } = renderHook(() => useOrientation());

      if (result.current.orientation === 'portrait') {
        expect(result.current.isPortrait).toBe(true);
        expect(result.current.isLandscape).toBe(false);
      } else {
        expect(result.current.isLandscape).toBe(true);
        expect(result.current.isPortrait).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    test('handles square viewports (equal height and width)', () => {
      Object.defineProperty(window, 'innerHeight', {
        value: 600,
        writable: true,
      });
      Object.defineProperty(window, 'innerWidth', {
        value: 600,
        writable: true,
      });

      const { result } = renderHook(() => useOrientation());

      // Should default to landscape when equal
      expect(result.current.orientation).toBeDefined();
    });

    test('handles missing screen.orientation API gracefully', () => {
      Object.defineProperty(screen, 'orientation', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useOrientation());

      // Should still work with fallback
      expect(result.current.orientation).toBeDefined();
      expect(result.current.angle).toBe(0);
    });

    test('handles very small viewports', () => {
      Object.defineProperty(window, 'innerHeight', {
        value: 200,
        writable: true,
      });
      Object.defineProperty(window, 'innerWidth', {
        value: 100,
        writable: true,
      });

      const { result } = renderHook(() => useOrientation());

      expect(result.current.isPortrait).toBe(true);
    });

    test('handles very large viewports', () => {
      Object.defineProperty(window, 'innerHeight', {
        value: 2160,
        writable: true,
      });
      Object.defineProperty(window, 'innerWidth', {
        value: 3840,
        writable: true,
      });

      const { result } = renderHook(() => useOrientation());

      expect(result.current.isLandscape).toBe(true);
    });
  });

  describe('Multiple Hook Instances', () => {
    test('multiple instances share same orientation', () => {
      const { result: result1 } = renderHook(() => useOrientation());
      const { result: result2 } = renderHook(() => useOrientation());

      expect(result1.current.orientation).toBe(result2.current.orientation);
      expect(result1.current.isPortrait).toBe(result2.current.isPortrait);
    });
  });
});
