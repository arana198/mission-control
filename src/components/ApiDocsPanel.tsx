"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getAllApiEndpoints, getCategories } from "@/lib/api-docs-generator";
import type { ApiDocEndpoint } from "@/lib/api-docs-generator";

/**
 * API Documentation Panel
 *
 * Automatically generated from api-docs-generator.ts
 * To add new endpoints to documentation:
 * 1. Add endpoint metadata to DOCUMENTED_ENDPOINTS in lib/api-docs-generator.ts
 * 2. Export API_DOCS constant from your route handler
 * 3. Refresh the page - documentation updates automatically
 */
export function ApiDocsPanel() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const allEndpoints = getAllApiEndpoints();
  const categories = getCategories();

  // Filter endpoints by category if selected
  const displayedEndpoints = selectedCategory
    ? allEndpoints.filter(ep => ep.category === selectedCategory)
    : allEndpoints;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">API Reference</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Complete documentation for all available endpoints ({displayedEndpoints.length} endpoints)
        </p>

        {/* Base URL & Auth Info */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">BASE URL</p>
            <code className="block bg-muted text-muted-foreground px-3 py-2 rounded text-sm font-mono">
              {baseUrl}
            </code>
          </div>

          {/* Categories Filter */}
          {categories.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">FILTER BY CATEGORY</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    selectedCategory === null
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({allEndpoints.length})
                </button>
                {categories.map(cat => {
                  const count = allEndpoints.filter(ep => ep.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        selectedCategory === cat
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auth Requirements */}
          <div className="bg-blue-900/20 border border-blue-800/30 rounded p-4">
            <p className="text-sm text-blue-100 font-semibold mb-2">📚 How to Add New Endpoints</p>
            <p className="text-xs text-blue-200">
              1. Add endpoint metadata to <code className="bg-blue-900/50 px-1 py-0.5 rounded">DOCUMENTED_ENDPOINTS</code> in{" "}
              <code className="bg-blue-900/50 px-1 py-0.5 rounded">lib/api-docs-generator.ts</code>
              <br />
              2. Specify: method, path, summary, description, request/response
              <br />
              3. Set category for filtering
              <br />
              4. Documentation auto-updates!
            </p>
          </div>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="flex-1 overflow-y-auto">
        {displayedEndpoints.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted-foreground">
            No endpoints found in category "{selectedCategory}"
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayedEndpoints.map((endpoint, idx) => {
              const id = `${endpoint.method}-${endpoint.path}`;
              const isExpanded = expandedId === id;
              const methodColor =
                endpoint.method === "GET"
                  ? "bg-green-900/30 text-green-400 border-green-800"
                  : endpoint.method === "POST"
                  ? "bg-blue-900/30 text-blue-400 border-blue-800"
                  : endpoint.method === "PUT"
                  ? "bg-yellow-900/30 text-yellow-400 border-yellow-800"
                  : "bg-red-900/30 text-red-400 border-red-800";

              return (
                <div key={idx} className="border-l-4 border-l-transparent hover:border-l-accent transition-colors">
                  {/* Collapsed Row */}
                  <button
                    onClick={() => toggleExpand(id)}
                    className="w-full px-6 py-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    )}

                    <div className={`px-2 py-1 rounded text-xs font-bold border ${methodColor}`}>
                      {endpoint.method}
                    </div>

                    <code className="text-sm font-mono text-foreground flex-1">{endpoint.path}</code>

                    {endpoint.category && (
                      <span className="text-xs bg-purple-900/30 text-purple-400 border border-purple-800/30 px-2 py-1 rounded">
                        {endpoint.category}
                      </span>
                    )}

                    {endpoint.auth && (
                      <span className="text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-800/30 px-2 py-1 rounded">
                        Auth
                      </span>
                    )}
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-muted/20 space-y-4 border-t border-border">
                      {/* Summary & Description */}
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">{endpoint.summary}</h4>
                        <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                      </div>

                      {/* Request Fields Table */}
                      {endpoint.request?.fields && endpoint.request.fields.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Request Parameters</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-2 px-2 font-semibold">Parameter</th>
                                  <th className="text-left py-2 px-2 font-semibold">Type</th>
                                  <th className="text-left py-2 px-2 font-semibold">Required</th>
                                  <th className="text-left py-2 px-2 font-semibold">Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {endpoint.request.fields.map((field, fieldIdx) => (
                                  <tr key={fieldIdx} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-2 px-2 font-mono text-foreground">{field.name}</td>
                                    <td className="py-2 px-2 text-muted-foreground">{field.type}</td>
                                    <td className="py-2 px-2">
                                      <span
                                        className={
                                          field.required
                                            ? "text-red-400 font-semibold"
                                            : "text-muted-foreground"
                                        }
                                      >
                                        {field.required ? "Yes" : "No"}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-muted-foreground">{field.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Request Example */}
                      {endpoint.request?.example && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Request Example</h4>
                          <pre className="bg-muted px-3 py-2 rounded text-xs font-mono text-foreground overflow-x-auto">
                            {JSON.stringify(endpoint.request.example, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Response Example */}
                      {endpoint.response?.example && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Response Example</h4>
                          <pre className="bg-muted px-3 py-2 rounded text-xs font-mono text-foreground overflow-x-auto">
                            {JSON.stringify(endpoint.response.example, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Curl Example */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Example (curl)</h4>
                        <pre className="bg-muted px-3 py-2 rounded text-xs font-mono text-foreground overflow-x-auto">
                          {generateCurlExample(endpoint, baseUrl)}
                        </pre>
                      </div>

                      {/* Tags */}
                      {endpoint.tags && endpoint.tags.length > 0 && (
                        <div>
                          <div className="flex flex-wrap gap-2">
                            {endpoint.tags.map((tag, tagIdx) => (
                              <span
                                key={tagIdx}
                                className="text-xs bg-gray-900/30 text-gray-400 border border-gray-800/30 px-2 py-1 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Generate curl example for endpoint
 */
function generateCurlExample(endpoint: ApiDocEndpoint, baseUrl: string): string {
  const method = endpoint.method;
  const path = endpoint.path;

  if (method === "GET") {
    const queryParams = endpoint.request?.fields
      ?.filter(f => f.required)
      ?.map(f => `${f.name}=<${f.name}>`)
      ?.join("&") || "";
    return `curl "${baseUrl}${path}${queryParams ? "?" + queryParams : ""}"`;
  }

  // POST/PUT/DELETE
  const exampleBody = endpoint.request?.example || {};
  return `curl -X ${method} ${baseUrl}${path} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(exampleBody, null, 2)}'`;
}
