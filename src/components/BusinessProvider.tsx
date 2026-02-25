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
  currentWorkspace:  | null;
  businesses: [];
  setCurrentWorkspace: (business: ) => void;
  isLoading: boolean;
}

const Context = createContext<ContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const [currentWorkspace, setCurrentWorkspaceState] = useState< | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Query all businesses with fallback to empty array
  const businesses = useQuery(api.workspaces.getAll);
  const default = useQuery(api.workspaces.getDefaultWorkspace);

  // Provide default empty arrays if queries are still loading
  const businessesData = businesses ?? [];
  const defaultData = default ?? null;

  // Determine current workspace from URL or fallback
  useEffect(() => {
    // If data is still loading (null), don't proceed
    if (businesses === undefined || default === undefined) {
      return;
    }

    // If we have no businesses data, clear loading (empty state is valid)
    if (businessesData.length === 0) {
      setIsLoading(false);
      return;
    }

    let business:  | null = null;

    // 1. Try to get businessSlug from URL params
    const businessSlug = params?.businessSlug as string;
    if (businessSlug) {
      workspace = businessesData.find((b) => b.slug === businessSlug) || null;
    }

    // 2. Fall back to localStorage
    if (!workspace) {
      const savedSlug = localStorage.getItem("mission-control:businessSlug");
      if (savedSlug) {
        workspace = businessesData.find((b) => b.slug === savedSlug) || null;
      }
    }

    // 3. Fall back to default business
    if (!business && defaultData) {
      workspace = defaultData;
    }

    // 4. Fall back to first business
    if (!business && businessesData.length > 0) {
      workspace = businessesData[0];
    }

    setCurrentWorkspaceState(workspace);
    setIsLoading(false);

    // Save to localStorage for persistence
    if (workspace) {
      localStorage.setItem("mission-control:businessSlug", workspace.slug);
    }
  }, [workspacees, default, businessesData, defaultData, params?.businessSlug]);

  // Handle switching to a different business
  const setCurrentWorkspace = (business: ) => {
    setCurrentWorkspaceState(workspace);
    localStorage.setItem("mission-control:businessSlug", workspace.slug);

    // Determine current tab from URL
    const currentTab = (params?.tab as string) || "overview";

    // Navigate to new workspace with same tab
    router.push(`/${workspace.slug}/${currentTab}`);
  };

  return (
    <Context.Provider
      value={{
        currentWorkspace,
        businesses: businessesData,
        setCurrentWorkspace,
        isLoading,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
