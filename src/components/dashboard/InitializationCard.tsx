"use client";

import { Rocket, Loader2 } from "lucide-react";

interface InitializationCardProps {
  isSeeding: boolean;
  error: string | null;
  onInitialize: () => void;
}

export function InitializationCard({
  isSeeding,
  error,
  onInitialize,
}: InitializationCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Rocket className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Mission Control</h1>
        <p className="text-muted-foreground mb-6">
          Initialize your 10-agent squad to begin task coordination
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <button
          onClick={onInitialize}
          disabled={isSeeding}
          className="btn btn-primary w-full disabled:opacity-50"
          aria-busy={isSeeding}
        >
          {isSeeding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Initializing...
            </>
          ) : (
            "Initialize System"
          )}
        </button>
      </div>
    </div>
  );
}
