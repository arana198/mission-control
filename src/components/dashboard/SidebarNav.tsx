"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, Map, LayoutGrid, Users, Briefcase, Activity,
  Calendar, Brain, AlertCircle, Zap, Moon, Sun, ChevronLeft, ChevronRight, Inbox
} from "lucide-react";
import { Sparkles } from "lucide-react";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "bottlenecks" | "sync" | "analytics" | "settings" | "inbox";

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
  { id: "inbox", label: "Agent Inbox", icon: Inbox },
  { id: "workload", label: "Workload", icon: Briefcase },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "brain", label: "2nd Brain", icon: Brain },
  { id: "bottlenecks", label: "Bottlenecks", icon: AlertCircle },
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
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  // Persist sidebar collapse state to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("mission-control:sidebarCollapsed");
    if (saved !== null) {
      setDesktopCollapsed(JSON.parse(saved));
    }
  }, []);

  const handleCollapsedChange = (collapsed: boolean) => {
    setDesktopCollapsed(collapsed);
    localStorage.setItem("mission-control:sidebarCollapsed", JSON.stringify(collapsed));
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
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
        className={`${mobileOpen ? "block" : "hidden"} md:flex md:flex-col transition-all duration-300 ease-in-out ${
          desktopCollapsed ? "md:w-20" : "md:w-64"
        } border-r bg-muted/30 flex-shrink-0 fixed md:relative top-16 md:top-0 left-0 right-0 md:max-h-screen z-40`}
      >
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between gap-3">
          {!desktopCollapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="hidden md:block min-w-0">
                <h1 className="font-semibold text-sm truncate">Mission Control</h1>
                <p className="text-xs text-muted-foreground truncate">Agent Squad</p>
              </div>
            </div>
          )}
          <button
            onClick={() => handleCollapsedChange(!desktopCollapsed)}
            className="hidden md:inline-flex p-1.5 hover:bg-muted rounded transition-colors flex-shrink-0"
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
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
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                aria-current={isActive ? "page" : undefined}
                title={desktopCollapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!desktopCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t">
          <div className={`flex items-center ${desktopCollapsed ? "justify-center" : "justify-between"} gap-2`}>
            {!desktopCollapsed && (
              <span className="text-xs text-muted-foreground truncate">
                {activeCount}/{totalAgents} agents
              </span>
            )}
            <button
              onClick={onThemeToggle}
              className="theme-toggle p-1 hover:bg-muted rounded transition-colors"
              aria-label="Toggle theme"
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
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
