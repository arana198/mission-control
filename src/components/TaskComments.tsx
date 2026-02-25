"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Agent } from "@/types/agent";
import { MessageSquare, Send, Trash2, X } from "lucide-react";

/**
 * Task Comments Component with @mention support
 */
export function TaskComments({ taskId, agents }: { taskId: string; agents: Agent[] }) {
  const [commentText, setCommentText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = useQuery(api.messages.getByTask, { taskId: taskId as any });
  const createMessageMutation = useMutation(api.messages.create);
  const deleteMessageMutation = useMutation(api.messages.remove);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !createMessageMutation) return;

    const { mentions, mentionAll } = parseMentions(commentText);

    await createMessageMutation({
      taskId: taskId as any,
      content: commentText.trim(),
      senderId: "user",
      senderName: "You",
      mentions: mentions.length > 0 ? (mentions as any) : undefined,
      mentionAll: mentionAll || undefined,
      parentId: replyTo ? (replyTo.id as any) : undefined,
    });

    setCommentText("");
    setReplyTo(null);
  };

  const parseMentions = (text: string): { mentions: string[]; mentionAll: boolean } => {
    const mentionPattern = /@(\w+)/g;
    const matches = [...text.matchAll(mentionPattern)];
    const mentionNames = matches.map(m => m[1].toLowerCase());

    const mentionAll = mentionNames.includes("all");

    const mentions = mentionNames
      .filter(name => name !== "all")
      .map(name => agents.find(a => a.name.toLowerCase() === name)?._id)
      .filter(Boolean) as string[];

    return { mentions, mentionAll };
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "@") {
      setShowMentions(true);
      setMentionQuery("");
    } else if (e.key === "Escape") {
      setShowMentions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCommentText(value);

    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1);
      if (!afterAt.includes(" ") && afterAt.length >= 0) {
        setShowMentions(true);
        setMentionQuery(afterAt.toLowerCase());
      } else {
        setShowMentions(false);
      }
    }
  };

  const insertMention = (agentName: string) => {
    const lastAtIndex = commentText.lastIndexOf("@");
    const beforeAt = commentText.slice(0, lastAtIndex);
    const newText = beforeAt + `@${agentName} `;
    setCommentText(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredAgents = mentionQuery === ""
    ? [{ _id: "all", name: "all", role: "Everyone" }, ...agents]
    : [
        { _id: "all", name: "all", role: "Everyone" },
        ...agents.filter(a =>
          a.name.toLowerCase().includes(mentionQuery) ||
          a.role.toLowerCase().includes(mentionQuery)
        )
      ];

  const renderCommentContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const name = part.slice(1);
        const isValidMention = agents.some(a => a.name.toLowerCase() === name.toLowerCase()) || name === "all";
        return isValidMention ? (
          <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div>
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" /> Comments
        {messages && messages.length > 0 && (
          <span className="text-xs text-muted-foreground">({messages.length})</span>
        )}
      </h3>

      {/* Comment List */}
      <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
        {!messages ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Start the conversation!</p>
        ) : (
          messages.map((msg: any) => {
            const canDelete = msg.fromId === "user";
            return (
            <div key={msg._id} className="flex gap-3 p-3 bg-muted/30 rounded-lg group">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0">
                {msg.fromName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{msg.fromName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                  <button
                    onClick={() => setReplyTo({ id: msg._id, name: msg.fromName })}
                    className="opacity-0 group-hover:opacity-100 ml-auto p-1 text-primary hover:bg-primary/10 rounded transition-all"
                    title="Reply to this message"
                  >
                    <MessageSquare className="w-3 h-3" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={async () => {
                        if (!deleteMessageMutation) return;
                        if (!confirm("Delete this comment?")) return;
                        await deleteMessageMutation({ messageId: msg._id, senderId: "user" });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded transition-all"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm">{renderCommentContent(msg.content)}</p>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="relative">
        {/* Reply banner */}
        {replyTo && (
          <div className="flex items-center gap-2 p-2 mb-2 bg-primary/10 border border-primary/30 rounded-lg">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary/90">Replying to <strong>{replyTo.name}</strong></span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-auto p-1 hover:bg-primary/20 rounded"
            >
              <X className="w-3 h-3 text-primary" />
            </button>
          </div>
        )}
        <div className="relative">
          <textarea
            ref={inputRef}
            value={commentText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment... Use @name to mention agents or @all for everyone"
            rows={3}
            className="input resize-none w-full pr-12"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || !createMessageMutation}
            className="absolute bottom-2 right-2 btn btn-primary p-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Mention Autocomplete Dropdown */}
        {showMentions && (
          <div className="absolute bottom-full left-0 mb-1 w-64 card shadow-lg border max-h-48 overflow-y-auto z-50">
            <div className="p-2 text-xs text-muted-foreground border-b">
              Mention an agent or @all for everyone
            </div>
            {filteredAgents.length > 0 ? (
              filteredAgents.map((agent: any) => (
                <button
                  key={agent._id}
                  type="button"
                  onClick={() => insertMention(agent.name)}
                  className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground">
                    {agent.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">@{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground">No matches</div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
