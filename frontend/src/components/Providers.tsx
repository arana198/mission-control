"use client";

import { ConvexClientProvider } from "./ConvexClientProvider";
import { ThemeProvider } from "./ThemeProvider";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { NotificationContainer } from "./NotificationContainer";
import { PWAInitializer } from "./PWAInitializer";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <ThemeProvider>
        <WorkspaceProvider>
          <PWAInitializer />
          {children}
          <NotificationContainer />
        </WorkspaceProvider>
      </ThemeProvider>
    </ConvexClientProvider>
  );
}
