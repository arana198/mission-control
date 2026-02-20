/**
 * Dashboard Layout
 *
 * Provides the main dashboard structure with sidebar navigation
 * Supports dynamic routing for all dashboard tabs
 */

"use client";

import { ReactNode, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { BusinessSelector } from "@/components/BusinessSelector";
import { useBusiness } from "@/components/BusinessProvider";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  BarChart3, Map, LayoutGrid, Users, Briefcase, Activity, Calendar,
  Brain, AlertCircle, Zap, Moon, Sun, Sparkles, ChevronRight, BookOpen
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

type TabType = "overview" | "board" | "epics" | "agents" | "workload" |
  "activity" | "calendar" | "brain" | "bottlenecks" | "settings" | "analytics" | "api-docs" | "wiki";

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { currentBusiness } = useBusiness();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Extract current tab from pathname
  const currentTab = ((pathname || "").split("/").pop() || "overview") as TabType;

  // Extract business slug from pathname (e.g., "/mission-control-hq/board" -> "mission-control-hq")
  // Important: "global" is not a business slug, it's a route prefix for global tabs
  const pathParts = (pathname || "").split("/").filter(Boolean);
  const firstPart = pathParts[0];
  const currentBusinessSlug = (firstPart && firstPart !== "global") ? firstPart : null;

  // Get the actual business slug from context (fallback if on global page)
  const businessSlugForNavigation = currentBusinessSlug || currentBusiness?.slug || "mission-control-hq";

  const tabs = [
    // Business-scoped tabs
    { id: "overview", label: "Overview", icon: BarChart3, isGlobal: false },
    { id: "epics", label: "Roadmap", icon: Map, isGlobal: false },
    { id: "board", label: "Task Board", icon: LayoutGrid, isGlobal: false },
    { id: "wiki", label: "Wiki", icon: BookOpen, isGlobal: false },
    { id: "settings", label: "Settings", icon: Zap, isGlobal: false },
    // Global tabs
    { id: "agents", label: "Your Squad", icon: Users, isGlobal: true },
    { id: "workload", label: "Workload", icon: Briefcase, isGlobal: true },
    { id: "activity", label: "Activity", icon: Activity, isGlobal: true },
    { id: "calendar", label: "Calendar", icon: Calendar, isGlobal: true },
    { id: "brain", label: "2nd Brain", icon: Brain, isGlobal: true },
    { id: "bottlenecks", label: "Bottlenecks", icon: AlertCircle, isGlobal: true },
    { id: "analytics", label: "Analytics", icon: BarChart3, isGlobal: true },
    { id: "api-docs", label: "API Docs", icon: BookOpen, isGlobal: true },
  ];

  const handleTabChange = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isGlobal) {
      router.push(`/global/${tabId}`);
    } else {
      // Use business slug from context or navigation logic
      router.push(`/${businessSlugForNavigation}/${tabId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm">Mission Control</h1>
          </div>
        </div>
        <button onClick={toggleTheme} className="p-2 hover:bg-muted rounded flex-shrink-0">
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`w-full transition-all duration-300 md:sticky md:top-0 md:h-screen border-r bg-muted/30 flex-shrink-0 flex flex-col max-h-screen overflow-y-auto ${
        isSidebarCollapsed ? 'md:w-20' : 'md:w-64'
      }`}>
        {/* Header - Always visible */}
        <div className="p-4 border-b transition-all duration-300">
          {!isSidebarCollapsed && (
            <div className="hidden md:flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-sm">Mission Control</h1>
                <p className="text-xs text-muted-foreground">Agent Squad</p>
              </div>
            </div>
          )}

          {/* Business Selector - Hidden when collapsed on desktop */}
          {!isSidebarCollapsed && (
            <div className="hidden md:block">
              <BusinessSelector />
            </div>
          )}
        </div>

        <nav className="flex-1 flex flex-col min-h-0">
          {/* Business-Scoped Tabs */}
          <div className={`flex-shrink-0 p-3 pb-2 space-y-1 transition-all ${isSidebarCollapsed ? 'md:p-2' : ''}`}>
            {!isSidebarCollapsed && (
              <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">BUSINESS</p>
            )}
            {tabs
              .filter(tab => !tab.isGlobal)
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    style={isActive ? {
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-foreground)",
                    } : {
                      color: "var(--muted-foreground)",
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !isActive ? "hover:text-foreground hover:bg-muted" : ""
                    } ${isSidebarCollapsed ? 'md:justify-center md:px-2' : ''}`}
                    title={isSidebarCollapsed ? tab.label : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    {!isSidebarCollapsed && tab.label}
                    {!isSidebarCollapsed && isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
          </div>

          {/* Divider */}
          <div className="flex-shrink-0 px-3 py-1">
            <div className="border-t border-border" />
          </div>

          {/* Global Tabs */}
          <div className={`flex-1 p-3 pt-2 space-y-1 overflow-y-auto transition-all ${isSidebarCollapsed ? 'md:p-2' : ''}`}>
            {!isSidebarCollapsed && (
              <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">WORKSPACE</p>
            )}
            {tabs
              .filter(tab => tab.isGlobal)
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    style={isActive ? {
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-foreground)",
                    } : {
                      color: "var(--muted-foreground)",
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !isActive ? "hover:text-foreground hover:bg-muted" : ""
                    } ${isSidebarCollapsed ? 'md:justify-center md:px-2' : ''}`}
                    title={isSidebarCollapsed ? tab.label : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    {!isSidebarCollapsed && tab.label}
                    {!isSidebarCollapsed && isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
          </div>
        </nav>

        <div className="hidden md:block p-4 border-t">
          <button onClick={toggleTheme} className="w-full p-2 hover:bg-muted rounded-lg">
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Floating Toggle Button (Right edge of sidebar, center vertically) */}
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-background border border-border hover:bg-muted transition-colors absolute top-1/2 -translate-y-1/2 z-10 group"
        style={{
          left: isSidebarCollapsed ? '80px' : '256px',
          transition: 'left 300ms ease-in-out',
        }}
        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronRight className={`w-4 h-4 transition-transform group-hover:scale-110 ${isSidebarCollapsed ? 'rotate-180' : 'rotate-0'}`} />
      </button>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto w-full transition-all duration-300 px-4 py-6 md:px-8 md:py-8 ${isSidebarCollapsed ? 'md:pl-6' : 'md:pl-12'}`}>
        {children}
      </main>
    </div>
  );
}
