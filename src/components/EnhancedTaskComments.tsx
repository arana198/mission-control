"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Agent } from "@/types/agent";
import { useNotification } from "@/hooks/useNotification";
import {
  MessageSquare,
  Send,
  Trash2,
  X,
  Reply,
  SmilePlus,
} from "lucide-react";

/**
 * Enhanced Task Comments Component (Phase 5A)
 * Features:
 * - Threaded comments with nested replies
 * - Emoji reactions with toggle
 * - @mention support with autocomplete
 * - Task subscriptions
 * - Soft-delete with history preservation
 */
export function EnhancedTaskComments({
  taskId,
  workspaceId,
  agentId,
  agentName,
  agents,
}: {
  taskId: string;
  workspaceId: string;
  agentId: string;
  agentName: string;
  agents: Agent[];
}) {
  const [commentText, setCommentText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [replyTo, setReplyTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const notif = useNotification();

  const comments = useQuery(api.taskComments.getTaskComments, {
    taskId: taskId as any,
  });
  const createCommentMutation = useMutation(api.taskComments.createComment);
  const addReactionMutation = useMutation(api.taskComments.addReaction);
  const deleteCommentMutation = useMutation(api.taskComments.deleteComment);
  const subscribeToTaskMutation = useMutation(api.taskComments.subscribeToTask);

  const emojis = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "🚀", "✨"];

  const parseMentions = (text: string): { mentions: string[]; mentionAll: boolean } => {
    const mentionPattern = /@(\w+)/g;
    const matches = [...text.matchAll(mentionPattern)];
    const mentionNames = matches.map((m) => m[1].toLowerCase());

    const mentionAll = mentionNames.includes("all");

    const mentions = mentionNames
      .filter((name) => name !== "all")
      .map((name) =>
        agents.find((a) => a.name.toLowerCase() === name)?._id as any
      )
      .filter(Boolean) as any[];

    return { mentions, mentionAll };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    const { mentions } = parseMentions(commentText);
    setIsSubmitting(true);
    try {
      await createCommentMutation({
        taskId: taskId as any,
        agentId: agentId as any,
        agentName,
        workspaceId: workspaceId as any,
        content: commentText.trim(),
        parentCommentId: replyTo ? (replyTo.id as any) : undefined,
        mentions: mentions.length > 0 ? (mentions as any) : undefined,
      });
      setCommentText("");
      setReplyTo(null);
    } catch (error: any) {
      notif.error(error?.message || "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
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

  const filteredAgents: any = mentionQuery === ""
    ? [{ _id: "all", name: "all", role: "Everyone" }, ...agents]
    : [
        { _id: "all", name: "all", role: "Everyone" },
        ...agents.filter(
          (a) =>
            a.name.toLowerCase().includes(mentionQuery) ||
            a.role.toLowerCase().includes(mentionQuery)
        ),
      ];

  const renderCommentContent = (content: string) => {
    if (content === "[deleted]") {
      return (
        <em className="text-muted-foreground">
          This comment was deleted
        </em>
      );
    }

    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const name = part.slice(1);
        const isValidMention =
          agents.some(
            (a) => a.name.toLowerCase() === name.toLowerCase()
          ) || name === "all";
        return isValidMention ? (
          <span
            key={i}
            className="text-primary font-medium bg-primary/10 px-1 rounded"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getThreadReplies = (parentId: string) => {
    return (comments || []).filter((c) => c.parentCommentId === parentId);
  };

  const rootComments = (comments || []).filter((c) => !c.parentCommentId);

  return (
    <div>
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Comments
        {comments && comments.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({comments.length})
          </span>
        )}
      </h3>

      {/* Comment List */}
      <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
        {!comments ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No comments yet. Start the conversation!
          </p>
        ) : (
          rootComments.map((comment: any) => {
            const replies = getThreadReplies(comment._id);
            const isExpanded = expandedReplies.has(comment._id);

            return (
              <div key={comment._id} className="space-y-2">
                {/* Root Comment */}
                <CommentItem
                  comment={comment}
                  agents={agents}
                  onReply={() =>
                    setReplyTo({ id: comment._id, name: comment.agentName })
                  }
                  onDelete={async () => {
                    await deleteCommentMutation({
                      commentId: comment._id,
                    });
                  }}
                  onReact={async (emoji) => {
                    await addReactionMutation({
                      commentId: comment._id,
                      emoji,
                      agentId: agentId as any,
                    });
                  }}
                  canDelete={comment.agentId === agentId}
                  renderContent={renderCommentContent}
                />

                {/* Thread Replies */}
                {replies.length > 0 && (
                  <div className="ml-6 border-l-2 border-muted pl-3 space-y-2">
                    {isExpanded ? (
                      <>
                        {replies.map((reply: any) => (
                          <CommentItem
                            key={reply._id}
                            comment={reply}
                            agents={agents}
                            onReply={() =>
                              setReplyTo({
                                id: reply._id,
                                name: reply.agentName,
                              })
                            }
                            onDelete={async () => {
                              await deleteCommentMutation({
                                commentId: reply._id,
                              });
                            }}
                            onReact={async (emoji) => {
                              await addReactionMutation({
                                commentId: reply._id,
                                emoji,
                                agentId: agentId as any,
                              });
                            }}
                            canDelete={reply.agentId === agentId}
                            renderContent={renderCommentContent}
                            isReply
                          />
                        ))}
                        <button
                          onClick={() =>
                            setExpandedReplies(
                              new Set(
                                [...expandedReplies].filter(
                                  (id) => id !== comment._id
                                )
                              )
                            )
                          }
                          className="text-xs text-primary hover:underline"
                        >
                          Hide replies
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() =>
                          setExpandedReplies(
                            new Set([...expandedReplies, comment._id])
                          )
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        {replies.length} repl{replies.length === 1 ? "y" : "ies"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="relative">
        {/* Reply Banner */}
        {replyTo && (
          <div className="flex items-center gap-2 p-2 mb-2 bg-primary/10 border border-primary/30 rounded-lg">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary">
              Replying to <strong>{replyTo.name}</strong>
            </span>
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
            placeholder="Add a comment... Use @name to mention agents"
            rows={3}
            className="input resize-none w-full pr-12"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || isSubmitting}
            className="absolute bottom-2 right-2 btn btn-primary p-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Mention Autocomplete */}
        {showMentions && (
          <div className="absolute bottom-full left-0 mb-1 w-64 card shadow-lg border max-h-48 overflow-y-auto z-50">
            <div className="p-2 text-xs text-muted-foreground border-b">
              Mention an agent
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
                    <p className="text-xs text-muted-foreground">
                      {agent.role}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground">
                No matches
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

/**
 * CommentItem - Reusable comment display with reactions and actions
 */
function CommentItem({
  comment,
  agents,
  onReply,
  onDelete,
  onReact,
  canDelete,
  renderContent,
  isReply = false,
}: {
  comment: any;
  agents: Agent[];
  onReply: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  canDelete: boolean;
  renderContent: (content: string) => any;
  isReply?: boolean;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const emojis = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "🚀", "✨"];

  return (
    <div
      className={`flex gap-3 p-3 bg-muted/30 rounded-lg group ${
        isReply ? "bg-muted/10" : ""
      }`}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
        {comment.agentName[0]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{comment.agentName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onReply}
              className="p-1 text-primary hover:bg-primary/10 rounded transition-all"
              title="Reply to this comment"
            >
              <Reply className="w-3 h-3" />
            </button>
            {canDelete && (
              <button
                onClick={onDelete}
                className="p-1 text-destructive hover:bg-destructive/10 rounded transition-all"
                title="Delete comment"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Message */}
        <p className="text-sm mb-2">{renderContent(comment.content)}</p>

        {/* Reactions */}
        {comment.reactions && Object.keys(comment.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {Object.entries(comment.reactions).map(([emoji, reactors]: any) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-warning/10 border border-warning/30 hover:bg-warning/20 transition-colors text-xs"
                title={`Reacted by ${reactors.length} agent${reactors.length === 1 ? "" : "s"}`}
              >
                {emoji}
                <span className="font-medium">{reactors.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reaction Picker */}
        <div className="relative">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
          >
            <SmilePlus className="w-3 h-3" />
            React
          </button>

          {showReactions && (
            <div className="absolute bottom-full left-0 mb-1 bg-white border rounded-lg shadow-lg p-2 flex gap-1 z-40">
              {["👍", "❤️", "😂", "🎉", "🔥", "👀", "🚀", "✨"].map(
                (emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(emoji);
                      setShowReactions(false);
                    }}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
