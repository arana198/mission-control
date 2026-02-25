"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Copy, Trash2, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";

/**
 * Invites Panel Component
 * Phase 2 RBAC UI: Manage pending and accepted invitations
 */
interface InvitesPanelProps {
  businessId: Id<"businesses">;
}

export function InvitesPanel({ businessId }: InvitesPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queries
  const invites = useQuery(api.invites.getInvites, { businessId });

  // Mutations
  const deleteInvite = useMutation(api.invites.deleteInvite);

  const pendingInvites = invites?.filter((i) => !i.acceptedAt) || [];
  const acceptedInvites = invites?.filter((i) => i.acceptedAt) || [];

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (confirm("Revoke this invitation?")) {
      try {
        await deleteInvite({ inviteId: inviteId as any });
      } catch (error) {
        console.error("Failed to delete invite:", error);
      }
    }
  };

  const timeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-warning/20 text-warning/70";
      case "admin":
        return "bg-primary/20 text-primary/70";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-8">
      {/* Pending Invites */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Pending Invitations ({pendingInvites.length})</h3>

        {pendingInvites.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-8 text-center text-gray-400">
            No pending invitations
          </div>
        ) : (
          <div className="border border-slate-700 rounded-lg divide-y divide-slate-700">
            {pendingInvites.map((invite) => (
              <div key={invite._id} className="p-4 hover:bg-slate-900/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <h4 className="font-semibold text-white">{invite.email}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(invite.role)}`}>
                        {invite.role}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Invited {timeAgo(invite.createdAt)} by {invite.invitedBy}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(invite.token)}
                      className={`flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors ${
                        copiedId === invite.token
                          ? "bg-success/20 text-success/70"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      <Copy size={14} />
                      {copiedId === invite.token ? "Copied" : "Copy Link"}
                    </button>

                    <button
                      onClick={() => handleDeleteInvite(invite._id)}
                      className="p-2 text-destructive hover:text-destructive hover:bg-destructive/20 rounded transition-colors"
                      title="Revoke invitation"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accepted Invites */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Accepted Invitations ({acceptedInvites.length})</h3>

        {acceptedInvites.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-8 text-center text-gray-400">
            No accepted invitations yet
          </div>
        ) : (
          <div className="border border-slate-700 rounded-lg divide-y divide-slate-700">
            {acceptedInvites.map((invite) => (
              <div key={invite._id} className="p-4 hover:bg-slate-900/50 transition-colors opacity-75">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <h4 className="font-semibold text-white">{invite.email}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(invite.role)}`}>
                        {invite.role}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Accepted {formatDate(invite.acceptedAt!)} by {invite.acceptedBy}
                    </p>
                  </div>

                  <span className="px-3 py-1 bg-success/20 text-success/70 text-sm rounded font-medium">
                    Joined
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
