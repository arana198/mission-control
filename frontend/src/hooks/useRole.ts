"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "./useCurrentUser";

/**
 * useRole Hook
 *
 * Queries organizationMembers for current user + current business
 *
 * Returns:
 * - role: "owner" | "admin" | "member" | undefined
 * - isOwner: boolean
 * - isAdmin: boolean
 * - canWrite: boolean (either allBoardsWrite=true or member exists)
 * - canRead: boolean (always true if member exists)
 * - isLoading: boolean
 */
export function useRole(workspaceId?: Id<"workspaces">): {
  role?: string;
  isOwner: boolean;
  isAdmin: boolean;
  canWrite: boolean;
  canRead: boolean;
  isLoading: boolean;
} {
  const { userId, isLoading: userLoading } = useCurrentUser();

  // Query member info (skip if no workspaceId or still loading userId)
  const member = useQuery(
    api.organizationMembers.getMemberByUser,
    workspaceId && !userLoading
      ? { workspaceId, userId }
      : "skip"
  );

  const isLoading = userLoading || member === undefined;
  const role = member?.role;
  const isOwner = role === "owner";
  const isAdmin = role === "owner" || role === "admin";
  const canRead = !!member;
  const canWrite = !!member && (member.allBoardsWrite || role === "owner" || role === "admin");

  return {
    role,
    isOwner,
    isAdmin,
    canRead,
    canWrite,
    isLoading,
  };
}
