"use client";

import { ConvexClientProvider } from "./ConvexClientProvider";
import { ThemeProvider } from "./ThemeProvider";
import { BusinessProvider } from "./BusinessProvider";
import { NotificationContainer } from "./NotificationContainer";
import { PWAInitializer } from "./PWAInitializer";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <ThemeProvider>
        <BusinessProvider>
          <PWAInitializer />
          {children}
          <NotificationContainer />
        </BusinessProvider>
      </ThemeProvider>
    </ConvexClientProvider>
  );
}
