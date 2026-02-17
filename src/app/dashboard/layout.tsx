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
  Brain, Target, AlertCircle, Zap, Moon, Sun, Sparkles, ChevronRight
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

type TabType = "overview" | "board" | "epics" | "agents" | "workload" |
  "activity" | "calendar" | "brain" | "okr" | "bottlenecks" | "sync" | "settings" | "analytics";

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // Extract current tab from pathname
  const currentTab = ((pathname || "").split("/").pop() || "overview") as TabType;

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "epics", label: "Roadmap", icon: Map },
    { id: "board", label: "Task Board", icon: LayoutGrid },
    { id: "agents", label: "Your Squad", icon: Users },
    { id: "workload", label: "Workload", icon: Briefcase },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "brain", label: "2nd Brain", icon: Brain },
    { id: "okr", label: "OKR Tracking", icon: Target },
    { id: "bottlenecks", label: "Bottlenecks", icon: AlertCircle },
    { id: "sync", label: "Schedule", icon: Calendar },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Zap },
  ];

  const handleTabChange = (tabId: string) => {
    router.push(`/dashboard/${tabId}`);
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
