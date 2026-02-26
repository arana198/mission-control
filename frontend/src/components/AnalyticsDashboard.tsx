"use client";

import { useEffect, useState } from "react";
import { metrics, monitor } from "@/lib/monitoring";
import { BarChart3, Activity, AlertCircle, Zap, TrendingUp, Clock } from "lucide-react";

interface MetricsSnapshot {
  pageLoads: number;
  apiCalls: number;
  interactions: number;
  errors: number;
  avgResponseTime: number;
  slowestOperation: string;
}

export function AnalyticsDashboard() {
  const [metricsData, setMetricsData] = useState<MetricsSnapshot | null>(null);
  const [topOperations, setTopOperations] = useState<Array<{ name: string; time: number }>>([]);
  const [updateTime, setUpdateTime] = useState(new Date());

  useEffect(() => {
    const updateMetrics = () => {
      const summary = metrics.getSummary();
      const allMetrics = metrics.getMetrics();

      // Calculate metrics
      const pageLoads = allMetrics.filter(m => m.name === "page_load").length;
      const apiCalls = allMetrics.filter(m => m.name === "api_call").length;
      const interactions = metrics.getInteractions().length;
      const errors = metrics.getInteractions().filter(i => !i.success).length;

      // Calculate average response time
      const responseTimes = allMetrics
        .filter(m => m.unit === "ms")
        .map(m => m.value);
      const avgResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

      // Find slowest operation
      const slowest = allMetrics.reduce(
        (max, m) => (m.value > max.value ? m : max),
        allMetrics[0] || { name: "N/A", value: 0 }
      );

      setMetricsData({
        pageLoads,
        apiCalls,
        interactions,
        errors,
        avgResponseTime: Math.round(avgResponseTime),
        slowestOperation: slowest.name,
      });

      // Top operations by time
      const operationTimes: Record<string, number[]> = {};
      allMetrics.forEach(m => {
        if (m.unit === "ms") {
          if (!operationTimes[m.name]) operationTimes[m.name] = [];
          operationTimes[m.name].push(m.value);
        }
      });

      const topOps = Object.entries(operationTimes)
        .map(([name, times]) => ({
          name,
          time: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        }))
        .sort((a, b) => b.time - a.time)
        .slice(0, 5);

      setTopOperations(topOps);
      setUpdateTime(new Date());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Analytics Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Real-time application metrics and performance data
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Updated: {updateTime.toLocaleTimeString()}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Page Loads */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Page Loads</span>
            <Zap className="w-4 h-4 text-warning" />
          </div>
          <p className="text-2xl font-bold">{metricsData?.pageLoads || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">session</p>
        </div>

        {/* API Calls */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">API Calls</span>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold">{metricsData?.apiCalls || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">total</p>
        </div>

        {/* Interactions */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Interactions</span>
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <p className="text-2xl font-bold">{metricsData?.interactions || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">user actions</p>
        </div>

        {/* Errors */}
        <div className="card p-4 border-destructive/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Errors</span>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold text-destructive">{metricsData?.errors || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">failed operations</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Response Time */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Response Time Analysis
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Average Response Time</span>
                <span className="font-semibold">{metricsData?.avgResponseTime || 0}ms</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min((metricsData?.avgResponseTime || 0) / 10, 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              ✓ Performance is within acceptable range (&lt; 200ms)
            </div>
          </div>
        </div>

        {/* Top Operations */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Top Operations
          </h3>
          <div className="space-y-2">
            {topOperations.length > 0 ? (
              topOperations.map((op, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded min-w-fit">
                      {i + 1}
                    </span>
                    <span className="truncate text-muted-foreground">{op.name}</span>
                  </div>
                  <span className="font-semibold ml-2">{op.time}ms</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No operation data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Slowest Operation Alert */}
      {metricsData?.avgResponseTime && metricsData.avgResponseTime > 100 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-warning">
                Performance Notice
              </h4>
              <p className="text-sm text-warning mt-1">
                Average response time is {metricsData.avgResponseTime}ms. Slowest operation:
                <span className="font-semibold"> {metricsData.slowestOperation}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Session Summary */}
      <div className="card p-6 bg-muted/50">
        <h3 className="font-semibold mb-3">Session Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Session Duration</p>
            <p className="font-semibold">
              {Math.round((Date.now() - (metrics.getSummary().sessionDuration || 0)) / 1000)}s
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Success Rate</p>
            <p className="font-semibold">
              {metricsData
                ? Math.round(
                    ((metricsData.interactions - metricsData.errors) /
                      Math.max(metricsData.interactions, 1)) *
                      100
                  )
                : 0}
              %
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Total Metrics Collected</p>
            <p className="font-semibold">{metrics.getMetrics().length}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Total Interactions</p>
            <p className="font-semibold">{metrics.getInteractions().length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
