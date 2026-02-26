"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card p-8 bg-destructive/10 border border-destructive/30 rounded-lg max-w-md w-full">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
          <div>
            <h2 className="font-semibold text-destructive mb-2">Something went wrong</h2>
            <p className="text-sm text-destructive mb-4">{error.message || "An unexpected error occurred."}</p>
            <button onClick={reset} className="inline-flex items-center gap-2 px-3 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 text-sm">
              <RotateCcw className="w-4 h-4" /> Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
