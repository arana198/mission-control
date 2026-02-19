/**
 * Dashboard Layout
 *
 * Provides the main dashboard structure with sidebar navigation
 * Supports dynamic routing for all dashboard tabs
 */

"use client";

import { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import {
  BarChart3, Map, LayoutGrid, Users, Briefcase, Activity, Calendar,
  Brain, AlertCircle, Zap, Moon, Sun, Sparkles, ChevronRight, BookOpen
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

type TabType = "overview" | "board" | "epics" | "agents" | "workload" |
  "activity" | "calendar" | "brain" | "bottlenecks" | "settings" | "analytics" | "api-docs";

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // Extract current tab from pathname
  const currentTab = ((pathname || "").split("/").pop() || "overview") as TabType;

  // Extract business slug from pathname (e.g., "/mission-control-hq/board" -> "mission-control-hq")
  const pathParts = (pathname || "").split("/").filter(Boolean);
  const currentBusinessSlug = pathParts[0] || null;

  const tabs = [
    // Business-scoped tabs
    { id: "overview", label: "Overview", icon: BarChart3, isGlobal: false },
    { id: "epics", label: "Roadmap", icon: Map, isGlobal: false },
    { id: "board", label: "Task Board", icon: LayoutGrid, isGlobal: false },
    { id: "documents", label: "Documents", icon: BookOpen, isGlobal: false },
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
      // Use current business slug or default to overview
      const slug = currentBusinessSlug || "mission-control-hq";
      router.push(`/${slug}/${tabId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Mission Control</h1>
          </div>
        </div>
        <button onClick={toggleTheme} className="p-2 hover:bg-muted rounded">
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className="w-full md:w-64 md:sticky md:top-0 md:h-screen border-r bg-muted/30 flex-shrink-0 flex flex-col max-h-screen overflow-y-auto">
        <div className="hidden md:block p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Mission Control</h1>
              <p className="text-xs text-muted-foreground">Agent Squad</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {tabs.map((tab) => {
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
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:block p-4 border-t">
          <button onClick={toggleTheme} className="w-full p-2 hover:bg-muted rounded-lg">
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        {children}
      </main>
    </div>
  );
}
