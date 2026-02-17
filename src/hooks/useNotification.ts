import { useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number; // ms, 0 = persistent
}

const notificationStore = {
  listeners: new Set<(notification: Notification) => void>(),
  dismissListeners: new Set<(id: string) => void>(),

  subscribe(listener: (notification: Notification) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  subscribeDismiss(listener: (id: string) => void) {
    this.dismissListeners.add(listener);
    return () => this.dismissListeners.delete(listener);
  },

  notify(notification: Notification) {
    this.listeners.forEach(listener => listener(notification));
  },

  dismiss(id: string) {
    this.dismissListeners.forEach(listener => listener(id));
  }
};

export function useNotification() {
  const notify = useCallback((type: NotificationType, message: string, duration = 4000) => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    const notification: Notification = { id, type, message, duration };
    notificationStore.notify(notification);

    if (duration > 0) {
      setTimeout(() => {
        notificationStore.dismiss(id);
      }, duration);
    }

    return id;
  }, []);

  return {
    success: useCallback((message: string, duration?: number) => notify('success', message, duration), [notify]),
    error: useCallback((message: string, duration?: number) => notify('error', message, duration || 5000), [notify]),
    warning: useCallback((message: string, duration?: number) => notify('warning', message, duration || 4000), [notify]),
    info: useCallback((message: string, duration?: number) => notify('info', message, duration || 4000), [notify]),
    dismiss: useCallback((id: string) => notificationStore.dismiss(id), []),
  };
}

export function getNotificationStore() {
  return notificationStore;
}
