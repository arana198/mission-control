"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, AlertCircle, RefreshCw, Settings, Link, Unlink } from "lucide-react";
import clsx from "clsx";

/**
 * Calendar Sync Control Panel
 * 
 * Displays:
 * - Google Calendar connection status
 * - Sync direction settings
 * - Conflict detection + resolution
 * - Last sync time + next scheduled sync
 */
export function CalendarSyncPanel() {
  const [connected, setConnected] = useState(false);
  const [syncMode, setSyncMode] = useState<'two_way' | 'mc_to_google' | 'google_to_mc'>('two_way');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<number>(0);
  const [syncInProgress, setSyncInProgress] = useState(false);

  const handleConnect = () => {
    // In production: Redirect to Google OAuth
    // const url = calendarSyncService.getAuthorizationUrl(`${window.location.origin}/api/calendar/oauth-callback`);
    // window.location.href = url;
    
    // Mock
    setConnected(true);
    setLastSync(Date.now());
  };

  const handleDisconnect = () => {
    setConnected(false);
    setLastSync(null);
  };

  const handleManualSync = async () => {
    setSyncInProgress(true);
    // In production: call sync API
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSyncInProgress(false);
    setLastSync(Date.now());
  };

  return (
    <div className="space-y-6 p-4 bg-secondary/30 rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-semibold">Google Calendar Sync</h3>
            <p className="text-xs text-muted-foreground">
              {connected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-sm font-medium text-success">Active</span>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className={clsx(
        "p-4 rounded-lg border",
        connected
          ? "bg-success/10 border-success/30"
          : "bg-muted/50 border-border/50"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">
              {connected ? "Google Calendar Connected" : "Google Calendar Disconnected"}
            </div>
            {lastSync && (
              <div className="text-xs text-muted-foreground mt-1">
                Last synced: {new Date(lastSync).toLocaleString()}
              </div>
            )}
          </div>
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            className={clsx(
              "btn btn-sm",
              connected ? "btn-secondary" : "btn-primary"
            )}
          >
            {connected ? (
              <>
                <Unlink className="w-4 h-4" />
                Disconnect
              </>
            ) : (
              <>
                <Link className="w-4 h-4" />
                Connect
              </>
            )}
          </button>
        </div>
      </div>

      {connected && (
        <>
          {/* Sync Mode Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Sync Direction
            </h4>
            <div className="space-y-2">
              {(["two_way", "mc_to_google", "google_to_mc"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 cursor-pointer hover:bg-background transition-colors">
                  <input
                    type="radio"
                    name="syncMode"
                    value={mode}
                    checked={syncMode === mode}
                    onChange={(e) => setSyncMode(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">
                      {mode === "two_way"
                        ? "Two-Way Sync"
                        : mode === "mc_to_google"
                          ? "Mission Control → Google"
                          : "Google → Mission Control"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {mode === "two_way"
                        ? "Sync events in both directions"
                        : mode === "mc_to_google"
                          ? "Push MC tasks to Google Calendar only"
                          : "Import Google Calendar events as MC tasks"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Conflict Detection */}
          {conflicts > 0 && (
            <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm text-warning">
                <AlertCircle className="w-4 h-4" />
                {conflicts} Scheduling Conflict{conflicts !== 1 ? "s" : ""}
              </div>
              <button
                className="text-xs text-warning hover:underline"
                aria-label="Review and resolve scheduling conflicts"
              >
                Review and resolve conflicts
              </button>
            </div>
          )}

          {/* Manual Sync */}
          <div className="flex gap-2">
            <button
              onClick={handleManualSync}
              disabled={syncInProgress}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {syncInProgress ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync Now
                </>
              )}
            </button>
            <button className="btn btn-secondary">Settings</button>
          </div>

          {/* Sync Metrics */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-background/50 rounded-lg border border-border/50">
            <div>
              <div className="text-2xl font-bold">--</div>
              <div className="text-xs text-muted-foreground">Events Synced</div>
            </div>
            <div>
              <div className="text-2xl font-bold">1h</div>
              <div className="text-xs text-muted-foreground">Next Sync</div>
            </div>
            <div>
              <div className="text-2xl font-bold">2-Way</div>
              <div className="text-xs text-muted-foreground">Active Mode</div>
            </div>
          </div>
        </>
      )}

      {/* Help Text */}
      <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-xs text-primary">
        💡 <strong>Pro Tip:</strong> Enable two-way sync to keep your calendar and Mission Control tasks in perfect sync. Automatic syncs happen hourly.
      </div>
    </div>
  );
}
