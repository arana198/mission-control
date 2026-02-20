"use client";

import { useState } from "react";
import { MessageCircle, Trash2, Reply } from "lucide-react";
import type { WikiComment } from "@/convex/wiki";

interface WikiCommentsProps {
  comments: WikiComment[];
  pageId: string;
  onAddComment: (content: string, parentId?: string) => void;
  onDeleteComment: (commentId: string) => void;
}

/**
 * WikiComments - Threaded comments for a wiki page
 * Displays root comments and their replies in a tree structure
 */
export function WikiComments({
  comments,
  pageId,
  onAddComment,
  onDeleteComment,
}: WikiCommentsProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [newCommentText, setNewCommentText] = useState("");

  const handleAddComment = () => {
    if (newCommentText.trim()) {
      onAddComment(newCommentText);
      setNewCommentText("");
    }
  };

  const handleAddReply = (parentId: string) => {
    if (replyText.trim()) {
      onAddComment(replyText, parentId);
      setReplyText("");
      setReplyingTo(null);
    }
  };

  // Build map of replies by parent ID
  const repliesMap = new Map<string, WikiComment[]>();
  comments.forEach((comment) => {
    if (comment.parentId) {
      if (!repliesMap.has(comment.parentId)) {
        repliesMap.set(comment.parentId, []);
      }
      repliesMap.get(comment.parentId)!.push(comment);
    }
  });

  // Get root comments only
  const rootComments = comments.filter((c) => !c.parentId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Comments ({rootComments.length})</h3>
      </div>

      {/* New comment input */}
      <div className="space-y-2">
        <textarea
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Add a comment..."
          className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
        />
        <button
          onClick={handleAddComment}
          disabled={!newCommentText.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Post Comment
        </button>
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {rootComments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No comments yet</p>
        ) : (
          rootComments.map((comment) => (
            <CommentThread
              key={comment._id}
              comment={comment}
              replies={repliesMap.get(comment._id) || []}
              replyingTo={replyingTo}
              replyText={replyText}
              onSetReplyingTo={setReplyingTo}
              onSetReplyText={setReplyText}
              onAddReply={handleAddReply}
              onDeleteComment={onDeleteComment}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CommentThreadProps {
  comment: WikiComment;
  replies: WikiComment[];
  replyingTo: string | null;
  replyText: string;
  onSetReplyingTo: (id: string | null) => void;
  onSetReplyText: (text: string) => void;
  onAddReply: (parentId: string) => void;
  onDeleteComment: (commentId: string) => void;
}

function CommentThread({
  comment,
  replies,
  replyingTo,
  replyText,
  onSetReplyingTo,
  onSetReplyText,
  onAddReply,
  onDeleteComment,
}: CommentThreadProps) {
  return (
    <div className="space-y-3">
      {/* Root comment */}
      <Comment
        comment={comment}
        onDelete={onDeleteComment}
        onReply={() => onSetReplyingTo(comment._id)}
      />

      {/* Reply input if active */}
      {replyingTo === comment._id && (
        <div className="ml-8 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => onSetReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="w-full p-2 border rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => onAddReply(comment._id)}
              disabled={!replyText.trim()}
              className="px-3 py-1 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Reply
            </button>
            <button
              onClick={() => onSetReplyingTo(null)}
              className="px-3 py-1 rounded text-sm border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-8 space-y-3 pt-2 border-l-2 border-muted pl-4">
          {replies.map((reply) => (
            <Comment
              key={reply._id}
              comment={reply}
              onDelete={onDeleteComment}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentProps {
  comment: WikiComment;
  onDelete: (commentId: string) => void;
  onReply?: () => void;
  isReply?: boolean;
}

function Comment({ comment, onDelete, onReply, isReply }: CommentProps) {
  return (
    <div className={`p-3 rounded-lg border ${isReply ? "bg-muted/30" : "bg-muted/10"}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold">{comment.fromName}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-1">
          {onReply && (
            <button
              onClick={onReply}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Reply"
            >
              <Reply className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(comment._id)}
            className="p-1 hover:bg-destructive/20 text-destructive rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
    </div>
  );
}
