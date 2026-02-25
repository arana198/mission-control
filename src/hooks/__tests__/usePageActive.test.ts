/**
 * @jest-environment jsdom
 *
 * usePageActive Hook Tests
 * Tests page visibility and focus detection for polling optimization
 */

import { renderHook, act } from '@testing-library/react';
import { usePageActive } from '../usePageActive';

describe('usePageActive Hook', () => {
  let originalHidden: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    // Save original descriptor
    originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Restore original descriptor if it existed
    if (originalHidden) {
      Object.defineProperty(document, 'hidden', originalHidden);
    }
  });

  describe('initialization', () => {
    it('starts with isActive=true when tab is visible', () => {
      const { result } = renderHook(() => usePageActive());
      expect(result.current.isActive).toBe(true);
    });
  });

  describe('visibility changes', () => {
    it('handles visibilitychange event', () => {
      const { result } = renderHook(() => usePageActive());
      expect(result.current.isActive).toBe(true);

      // Dispatch visibilitychange event
      act(() => {
        const event = new Event('visibilitychange');
        document.dispatchEvent(event);
      });

      // State should update based on document.hidden
      expect(result.current.isActive).toBe(!document.hidden);
    });
  });

  describe('focus events', () => {
    it('sets isActive=false on window blur', () => {
      const { result } = renderHook(() => usePageActive());
      expect(result.current.isActive).toBe(true);

      // Dispatch blur event
      act(() => {
        const blurEvent = new Event('blur');
        window.dispatchEvent(blurEvent);
      });

      expect(result.current.isActive).toBe(false);
    });

    it('sets isActive=true on window focus', () => {
      const { result } = renderHook(() => usePageActive());

      // First blur
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      expect(result.current.isActive).toBe(false);

      // Then focus
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(result.current.isActive).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      const windowRemoveSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => usePageActive());

      unmount();

      // Should have removed all listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      expect(windowRemoveSpy.mock.calls.some(call => call[0] === 'blur')).toBe(true);
      expect(windowRemoveSpy.mock.calls.some(call => call[0] === 'focus')).toBe(true);
    });
  });

  describe('state updates on events', () => {
    it('updates state when blur then focus event fires', () => {
      const { result } = renderHook(() => usePageActive());

      expect(result.current.isActive).toBe(true);

      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      expect(result.current.isActive).toBe(false);

      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      expect(result.current.isActive).toBe(true);
    });
  });
});
