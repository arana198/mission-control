'use client';

import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Notification, getNotificationStore } from '@/hooks/useNotification';

export function NotificationContainer() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const store = getNotificationStore();

    const unsubscribe = store.subscribe((notification) => {
      setNotifications(prev => [...prev, notification]);
    });

    const unsubscribeDismiss = store.subscribeDismiss((id) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    });

    return () => {
      unsubscribe();
      unsubscribeDismiss();
    };
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-success/10 text-success border-success/30';
      case 'error':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'info':
      default:
        return 'bg-primary/10 text-primary border-primary/30';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-md animate-slide-in ${getStyles(notification.type)}`}
        >
          <div className="flex-shrink-0">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1 text-sm font-medium">
            {notification.message}
          </div>
          <button
            onClick={() => getNotificationStore().dismiss(notification.id)}
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
