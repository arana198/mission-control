"use client";

import { ReactNode, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useTheme } from "@/components/ThemeProvider";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { BrandMark } from "@/components/BrandMark";
import { LiveFeedPanel } from "@/components/LiveFeedPanel";
import { BoardChatPanel } from "@/components/BoardChatPanel";
import { PanelContext, type PanelType } from "@/contexts/PanelContext";
import { api } from "@/convex/_generated/api";
import {
  BarChart3, Activity, LayoutDashboard, Zap, Target, Tag, CheckCircle,
  Store, Package, Building2, Bot, Moon, Sun, Bell, Settings, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientLayoutProps {
  children: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { currentWorkspace, workspaces, isLoading } = useWorkspace();
  const [openPanel, setOpenPanel] = useState<PanelType>(null);
  const [selectedTaskId, setSelectedTaskForChat] = useState<string | null>(null);

  // Fetch notifications for badge count with error handling
  const allNotifications = useQuery(api.notifications.getAll);
  const notificationsData = allNotifications ?? [];
  const unreadCount = notificationsData.filter((n: any) => !n.read).length;

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('✓ ClientLayout mounted', {
      currentWorkspace: currentWorkspace?.name,
      notificationsCount: notificationsData.length
    });
  }

  // Determine if we're on a workspace management route (check both pathname and window.location)
  const isWorkspaceManagementRoute =
    pathname?.startsWith("/workspaces") ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith("/workspaces"));

  // Show empty state if no workspaces exist and data is not loading
  // But NOT on workspace management routes (allow /workspaces/* to render normally)
  if (!isLoading && workspaces.length === 0 && !isWorkspaceManagementRoute) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center max-w-md p-8">
          <Building2 className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Welcome to Mission Control</h1>
          <p className="text-muted-foreground mb-6">
            Create your first workspace to get started.
          </p>
          <button
            onClick={() => router.push("/workspaces/new")}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Create Your First Workspace
          </button>
        </div>
      </div>
    );
  }

  // Skip full layout (sidebar, header) for workspace management routes when no workspaces exist
  if (!isLoading && workspaces.length === 0 && isWorkspaceManagementRoute) {
    return <>{children}</>;
  }

  // Extract current tab from pathname
  const currentTab = ((pathname || "").split("/").pop() || "overview");

  // Extract workspace slug from pathname
  const pathParts = (pathname || "").split("/").filter(Boolean);
  const businessSlugFromUrl = pathParts[0];

  // Handle tab changes
  const isTabActive = (tabId: string) => currentTab === tabId;

  const handleTabChange = (tabId: string, isGlobal = false) => {
    if (isGlobal) {
      router.push(`/${tabId}`);
    } else if (businessSlugFromUrl) {
      router.push(`/${businessSlugFromUrl}/${tabId}`);
    }
  };

  // Navigation sections
  const navigationSections = [
    {
      label: "BUSINESS BOARD",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard, isGlobal: false },
        { id: "board", label: "Board", icon: Activity, isGlobal: false },
        { id: "epics", label: "Epics", icon: Zap, isGlobal: false },
        { id: "wiki", label: "Wiki", icon: MessageSquare, isGlobal: false },
        { id: "settings", label: "Settings", icon: Settings, isGlobal: false },
      ],
    },
    {
      label: "ADMINISTRATION",
      items: [
        { id: "workload", label: "Workload", icon: BarChart3, isGlobal: true },
        { id: "api-docs", label: "API Docs", icon: Package, isGlobal: true },
        { id: "businesses", label: "Businesses", icon: Store, isGlobal: true },
        { id: "control", label: "Control", icon: Building2, isGlobal: true },
      ],
    },
  ];

  return (
    <PanelContext.Provider value={{ openPanel, setOpenPanel, selectedTaskId, setSelectedTaskForChat }}>
      <div className="flex h-screen bg-background text-foreground">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 h-16 border-b border-border bg-background/95 backdrop-blur z-40">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center gap-4">
              <BrandMark />
            </div>
            <div className="flex items-center gap-4">
              <WorkspaceSelector />
              <button
                onClick={() => toggleTheme()}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Sidebar */}
        <aside className="fixed left-0 top-16 bottom-0 w-64 border-r border-border bg-background overflow-y-auto">
          <nav className="p-4 space-y-6">
            {navigationSections.map((section) => (
              <div key={section.label}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isTabActive(item.id);
                    const isDisabled = (item as any)?.disabled || false;

                    return (
                      <button
                        key={item.id}
                        onClick={() => !isDisabled && handleTabChange(item.id, item.isGlobal)}
                        disabled={isDisabled}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : isDisabled
                            ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        title={isDisabled ? "Coming soon" : undefined}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer: System Status */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success" />
              System operational
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-8 py-8 ml-64 mt-16">
          {children}
        </main>

        {/* Right Sliding Panels */}
        <LiveFeedPanel
          isOpen={openPanel === "livefeed"}
          onClose={() => setOpenPanel(null)}
          workspaceId={currentWorkspace?._id}
        />
        <BoardChatPanel
          isOpen={openPanel === "chat"}
          onClose={() => setOpenPanel(null)}
          taskId={selectedTaskId}
        />
      </div>
    </PanelContext.Provider>
  );
}
