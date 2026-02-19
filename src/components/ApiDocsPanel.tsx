"use client";

import { Suspense } from "react";
import { SwaggerUIComponent } from "./SwaggerUIComponent";

/**
 * API Documentation Panel
 *
 * Powered by OpenAPI 3.0 specification and Swagger UI
 * Live interactive API documentation with "Try it out" functionality
 *
 * The specification is auto-generated from the OpenAPI generator
 * and served at /api/openapi endpoint
 */
export function ApiDocsPanel() {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">API Reference</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Interactive API documentation powered by OpenAPI 3.0 and Swagger UI. Use "Try it out" to test endpoints directly.
        </p>

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-800/30 rounded p-4">
          <p className="text-sm text-blue-100 font-semibold mb-2">📚 How to Add New Endpoints</p>
          <p className="text-xs text-blue-200">
            1. Add endpoint metadata to <code className="bg-blue-900/50 px-1 py-0.5 rounded">generateOpenAPISpec()</code> in{" "}
            <code className="bg-blue-900/50 px-1 py-0.5 rounded">lib/openapi-generator.ts</code>
            <br />
            2. Specify: method, path, summary, description, request/response schemas
            <br />
            3. Documentation updates automatically from the OpenAPI spec!
          </p>
        </div>
      </div>

      {/* Swagger UI Container */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Loading API documentation...</div>}>
          <SwaggerUIComponent specUrl={`${baseUrl}/api/openapi`} />
        </Suspense>
      </div>
    </div>
  );
}
