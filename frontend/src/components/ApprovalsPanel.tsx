"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Check, X, RotateCcw, Trash2 } from "lucide-react";

/**
 * Approvals Panel Component
 * Phase 3 UI: Two-column layout (list + detail view)
 * Shows pending and resolved approvals with confidence scoring
 */
interface ApprovalsPanelProps {
  workspaceId: Id<"workspaces">;
}

export function ApprovalsPanel({ workspaceId }: ApprovalsPanelProps) {
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);

  // Queries
  const approvals = useQuery(api.approvals.getBy, { workspaceId });
  const selectedApproval = selectedApprovalId
    ? approvals?.find((a) => a._id === selectedApprovalId)
    : null;

  const linkedTasks = selectedApproval
    ? approvals
        ?.filter((a) => a._id === selectedApprovalId)
        .flatMap((a) => []) // Would need getTaskLinks query
    : null;

  // Mutations
  const resolveApproval = useMutation(api.approvals.resolveApproval);
  const reopenApproval = useMutation(api.approvals.reopenApproval);
  const deleteApproval = useMutation(api.approvals.deleteApproval);

  const handleApprove = async (approvalId: string) => {
    try {
      await resolveApproval({
        approvalId: approvalId as any,
        status: "approved",
        resolvedBy: "current-user", // Would use useCurrentUser
      });
    } catch (error) {
      console.error("Failed to approve:", error);
    }
  };

  const handleReject = async (approvalId: string) => {
    try {
      await resolveApproval({
        approvalId: approvalId as any,
        status: "rejected",
        resolvedBy: "current-user",
      });
    } catch (error) {
      console.error("Failed to reject:", error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-success";
    if (confidence >= 50) return "text-warning";
    return "text-destructive";
  };

  const timeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  const pendingApprovals = approvals?.filter((a) => a.status === "pending") || [];
  const resolvedApprovals = approvals?.filter((a) => a.status !== "pending") || [];

  return (
    <div className="flex h-screen gap-6 p-6 bg-background">
      {/* Left Column: Approval List */}
      <div className="w-80 flex flex-col border border-border rounded-lg bg-card">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Approvals</h3>
          <p className="text-sm text-muted-foreground">{pendingApprovals.length} pending</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          {/* Pending Section */}
          {pendingApprovals.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                Pending ({pendingApprovals.length})
              </div>
              {pendingApprovals.map((approval) => (
                <button
                  key={approval._id}
                  onClick={() => setSelectedApprovalId(approval._id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedApprovalId === approval._id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${getConfidenceColor(approval.confidence)}`}>
                      {approval.confidence}%
                    </span>
                    <span className="text-xs text-muted-foreground">{approval.actionType}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{timeAgo(approval.createdAt)}</div>
                </button>
              ))}
            </>
          )}

          {/* Resolved Section */}
          {resolvedApprovals.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase mt-4">
                Resolved ({resolvedApprovals.length})
              </div>
              {resolvedApprovals.map((approval) => (
                <button
                  key={approval._id}
                  onClick={() => setSelectedApprovalId(approval._id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors opacity-75 ${
                    selectedApprovalId === approval._id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {approval.status === "approved" ? "✓ Approved" : "✗ Rejected"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{timeAgo(approval.resolvedAt || 0)}</div>
                </button>
              ))}
            </>
          )}

          {!approvals || approvals.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No approvals yet — agents will request approval here
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Detail View */}
      {selectedApproval ? (
        <div className="flex-1 border border-border rounded-lg bg-card p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-foreground">{selectedApproval.actionType}</h2>
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    selectedApproval.status === "pending"
                      ? "bg-warning/20 text-warning"
                      : selectedApproval.status === "approved"
                      ? "bg-success/20 text-success"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {selectedApproval.status}
                </span>
              </div>
              {selectedApproval.agentId && (
                <p className="text-sm text-muted-foreground">Agent ID: {selectedApproval.agentId}</p>
              )}
            </div>

            {/* Confidence Meter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">Confidence Score</span>
                <span className={`text-2xl font-bold ${getConfidenceColor(selectedApproval.confidence)}`}>
                  {selectedApproval.confidence}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    selectedApproval.confidence >= 80
                      ? "bg-success"
                      : selectedApproval.confidence >= 50
                      ? "bg-warning"
                      : "bg-destructive"
                  }`}
                  style={{ width: `${selectedApproval.confidence}%` }}
                />
              </div>
            </div>

            {/* Lead Reasoning */}
            <div>
              <h3 className="font-semibold text-foreground mb-2">Lead Reasoning</h3>
              <blockquote className="border-l-4 border-primary pl-4 py-2 text-foreground italic">
                {selectedApproval.leadReasoning}
              </blockquote>
            </div>

            {/* Risk Indicators */}
            {(selectedApproval.isExternal || selectedApproval.isRisky) && (
              <div className="bg-destructive/10 border border-destructive/30 rounded p-4">
                <h3 className="font-semibold text-destructive mb-2">Risk Flags</h3>
                <div className="space-y-1 text-sm text-destructive/80">
                  {selectedApproval.isExternal && <div>🔓 External Action</div>}
                  {selectedApproval.isRisky && <div>⚠️ Risky Operation</div>}
                </div>
              </div>
            )}

            {/* Rubric Scores */}
            {selectedApproval.rubricScores && Object.keys(selectedApproval.rubricScores).length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">Rubric Scores</h3>
                <div className="space-y-2">
                  {Object.entries(selectedApproval.rubricScores).map(([dimension, score]: any) => (
                    <div key={dimension} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground capitalize">{dimension}</span>
                      <span className="font-medium text-foreground">{score}/100</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {selectedApproval.status === "pending" && (
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => handleApprove(selectedApproval._id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-success hover:bg-success/90 text-success-foreground rounded px-4 py-2 font-medium transition-colors"
                >
                  <Check size={18} />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(selectedApproval._id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded px-4 py-2 font-medium transition-colors"
                >
                  <X size={18} />
                  Reject
                </button>
              </div>
            )}

            {selectedApproval.status !== "pending" && (
              <div className="bg-muted rounded p-4 text-sm">
                <div className="text-muted-foreground mb-2">
                  Resolved {selectedApproval.resolvedAt && new Date(selectedApproval.resolvedAt).toLocaleDateString()}
                </div>
                {selectedApproval.resolvedBy && (
                  <div className="text-muted-foreground">by {selectedApproval.resolvedBy}</div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 border border-border rounded-lg bg-card flex items-center justify-center">
          <p className="text-muted-foreground">Select an approval to view details</p>
        </div>
      )}
    </div>
  );
}
