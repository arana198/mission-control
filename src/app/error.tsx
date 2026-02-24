"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card p-8 bg-red-50 border border-red-200 rounded-lg max-w-md w-full">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h2 className="font-semibold text-red-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-red-700 mb-4">{error.message || "An unexpected error occurred."}</p>
            <button onClick={reset} className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
              <RotateCcw className="w-4 h-4" /> Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
