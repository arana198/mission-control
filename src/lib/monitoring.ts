/**
 * Monitoring & Analytics System
 *
 * Tracks performance metrics, user interactions, and system health.
 */

export interface MetricEvent {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface UserInteractionEvent {
  action: string;
  component?: string;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

export class Metrics {
  private static instance: Metrics;
  private events: MetricEvent[] = [];
  private interactions: UserInteractionEvent[] = [];
  private sessionStartTime = Date.now();

  private constructor() {}

  static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  recordMetric(event: MetricEvent) {
    this.events.push({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });
  }

  recordInteraction(interaction: UserInteractionEvent) {
    this.interactions.push(interaction);
  }

  // Performance metrics
  recordPageLoad(duration: number) {
    this.recordMetric({
      name: "page_load",
      value: duration,
      unit: "ms",
    });
  }

  recordApiCall(endpoint: string, duration: number, success: boolean) {
    this.recordMetric({
      name: "api_call",
      value: duration,
      unit: "ms",
      tags: {
        endpoint,
        status: success ? "success" : "failure",
      },
    });
  }

  recordComponentRender(componentName: string, duration: number) {
    this.recordMetric({
      name: "component_render",
      value: duration,
      unit: "ms",
      tags: { component: componentName },
    });
  }

  // Query metrics
  recordQuery(queryName: string, duration: number, itemCount: number) {
    this.recordMetric({
      name: "query_execution",
      value: duration,
      unit: "ms",
      tags: {
        query: queryName,
        items: String(itemCount),
      },
    });
  }

  recordDatabaseWrite(operation: string, duration: number, success: boolean) {
    this.recordMetric({
      name: "db_write",
      value: duration,
      unit: "ms",
      tags: {
        operation,
        status: success ? "success" : "failure",
      },
    });
  }

  // User interactions
  recordTaskCreation(duration: number, success: boolean, error?: string) {
    this.recordInteraction({
      action: "task_create",
      component: "CreateTaskModal",
      duration,
      success,
      error,
    });
  }

  recordTaskUpdate(duration: number, success: boolean, error?: string) {
    this.recordInteraction({
      action: "task_update",
      duration,
      success,
      error,
    });
  }

  recordBulkOperation(
    operationType: string,
    itemCount: number,
    duration: number,
    success: boolean
  ) {
    this.recordInteraction({
      action: "bulk_operation",
      duration,
      success,
      metadata: {
        operation: operationType,
        items: itemCount,
      },
    });
  }

  recordSearch(query: string, resultCount: number, duration: number) {
    this.recordInteraction({
      action: "search",
      component: "SearchBar",
      duration,
      success: resultCount >= 0,
      metadata: {
        query,
        results: resultCount,
      },
    });
  }

  // Summary statistics
  getSummary() {
    return {
      sessionDuration: Date.now() - this.sessionStartTime,
      totalMetrics: this.events.length,
      totalInteractions: this.interactions.length,
      avgPageLoadTime:
        this.events
          .filter((e) => e.name === "page_load")
          .reduce((sum, e) => sum + e.value, 0) /
        Math.max(
          this.events.filter((e) => e.name === "page_load").length,
          1
        ),
      failedInteractions: this.interactions.filter((i) => !i.success).length,
    };
  }

  getMetrics() {
    return this.events;
  }

  getInteractions() {
    return this.interactions;
  }

  exportMetrics() {
    return {
      metrics: this.events,
      interactions: this.interactions,
      summary: this.getSummary(),
      timestamp: new Date().toISOString(),
    };
  }

  // Performance observer for Web Vitals
  observeWebVitals() {
    if (typeof window === "undefined") return;

    // Largest Contentful Paint
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric({
            name: "web_vital_lcp",
            value: entry.renderTime || entry.loadTime,
            unit: "ms",
          });
        });
      });
      observer.observe({ entryTypes: ["largest-contentful-paint"] });
    } catch (e) {
      // PerformanceObserver may not be supported
    }

    // First Input Delay
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric({
            name: "web_vital_fid",
            value: entry.processingDuration,
            unit: "ms",
          });
        });
      });
      observer.observe({ entryTypes: ["first-input"] });
    } catch (e) {
      // PerformanceObserver may not be supported
    }

    // Cumulative Layout Shift
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric({
            name: "web_vital_cls",
            value: entry.value,
            unit: "score",
          });
        });
      });
      observer.observe({ entryTypes: ["layout-shift"] });
    } catch (e) {
      // PerformanceObserver may not be supported
    }
  }

  clear() {
    this.events = [];
    this.interactions = [];
    this.sessionStartTime = Date.now();
  }
}

export const metrics = Metrics.getInstance();

// Browser-based monitoring helper
export class PerformanceMonitor {
  private marks = new Map<string, number>();

  start(label: string) {
    this.marks.set(label, performance.now());
  }

  end(label: string): number {
    const startTime = this.marks.get(label);
    if (!startTime) {
      console.warn(`Performance mark "${label}" not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    metrics.recordMetric({
      name: label,
      value: duration,
      unit: "ms",
    });

    this.marks.delete(label);
    return duration;
  }

  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  }
}

export const monitor = new PerformanceMonitor();

// Health check utilities
export class HealthCheck {
  private static checks: Record<string, () => Promise<boolean>> = {};

  static register(name: string, check: () => Promise<boolean>) {
    HealthCheck.checks[name] = check;
  }

  static async runAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, check] of Object.entries(HealthCheck.checks)) {
      try {
        results[name] = await check();
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }
}

// Register default health checks
HealthCheck.register("api_responsive", async () => {
  try {
    const response = await fetch("/api/health", { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
});

HealthCheck.register("ui_responsive", () => {
  return Promise.resolve(typeof document !== "undefined");
});
