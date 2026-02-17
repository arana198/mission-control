"use client";

import { useState } from "react";
import {
  BarChart3, Map, LayoutGrid, Users, Briefcase, Activity,
  Calendar, Brain, Target, AlertCircle, Zap, Moon, Sun
} from "lucide-react";
import { Sparkles } from "lucide-react";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "okr" | "bottlenecks" | "sync" | "settings";

interface SidebarNavProps {
  activeTab: TabType;
  activeCount: number;
  totalAgents: number;
  theme: string;
  onTabChange: (tab: TabType) => void;
  onThemeToggle: () => void;
}

const NAV_ITEMS = [
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
  { id: "settings", label: "Settings", icon: Zap },
];

export function SidebarNav({
  activeTab,
  activeCount,
  totalAgents,
  theme,
  onTabChange,
  onThemeToggle,
}: SidebarNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Mission Control</h1>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 hover:bg-muted rounded"
          aria-label="Toggle menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${mobileOpen ? "block" : "hidden"} md:block w-full md:w-64 border-r bg-muted/30 flex-shrink-0 flex flex-col fixed md:relative top-16 md:top-0 left-0 right-0 md:max-h-screen z-40`}
      >
        {/* Logo */}
        <div className="p-4 border-b flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Mission Control</h1>
            <p className="text-xs text-muted-foreground">Agent Squad</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id as TabType);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-500/10 text-blue-600"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {activeCount}/{totalAgents} agents active
            </span>
            <button
              onClick={onThemeToggle}
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
