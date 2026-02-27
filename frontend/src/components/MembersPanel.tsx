"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { UserPlus, Trash2, Shield, User } from "lucide-react";

/**
 * Members Panel Component
 * Phase 2 RBAC UI: Manage organization members
 */
interface MembersPanelProps {
  workspaceId: Id<"workspaces">;
}

export function MembersPanel({ workspaceId }: MembersPanelProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "owner">("member");
  const [error, setError] = useState<string | null>(null);

  // Queries
  const members = useQuery(api.organizationMembers.getMembers, { workspaceId });

  // Mutations
  const removeMember = useMutation(api.organizationMembers.removeMember);
  const updateMember = useMutation(api.organizationMembers.updateMember);
  const createInvite = useMutation(api.invites.createInvite);

  const handleRemoveMember = async (memberId: string) => {
    if (confirm("Remove this member?")) {
      try {
        await removeMember({ memberId: memberId as any });
      } catch (error) {
        console.error("Failed to remove member:", error);
      }
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      await updateMember({
        memberId: memberId as any,
        role: newRole as "owner" | "admin" | "member",
      });
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const getRoleIcon = (role: string) => {
    return role === "owner" ? (
      <Shield className="w-4 h-4 text-warning" />
    ) : (
      <User className="w-4 h-4 text-muted-foreground" />
    );
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Members</h2>
          <p className="text-sm text-muted-foreground">{members?.length || 0} members in this organization</p>
        </div>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded px-4 py-2 font-medium transition-colors"
        >
          <UserPlus size={18} />
          Invite Member
        </button>
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-card rounded-lg p-4 border border-border space-y-4">
          <h3 className="font-semibold text-white">Invite New Member</h3>
          {error && (
            <div className="bg-destructive/20 border border-destructive/70 rounded p-3 text-destructive/70 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <input
              type="email"
              placeholder="member@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full px-3 py-2 bg-card border border-border rounded text-foreground focus:outline-none focus:border-primary"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setError(null);
                  if (!inviteEmail || !inviteEmail.includes("@")) {
                    setError("Please enter a valid email address");
                    return;
                  }
                  try {
                    await createInvite({
                      workspaceId,
                      email: inviteEmail,
                      role: inviteRole,
                      allBoardsRead: true,
                      allBoardsWrite: false,
                      boardAccess: [],
                      invitedBy: "current-user",
                    });
                    setInviteEmail("");
                    setShowInviteForm(false);
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
                className="flex-1 bg-success hover:bg-success/90 text-success-foreground rounded px-4 py-2 font-medium transition-colors"
              >
                Send Invite
              </button>
              <button
                onClick={() => {
                  setShowInviteForm(false);
                  setError(null);
                }}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground rounded px-4 py-2 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="border border-slate-700 rounded-lg divide-y divide-slate-700">
        {!members || members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No members yet</div>
        ) : (
          members.map((member) => (
            <div key={member._id} className="p-4 hover:bg-surface/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getRoleIcon(member.userRole || member.role || "viewer")}
                    <h3 className="font-semibold text-white">{member.userName || member.userId}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(member.userRole || member.role || "viewer")}`}>
                      {member.userRole || member.role || "viewer"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{member.userEmail || "No email"}</p>
                  <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                    {member.allBoardsRead && <span>📖 Read All</span>}
                    {member.allBoardsWrite && <span>✏️ Write All</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleChangeRole(member._id, e.target.value)}
                    className="px-3 py-1 bg-card border border-border rounded text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>

                  <button
                    onClick={() => handleRemoveMember(member._id)}
                    className="p-2 text-destructive hover:text-destructive hover:bg-destructive/20 rounded transition-colors"
                    title="Remove member"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
