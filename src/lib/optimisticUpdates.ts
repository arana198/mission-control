/**
 * Optimistic Updates & Real-Time Synchronization
 *
 * Implements:
 * - Optimistic UI updates
 * - Rollback on failure
 * - Conflict detection and resolution
 * - Real-time synchronization
 */

import { log } from "./logger";
import { metrics } from "./monitoring";

export interface OptimisticUpdate<T> {
  id: string;
  operation: string;
  previousValue: T;
  optimisticValue: T;
  timestamp: number;
  status: "pending" | "success" | "failed";
}

/**
 * Optimistic update manager
 */
export class OptimisticUpdateManager<T> {
  private updates = new Map<string, OptimisticUpdate<T>>();
  private listeners = new Set<(updates: Map<string, OptimisticUpdate<T>>) => void>();

  /**
   * Start optimistic update
   */
  startUpdate(
    id: string,
    operation: string,
    previousValue: T,
    optimisticValue: T
  ): string {
    const updateId = `${id}:${Date.now()}`;

    const update: OptimisticUpdate<T> = {
      id: updateId,
      operation,
      previousValue,
      optimisticValue,
      timestamp: Date.now(),
      status: "pending",
    };

    this.updates.set(updateId, update);
    this.notifyListeners();

    log.debug(`Optimistic update started: ${operation}`, { id, updateId });
    metrics.recordInteraction({
      action: "optimistic_update_start",
      component: "OptimisticUpdateManager",
      duration: 0,
      success: true,
      metadata: { operation, id },
    });

    return updateId;
  }

  /**
   * Commit optimistic update
   */
  commitUpdate(updateId: string, serverValue?: T): void {
    const update = this.updates.get(updateId);
    if (!update) return;

    update.status = "success";
    update.optimisticValue = serverValue || update.optimisticValue;

    const duration = Date.now() - update.timestamp;
    log.debug(`Optimistic update committed: ${update.operation}`, { updateId, duration });
    metrics.recordInteraction({
      action: "optimistic_update_commit",
      component: "OptimisticUpdateManager",
      duration,
      success: true,
      metadata: { operation: update.operation },
    });

    // Keep for a short time then remove
    setTimeout(() => this.removeUpdate(updateId), 1000);
    this.notifyListeners();
  }

  /**
   * Rollback optimistic update on failure
   */
  rollbackUpdate(updateId: string, error?: Error): void {
    const update = this.updates.get(updateId);
    if (!update) return;

    update.status = "failed";

    const duration = Date.now() - update.timestamp;
    log.warn(
      `Optimistic update rolled back: ${update.operation}`,
      error || new Error("Rollback triggered")
    );
    metrics.recordInteraction({
      action: "optimistic_update_rollback",
      component: "OptimisticUpdateManager",
      duration,
      success: false,
      metadata: { operation: update.operation, error: error?.message },
    });

    // Keep visible for feedback, then remove
    setTimeout(() => this.removeUpdate(updateId), 2000);
    this.notifyListeners();
  }

  /**
   * Get current optimistic value
   */
  getOptimisticValue(id: string): T | undefined {
    // Find most recent pending or successful update for this ID
    const relevant = Array.from(this.updates.values())
      .filter(u => u.id.startsWith(id))
      .sort((a, b) => b.timestamp - a.timestamp);

    return relevant[0]?.optimisticValue;
  }

  /**
   * Get pending updates
   */
  getPendingUpdates(): OptimisticUpdate<T>[] {
    return Array.from(this.updates.values()).filter(u => u.status === "pending");
  }

  /**
   * Subscribe to updates
   */
  subscribe(listener: (updates: Map<string, OptimisticUpdate<T>>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove update
   */
  private removeUpdate(updateId: string): void {
    this.updates.delete(updateId);
    this.notifyListeners();
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.updates));
  }
}

/**
 * Conflict detection and resolution
 */
export class ConflictResolver {
  /**
   * Detect conflict between optimistic and server value
   */
  static detectConflict(optimistic: any, server: any, previous: any): boolean {
    // Simple comparison - can be extended for specific types
    return JSON.stringify(optimistic) !== JSON.stringify(server) &&
           JSON.stringify(server) !== JSON.stringify(previous);
  }

  /**
   * Resolve conflict strategies
   */
  static resolve(
    optimistic: any,
    server: any,
    strategy: "client-wins" | "server-wins" | "merge" = "merge"
  ): any {
    switch (strategy) {
      case "client-wins":
        return optimistic;
      case "server-wins":
        return server;
      case "merge":
        return this.merge(optimistic, server);
      default:
        return server;
    }
  }

  /**
   * Merge optimistic and server values
   */
  private static merge(optimistic: any, server: any): any {
    // For objects, merge properties
    if (typeof optimistic === "object" && typeof server === "object" && optimistic && server) {
      return {
        ...server,
        ...optimistic,
      };
    }

    // For other types, server wins
    return server;
  }
}

/**
 * Real-time synchronization manager
 */
export class RealtimeSyncManager {
  private syncQueue: Array<{ id: string; operation: string; timestamp: number }> = [];
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());
    }
  }

  /**
   * Queue operation for sync
   */
  queueOperation(id: string, operation: string): void {
    this.syncQueue.push({
      id,
      operation,
      timestamp: Date.now(),
    });

    if (this.isOnline) {
      this.flush();
    }
  }

  /**
   * Flush queued operations
   */
  async flush(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    const batch = [...this.syncQueue];
    this.syncQueue = [];

    log.info(`Syncing ${batch.length} queued operations`);

    for (const op of batch) {
      try {
        // Simulate sync
        await new Promise(resolve => setTimeout(resolve, 100));
        log.debug(`Synced operation: ${op.operation}`, { id: op.id });
      } catch (error) {
        log.error("Sync failed", error as Error);
        // Re-queue on failure
        this.syncQueue.push(op);
      }
    }
  }

  /**
   * Handle going online
   */
  private handleOnline(): void {
    this.isOnline = true;
    log.info("Application is online, syncing queued operations");
    this.flush();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.isOnline = false;
    log.warn("Application is offline, operations will be queued");
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      isOnline: this.isOnline,
      queuedOperations: this.syncQueue.length,
      oldestOperation: this.syncQueue[0]?.timestamp,
    };
  }
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate<T>(
  onCommit: (value: T) => Promise<void>,
  onRollback?: (error: Error) => void
) {
  const updateManager = new OptimisticUpdateManager<T>();
  const syncManager = new RealtimeSyncManager();

  return {
    /**
     * Execute operation with optimistic update
     */
    async execute(
      id: string,
      operation: string,
      previousValue: T,
      optimisticValue: T
    ): Promise<void> {
      const updateId = updateManager.startUpdate(id, operation, previousValue, optimisticValue);

      try {
        await onCommit(optimisticValue);
        updateManager.commitUpdate(updateId);
        syncManager.queueOperation(id, operation);
      } catch (error) {
        updateManager.rollbackUpdate(updateId, error instanceof Error ? error : new Error(String(error)));
        onRollback?.(error instanceof Error ? error : new Error(String(error)));
      }
    },

    /**
     * Get current UI value (optimistic or fallback)
     */
    getUIValue(id: string, fallback: T): T {
      return updateManager.getOptimisticValue(id) || fallback;
    },

    /**
     * Get pending updates
     */
    getPending(): OptimisticUpdate<T>[] {
      return updateManager.getPendingUpdates();
    },

    /**
     * Subscribe to updates
     */
    subscribe(listener: (updates: Map<string, OptimisticUpdate<T>>) => void) {
      return updateManager.subscribe(listener);
    },

    /**
     * Get sync status
     */
    getSyncStatus() {
      return syncManager.getQueueStatus();
    },
  };
}
