import { createContext } from "react";

export type PanelType = "livefeed" | "chat" | null;

export interface PanelContextType {
  openPanel: PanelType;
  setOpenPanel: (panel: PanelType) => void;
  selectedTaskId: string | null;
  setSelectedTaskForChat: (taskId: string) => void;
}

export const PanelContext = createContext<PanelContextType | undefined>(
  undefined
);
