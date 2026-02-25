"use client";

import React from "react";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";

/**
 * Gateway Health Badge Component
 * Displays live health status for a single gateway
 * Shows: checking (gray pulsing dot), healthy (green), unhealthy (red)
 */
interface GatewayHealthBadgeProps {
  gatewayId: string;
  isActive?: boolean;
}

export function GatewayHealthBadge({
  gatewayId,
  isActive = true,
}: GatewayHealthBadgeProps) {
  const { isHealthy, isLoading, error, lastChecked } = useGatewayHealth(
    gatewayId,
    isActive
  );

  const timeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    return `${Math.floor(secs / 3600)}h`;
  };

  // Determine badge color and text
  let bgColor = "bg-muted";
  let textColor = "text-muted-foreground";
  let statusText = "Unknown";
  let dotColor = "bg-muted-foreground/40";

  if (isLoading) {
    bgColor = "bg-card";
    textColor = "text-muted-foreground";
    statusText = "Checking";
    dotColor = "bg-muted-foreground/40 animate-pulse";
  } else if (error) {
    bgColor = "bg-destructive/20";
    textColor = "text-destructive/70";
    statusText = "Error";
    dotColor = "bg-destructive";
  } else if (isHealthy === true) {
    bgColor = "bg-success/20";
    textColor = "text-success/70";
    statusText = "Healthy";
    dotColor = "bg-success";
  } else if (isHealthy === false) {
    bgColor = "bg-destructive/20";
    textColor = "text-destructive/70";
    statusText = "Unhealthy";
    dotColor = "bg-destructive";
  }

  return (
    <div className={`${bgColor} ${textColor} rounded px-3 py-2 text-xs inline-flex items-center gap-2`}>
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full ${dotColor} inline-block`}
        aria-label={`Health status: ${statusText}`}
      />

      {/* Status text */}
      <span>{statusText}</span>

      {/* Last checked info */}
      {lastChecked && !isLoading && (
        <span className="text-xs opacity-75 ml-1">
          ({timeAgo(lastChecked)} ago)
        </span>
      )}

      {/* Error indicator */}
      {error && (
        <span className="text-xs ml-1" title={error}>
          ⚠️
        </span>
      )}
    </div>
  );
}
