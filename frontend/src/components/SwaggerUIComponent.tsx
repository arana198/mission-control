"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUIBundle = dynamic(
  () => import("swagger-ui-react").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="p-6 text-center">Loading API documentation...</div> }
);

interface SwaggerUIComponentProps {
  specUrl: string;
}

/**
 * Swagger UI Component
 *
 * Renders interactive API documentation with "Try it out" functionality
 * Fetches OpenAPI spec from /api/openapi endpoint
 */
export function SwaggerUIComponent({ specUrl }: SwaggerUIComponentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-6 text-center">Loading API documentation...</div>;
  }

  return (
    <div className="swagger-ui-wrapper">
      <style>{`
        .swagger-ui-wrapper {
          background: var(--background);
          color: var(--foreground);
        }

        .swagger-ui-wrapper .topbar {
          background-color: var(--muted);
          border-bottom: 1px solid var(--border);
        }

        .swagger-ui-wrapper .topbar a {
          color: var(--accent);
        }

        .swagger-ui-wrapper .info .title {
          color: var(--foreground);
        }

        .swagger-ui-wrapper .btn {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--accent-foreground);
        }

        .swagger-ui-wrapper .btn:hover {
          background: var(--accent);
          opacity: 0.8;
        }

        .swagger-ui-wrapper table {
          background-color: var(--muted);
          border-collapse: collapse;
        }

        .swagger-ui-wrapper table tr {
          border-bottom: 1px solid var(--border);
        }

        .swagger-ui-wrapper table td,
        .swagger-ui-wrapper table th {
          padding: 12px;
          text-align: left;
          border: 1px solid var(--border);
        }

        .swagger-ui-wrapper .model {
          background-color: var(--muted);
          border: 1px solid var(--border);
        }

        .swagger-ui-wrapper .scheme-container {
          background: var(--muted);
          border: 1px solid var(--border);
          padding: 20px;
          margin-bottom: 20px;
          border-radius: 8px;
        }

        .swagger-ui-wrapper .try-out {
          background: var(--muted);
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 15px;
        }

        .swagger-ui-wrapper .highlight-code {
          background: var(--muted);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--foreground);
        }

        .swagger-ui-wrapper input[type="text"],
        .swagger-ui-wrapper input[type="password"],
        .swagger-ui-wrapper textarea,
        .swagger-ui-wrapper select {
          background: var(--background);
          border: 1px solid var(--border);
          color: var(--foreground);
          border-radius: 4px;
          padding: 8px 12px;
        }

        .swagger-ui-wrapper input[type="text"]:focus,
        .swagger-ui-wrapper textarea:focus,
        .swagger-ui-wrapper select:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent)/10;
        }

        .swagger-ui-wrapper .response-col_status {
          background: var(--muted);
        }

        .swagger-ui-wrapper pre {
          background: var(--muted);
          border: 1px solid var(--border);
          color: var(--foreground);
          border-radius: 4px;
          padding: 12px;
          overflow-x: auto;
        }

        .swagger-ui-wrapper .opblock {
          border: 1px solid var(--border);
          border-radius: 4px;
          margin-bottom: 15px;
        }

        .swagger-ui-wrapper .opblock.opblock-get {
          background: rgba(0, 128, 0, 0.05);
          border-left: 4px solid #22c55e;
        }

        .swagger-ui-wrapper .opblock.opblock-post {
          background: rgba(0, 0, 255, 0.05);
          border-left: 4px solid #3b82f6;
        }

        .swagger-ui-wrapper .opblock.opblock-put {
          background: rgba(255, 165, 0, 0.05);
          border-left: 4px solid #f59e0b;
        }

        .swagger-ui-wrapper .opblock.opblock-patch {
          background: rgba(128, 0, 128, 0.05);
          border-left: 4px solid #a855f7;
        }

        .swagger-ui-wrapper .opblock.opblock-delete {
          background: rgba(255, 0, 0, 0.05);
          border-left: 4px solid #ef4444;
        }

        .swagger-ui-wrapper .opblock-summary {
          padding: 15px;
          cursor: pointer;
          user-select: none;
        }

        .swagger-ui-wrapper .opblock-summary-path {
          font-family: monospace;
          font-size: 14px;
          color: var(--foreground);
        }

        .swagger-ui-wrapper .opblock-summary-description {
          color: var(--muted-foreground);
          font-size: 13px;
        }

        .swagger-ui-wrapper .parameter__name {
          color: var(--foreground);
          font-weight: 600;
        }

        .swagger-ui-wrapper .parameter__type {
          color: var(--muted-foreground);
        }

        .swagger-ui-wrapper .btn-try-out {
          background: var(--accent);
          border: 1px solid var(--accent);
          color: var(--accent-foreground);
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .swagger-ui-wrapper .btn-try-out:hover {
          opacity: 0.8;
        }

        .swagger-ui-wrapper .response-col_status {
          background: var(--muted);
          padding: 10px;
          border-radius: 4px;
        }
      `}</style>
      <SwaggerUIBundle url={specUrl} />
    </div>
  );
}
