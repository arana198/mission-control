"use client";

import { useContext } from "react";
import { PanelContext } from "@/contexts/PanelContext";

/**
 * usePanels Hook
 * Provides access to panel state and panel-control functions
 * Can be used in any component within the DashboardLayout
 */
export function usePanels() {
  const ctx = useContext(PanelContext);
  if (!ctx) {
    throw new Error("usePanels must be used within DashboardLayout");
  }
  return ctx;
}
