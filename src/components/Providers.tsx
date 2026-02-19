"use client";

import { ConvexClientProvider } from "./ConvexClientProvider";
import { ThemeProvider } from "./ThemeProvider";
import { BusinessProvider } from "./BusinessProvider";
import { NotificationContainer } from "./NotificationContainer";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <ThemeProvider>
        <BusinessProvider>
          {children}
          <NotificationContainer />
        </BusinessProvider>
      </ThemeProvider>
    </ConvexClientProvider>
  );
}
