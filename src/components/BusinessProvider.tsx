"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface Workspace {
  _id: string;
  name: string;
  slug: string;
  color?: string;
  emoji?: string;
  description?: string;
  missionStatement?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setCurrentWorkspace: (workspace: Workspace) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Query all workspaces with fallback to empty array
  const workspaces = useQuery(api.workspaces.getAll);
  const defaultWorkspace = useQuery(api.workspaces.getDefaultWorkspace);

  // Provide default empty arrays if queries are still loading
  const workspacesData = workspaces ?? [];
  const defaultWorkspaceData = defaultWorkspace ?? null;

  // Determine current workspace from URL or fallback
  useEffect(() => {
    // If data is still loading (null), don't proceed
    if (workspaces === undefined || defaultWorkspace === undefined) {
      return;
    }

    // If we have no workspaces data, clear loading (empty state is valid)
    if (workspacesData.length === 0) {
      setIsLoading(false);
      return;
    }

    let workspace: Workspace | null = null;

    // 1. Try to get workspaceSlug from URL params
    const workspaceSlug = params?.workspaceSlug as string;
    if (workspaceSlug) {
      workspace = workspacesData.find((w) => w.slug === workspaceSlug) || null;
    }

    // 2. Fall back to localStorage
    if (!workspace) {
      const savedSlug = localStorage.getItem("mission-control:workspaceSlug");
      if (savedSlug) {
        workspace = workspacesData.find((w) => w.slug === savedSlug) || null;
      }
    }

    // 3. Fall back to default workspace
    if (!workspace && defaultWorkspaceData) {
      workspace = defaultWorkspaceData;
    }

    // 4. Fall back to first workspace
    if (!workspace && workspacesData.length > 0) {
      workspace = workspacesData[0];
    }

    setCurrentWorkspaceState(workspace);
    setIsLoading(false);

    // Save to localStorage for persistence
    if (workspace) {
      localStorage.setItem("mission-control:workspaceSlug", workspace.slug);
    }
  }, [workspaces, defaultWorkspace, workspacesData, defaultWorkspaceData, params?.workspaceSlug]);

  // Handle switching to a different workspace
  const setCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    localStorage.setItem("mission-control:workspaceSlug", workspace.slug);

    // Determine current tab from URL
    const currentTab = (params?.tab as string) || "overview";

    // Navigate to new workspace with same tab
    router.push(`/${workspace.slug}/${currentTab}`);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces: workspacesData,
        setCurrentWorkspace,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
