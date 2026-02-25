import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ReactNode } from "react";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BusinessProvider } from "@/components/BusinessProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClientLayout } from "./ClientLayout";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mission Control",
  description: "Agent autonomy orchestration platform",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ErrorBoundary>
          <ConvexClientProvider>
            <ThemeProvider>
              <BusinessProvider>
                <ClientLayout>{children}</ClientLayout>
              </BusinessProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
