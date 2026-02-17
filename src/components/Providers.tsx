"use client";

import { ConvexClientProvider } from "./ConvexClientProvider";
import { ThemeProvider } from "./ThemeProvider";
import { NotificationContainer } from "./NotificationContainer";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <ThemeProvider>
        {children}
        <NotificationContainer />
      </ThemeProvider>
    </ConvexClientProvider>
  );
}
