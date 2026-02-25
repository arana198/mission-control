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
  businessId: Id<"businesses">;
}

export function MembersPanel({ businessId }: MembersPanelProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "owner">("member");
  const [error, setError] = useState<string | null>(null);

  // Queries
  const members = useQuery(api.organizationMembers.getMembers, { businessId });

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
      <Shield className="w-4 h-4 text-yellow-400" />
    ) : (
      <User className="w-4 h-4 text-gray-400" />
    );
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-yellow-900/30 text-yellow-300";
      case "admin":
        return "bg-blue-900/30 text-blue-300";
      default:
        return "bg-slate-700 text-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Members</h2>
          <p className="text-sm text-gray-400">{members?.length || 0} members in this organization</p>
        </div>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-medium transition-colors"
        >
          <UserPlus size={18} />
          Invite Member
        </button>
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <h3 className="font-semibold text-white">Invite New Member</h3>
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <input
              type="email"
              placeholder="member@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
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
                      businessId,
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
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded px-4 py-2 font-medium transition-colors"
              >
                Send Invite
              </button>
              <button
                onClick={() => {
                  setShowInviteForm(false);
                  setError(null);
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded px-4 py-2 font-medium transition-colors"
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
          <div className="p-8 text-center text-gray-400">No members yet</div>
        ) : (
          members.map((member) => (
            <div key={member._id} className="p-4 hover:bg-slate-900/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getRoleIcon(member.role)}
                    <h3 className="font-semibold text-white">{member.userName || member.userId}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{member.userEmail || "No email"}</p>
                  <div className="flex gap-2 mt-2 text-xs text-gray-500">
                    {member.allBoardsRead && <span>📖 Read All</span>}
                    {member.allBoardsWrite && <span>✏️ Write All</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleChangeRole(member._id, e.target.value)}
                    className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>

                  <button
                    onClick={() => handleRemoveMember(member._id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
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
