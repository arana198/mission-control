"use client";

import { MessageSquare, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface BoardChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
}

/**
 * BoardChatPanel Component
 * Sliding right panel for board chat discussions
 * Fetches and displays messages for a specific task
 */
export function BoardChatPanel({ isOpen, onClose, taskId }: BoardChatPanelProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages for the selected task
  const messages = useQuery(
    api.messages.getByTask,
    taskId ? { taskId: taskId as any, limit: 50 } : "skip"
  );

  // Mutation for sending messages
  const sendMessage = useMutation(api.messages.create);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !taskId) return;

    setIsSending(true);
    try {
      await sendMessage({
        taskId: taskId as any,
        content: message.trim(),
        senderId: "user",
        senderName: "You",
      });
      setMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay/20 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Board Chat Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[560px] max-w-[96vw] transform border-l border-border bg-background shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border px-6 py-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-1 h-5 w-5 text-accent" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Board chat
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Talk to the lead agent. Tag others with @name.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted"
              aria-label="Close board chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content area */}
          <div className="flex flex-1 flex-col overflow-hidden px-6 py-4">
            {/* Messages container */}
            <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 mb-4">
              {!taskId ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    Select a task to start chatting
                  </p>
                </div>
              ) : !messages ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Loading messages…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg: any) => (
                    <div
                      key={msg._id}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        msg.fromId === "user"
                          ? "bg-accent text-accent-foreground ml-auto max-w-[80%]"
                          : msg.isSystem
                          ? "bg-muted/50 text-muted-foreground italic text-center mx-auto"
                          : "bg-muted/50 text-foreground max-w-[80%]"
                      )}
                    >
                      {msg.fromId !== "user" && !msg.isSystem && (
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          {msg.senderName || msg.fromName}
                        </p>
                      )}
                      <p className="break-words">{msg.content}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message composer */}
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message board lead…"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || isSending}
                className="rounded-lg bg-accent px-3 py-2 text-white transition hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
