"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDistanceToNow } from "date-fns";
import { Bell, AtSign, Check, CheckCheck, X } from "lucide-react";

export function NotificationPanel() {
  const notifications = useQuery(api.notifications.getAll);
  let markAllRead: any, markRead: any;
  try {
    markAllRead = useMutation(api.notifications.markAllRead);
    markRead = useMutation(api.notifications.markRead);
  } catch (e) {}

  if (!notifications) {
    return (
      <div className="card p-4">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!markAllRead) return;
    await markAllRead();
  };

  const handleMarkRead = async (id: string) => {
    if (!markRead) return;
    await markRead({ id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs rounded-full font-medium">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllRead}
            className="btn btn-ghost text-sm flex items-center gap-1"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-6 text-center">
          <Bell className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No notifications</p>
          <p className="text-xs text-muted-foreground mt-1">
            @mentions will appear here
          </p>
        </div>
      ) : (
        <div className="card p-2">
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {notifications.slice(0, 20).map((notification) => (
              <div
                key={notification._id}
                onClick={() => !notification.read && handleMarkRead(notification._id)}
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  notification.read
                    ? "bg-transparent opacity-70"
                    : "bg-primary/10 hover:bg-primary/20"
                }`}
              >
                <div className={`mt-0.5 ${notification.read ? "text-muted-foreground" : "text-primary"}`}>
                  {notification.read ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AtSign className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notification.read ? "text-muted-foreground" : "text-foreground"}`}>
                    {notification.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                  </p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Dropdown version for header
export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const notifications = useQuery(api.notifications.getAll);
  let markAllRead: any, markRead: any;
  try {
    markAllRead = useMutation(api.notifications.markAllRead);
    markRead = useMutation(api.notifications.markRead);
  } catch (e) {}

  const handleMarkRead = async (id: string) => {
    if (!markRead) return;
    await markRead({ id });
  };

  const handleMarkAllRead = async () => {
    if (!markAllRead) return;
    await markAllRead();
    onClose();
  };

  return (
    <div className="fixed top-16 right-6 w-80 z-50 card shadow-lg border bg-background">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold">Notifications</h3>
        <div className="flex items-center gap-2">
          {notifications && notifications.some(n => !n.read) && (
            <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {!notifications ? (
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p>No notifications</p>
        </div>
      ) : (
        <div className="divide-y max-h-64 overflow-y-auto">
          {notifications.slice(0, 20).map((n) => (
            <div
              key={n._id}
              onClick={() => handleMarkRead(n._id)}
              className={`p-3 cursor-pointer hover:bg-muted ${n.read ? "opacity-60" : "bg-primary/10"}`}
            >
              <p className="text-sm">{n.content}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                {!n.read && <span className="ml-2 text-primary font-medium">· unread</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
