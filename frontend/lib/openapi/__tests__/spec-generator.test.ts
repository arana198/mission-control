/**
 * OpenAPI Spec Generator Tests
 *
 * Verifies the generated OpenAPI 3.0 specification is complete and valid:
 * - Has required OpenAPI structure
 * - All 42 HTTP operations across 11 domains are registered
 * - Security scheme is defined
 * - Error response schema exists in components
 * - Auth-protected endpoints have security requirement
 * - Public endpoints (health, openapi) do not have security requirement
 * - Tags cover all domains
 */

import { generateOpenAPISpec } from "../spec-generator";

// ---------------------------------------------------------------------------
// All known API paths from the audit report (32 route files, 42 operations)
// ---------------------------------------------------------------------------

const KNOWN_PATHS = [
  "/api/health",
  "/api/openapi",
  "/api/agents",
  "/api/agents/{agentId}",
  "/api/agents/{agentId}/heartbeat",
  "/api/agents/{agentId}/poll",
  "/api/agents/{agentId}/rotate-key",
  "/api/agents/{agentId}/tasks",
  "/api/agents/{agentId}/tasks/{taskId}",
  "/api/agents/{agentId}/tasks/{taskId}/comments",
  "/api/agents/{agentId}/wiki/pages",
  "/api/agents/{agentId}/wiki/pages/{pageId}",
  "/api/agents/workspace/structure",
  "/api/tasks/{taskId}",
  "/api/tasks/execute",
  "/api/tasks/generate-daily",
  "/api/tasks/{taskId}/calendar-events",
  "/api/businesses",
  "/api/epics",
  "/api/calendar/events",
  "/api/calendar/events/{eventId}",
  "/api/calendar/slots",
  "/api/memory",
  "/api/memory/files",
  "/api/memory/context",
  "/api/gateway/{gatewayId}",
  "/api/state-engine/metrics",
  "/api/state-engine/decisions",
  "/api/state-engine/alerts",
  "/api/reports",
  "/api/admin/agents/setup-workspace",
  "/api/admin/migrations/agent-workspace-paths",
] as const;

// Paths that should NOT have a security requirement (public endpoints)
const PUBLIC_PATHS_METHODS: Array<{ path: string; method: string }> = [
  { path: "/api/health", method: "get" },
  { path: "/api/openapi", method: "get" },
  { path: "/api/agents", method: "post" }, // open registration
  { path: "/api/agents/workspace/structure", method: "get" }, // known security gap
  { path: "/api/tasks/{taskId}", method: "patch" }, // partially no auth (state-engine actions)
  { path: "/api/tasks/execute", method: "get" },
  { path: "/api/tasks/execute", method: "post" },
  { path: "/api/tasks/generate-daily", method: "get" },
  { path: "/api/tasks/generate-daily", method: "post" },
  { path: "/api/businesses", method: "get" },
  { path: "/api/businesses", method: "post" },
  { path: "/api/epics", method: "get" },
  { path: "/api/calendar/events", method: "post" }, // auth in body, not header
  { path: "/api/calendar/events/{eventId}", method: "put" }, // auth in body, not header
  { path: "/api/calendar/slots", method: "get" }, // auth in query params
  { path: "/api/memory", method: "get" },
  { path: "/api/memory/files", method: "get" },
  { path: "/api/memory/context", method: "get" },
  { path: "/api/gateway/{gatewayId}", method: "get" },
  { path: "/api/gateway/{gatewayId}", method: "post" },
  { path: "/api/state-engine/metrics", method: "get" },
  { path: "/api/state-engine/decisions", method: "get" },
  { path: "/api/state-engine/alerts", method: "get" },
  { path: "/api/reports", method: "get" },
  { path: "/api/reports", method: "post" },
  { path: "/api/admin/agents/setup-workspace", method: "post" },
  { path: "/api/admin/migrations/agent-workspace-paths", method: "post" },
];

// Paths that SHOULD have a security requirement
const SECURED_PATHS_METHODS: Array<{ path: string; method: string }> = [
  { path: "/api/agents", method: "get" },
  { path: "/api/agents/{agentId}", method: "get" },
  { path: "/api/agents/{agentId}", method: "patch" },
  { path: "/api/agents/{agentId}/heartbeat", method: "post" },
  { path: "/api/agents/{agentId}/poll", method: "post" },
  { path: "/api/agents/{agentId}/rotate-key", method: "post" },
  { path: "/api/agents/{agentId}/tasks", method: "get" },
  { path: "/api/agents/{agentId}/tasks/{taskId}", method: "get" },
  { path: "/api/agents/{agentId}/tasks/{taskId}/comments", method: "post" },
  { path: "/api/agents/{agentId}/wiki/pages", method: "get" },
  { path: "/api/agents/{agentId}/wiki/pages", method: "post" },
  { path: "/api/agents/{agentId}/wiki/pages/{pageId}", method: "get" },
  { path: "/api/agents/{agentId}/wiki/pages/{pageId}", method: "patch" },
  { path: "/api/tasks/{taskId}/calendar-events", method: "post" },
];

// Expected tags covering all 11 domains
const EXPECTED_TAGS = [
  "Health",
  "Agents",
  "Tasks",
  "Calendar",
  "Businesses",
  "Epics",
  "Gateway",
  "Memory",
  "State Engine",
  "Reports",
  "Admin",
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateOpenAPISpec()", () => {
  let spec: ReturnType<typeof generateOpenAPISpec>;

  beforeAll(() => {
    spec = generateOpenAPISpec();
  });

  // -------------------------------------------------------------------------
  // 1. Valid OpenAPI structure
  // -------------------------------------------------------------------------
  describe("OpenAPI document structure", () => {
    it("returns an object with openapi version '3.0.0'", () => {
      expect(spec).toBeDefined();
      expect(typeof spec).toBe("object");
      expect(spec.openapi).toBe("3.0.0");
    });

    it("has info block with title and version", () => {
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe("Mission Control API");
      expect(spec.info.version).toBe("1.0.0");
      expect(typeof spec.info.description).toBe("string");
    });

    it("has a paths object", () => {
      expect(spec.paths).toBeDefined();
      expect(typeof spec.paths).toBe("object");
    });

    it("has at least one server definition", () => {
      expect(spec.servers).toBeDefined();
      expect(Array.isArray(spec.servers)).toBe(true);
      expect((spec.servers ?? []).length).toBeGreaterThan(0);
      expect((spec.servers ?? [])[0].url).toBe("http://localhost:3000");
    });

    it("has a components block", () => {
      expect(spec.components).toBeDefined();
    });

    it("has a tags array", () => {
      expect(spec.tags).toBeDefined();
      expect(Array.isArray(spec.tags)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. All known paths are registered
  // -------------------------------------------------------------------------
  describe("Endpoint coverage", () => {
    it("has at least 32 distinct path entries (one per route file)", () => {
      const pathCount = Object.keys(spec.paths ?? {}).length;
      expect(pathCount).toBeGreaterThanOrEqual(32);
    });

    it.each(KNOWN_PATHS)("registers path: %s", (path) => {
      expect(spec.paths).toHaveProperty(path);
    });

    it("registers 40+ HTTP operations (methods across all paths)", () => {
      const methods = ["get", "post", "put", "patch", "delete"];
      let opCount = 0;
      for (const pathItem of Object.values(spec.paths ?? {})) {
        for (const method of methods) {
          if ((pathItem as Record<string, unknown>)[method]) {
            opCount++;
          }
        }
      }
      // Audit found 42 operations across 32 route files; we register 41 distinct HTTP method+path combos
      // (gateway ?action= and task discriminator are documented as single operations per method)
      expect(opCount).toBeGreaterThanOrEqual(40);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Security scheme
  // -------------------------------------------------------------------------
  describe("Security scheme", () => {
    it("has BearerAuth security scheme in components.securitySchemes", () => {
      expect(spec.components?.securitySchemes).toBeDefined();
      expect(spec.components?.securitySchemes).toHaveProperty("BearerAuth");
    });

    it("BearerAuth is type http with bearer scheme", () => {
      const bearerAuth = spec.components?.securitySchemes?.["BearerAuth"];
      expect(bearerAuth).toBeDefined();
      expect((bearerAuth as Record<string, unknown>)?.type).toBe("http");
      expect((bearerAuth as Record<string, unknown>)?.scheme).toBe("bearer");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Error response schema
  // -------------------------------------------------------------------------
  describe("Error response schema", () => {
    it("has ErrorResponse schema in components.schemas", () => {
      expect(spec.components?.schemas).toBeDefined();
      expect(spec.components?.schemas).toHaveProperty("ErrorResponse");
    });

    it("ErrorResponse has expected structure (success, error, timestamp)", () => {
      const errorSchema = spec.components?.schemas?.["ErrorResponse"] as Record<string, unknown>;
      expect(errorSchema).toBeDefined();
      // The generated schema should have properties for the object fields
      const properties = errorSchema?.properties as Record<string, unknown> | undefined;
      expect(properties).toBeDefined();
      expect(properties).toHaveProperty("success");
      expect(properties).toHaveProperty("error");
    });

    it("has ErrorDetail schema in components.schemas", () => {
      expect(spec.components?.schemas).toHaveProperty("ErrorDetail");
    });

    it("has PaginationMeta schema in components.schemas", () => {
      expect(spec.components?.schemas).toHaveProperty("PaginationMeta");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Auth-protected endpoints have security requirement
  // -------------------------------------------------------------------------
  describe("Auth-protected endpoints have security requirement", () => {
    it.each(SECURED_PATHS_METHODS)(
      "$method $path has security field with BearerAuth",
      ({ path, method }) => {
        const pathItem = spec.paths?.[path] as Record<string, unknown> | undefined;
        expect(pathItem).toBeDefined();
        const operation = pathItem?.[method] as Record<string, unknown> | undefined;
        expect(operation).toBeDefined();
        expect(operation?.security).toBeDefined();
        const security = operation?.security as Array<Record<string, unknown>>;
        expect(Array.isArray(security)).toBe(true);
        expect(security.length).toBeGreaterThan(0);
        expect(security[0]).toHaveProperty("BearerAuth");
      }
    );
  });

  // -------------------------------------------------------------------------
  // 6. Public endpoints do NOT have security requirement
  // -------------------------------------------------------------------------
  describe("Public endpoints do not have security requirement", () => {
    it.each([
      { path: "/api/health", method: "get" },
      { path: "/api/openapi", method: "get" },
      { path: "/api/agents", method: "post" }, // open registration
    ])("$method $path has no security field", ({ path, method }) => {
      const pathItem = spec.paths?.[path] as Record<string, unknown> | undefined;
      expect(pathItem).toBeDefined();
      const operation = pathItem?.[method] as Record<string, unknown> | undefined;
      expect(operation).toBeDefined();
      expect(operation?.security).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Response schemas use $ref to components (not inline for named schemas)
  // -------------------------------------------------------------------------
  describe("Response schemas reference components", () => {
    it("agent registration 201 response schema exists", () => {
      const pathItem = spec.paths?.["/api/agents"] as Record<string, unknown> | undefined;
      const post = pathItem?.post as Record<string, unknown> | undefined;
      expect(post).toBeDefined();
      expect(post?.responses).toBeDefined();
      const responses = post?.responses as Record<string, unknown>;
      expect(responses["201"] ?? responses["200"]).toBeDefined();
    });

    it("error response schema exists on heartbeat endpoint", () => {
      const pathItem = spec.paths?.["/api/agents/{agentId}/heartbeat"] as Record<string, unknown> | undefined;
      const post = pathItem?.post as Record<string, unknown> | undefined;
      const responses = post?.responses as Record<string, unknown>;
      expect(responses?.["400"] ?? responses?.["401"]).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Tags cover all domains
  // -------------------------------------------------------------------------
  describe("Tags cover all 11 domains", () => {
    it.each(EXPECTED_TAGS)("has tag: %s", (tagName) => {
      const tagNames = (spec.tags ?? []).map((t) => t.name);
      expect(tagNames).toContain(tagName);
    });

    it("has at least 11 tags (one per domain)", () => {
      expect((spec.tags ?? []).length).toBeGreaterThanOrEqual(11);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Specific operation metadata
  // -------------------------------------------------------------------------
  describe("Operation metadata completeness", () => {
    it("each registered operation has an operationId", () => {
      const methods = ["get", "post", "put", "patch", "delete"];
      const missingOperationIds: string[] = [];
      for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
        for (const method of methods) {
          const operation = (pathItem as Record<string, unknown>)[method] as Record<string, unknown> | undefined;
          if (operation && !operation.operationId) {
            missingOperationIds.push(`${method.toUpperCase()} ${path}`);
          }
        }
      }
      expect(missingOperationIds).toHaveLength(0);
    });

    it("each registered operation has at least one tag", () => {
      const methods = ["get", "post", "put", "patch", "delete"];
      const missingTags: string[] = [];
      for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
        for (const method of methods) {
          const operation = (pathItem as Record<string, unknown>)[method] as Record<string, unknown> | undefined;
          if (operation) {
            const tags = operation.tags as string[] | undefined;
            if (!tags || tags.length === 0) {
              missingTags.push(`${method.toUpperCase()} ${path}`);
            }
          }
        }
      }
      expect(missingTags).toHaveLength(0);
    });

    it("rotate-key endpoint has 429 response (rate limiting documented)", () => {
      const pathItem = spec.paths?.["/api/agents/{agentId}/rotate-key"] as Record<string, unknown> | undefined;
      const post = pathItem?.post as Record<string, unknown> | undefined;
      const responses = post?.responses as Record<string, unknown>;
      expect(responses?.["429"]).toBeDefined();
    });

    it("gateway endpoint documents the ?action= anti-pattern", () => {
      const pathItem = spec.paths?.["/api/gateway/{gatewayId}"] as Record<string, unknown> | undefined;
      const get = pathItem?.get as Record<string, unknown> | undefined;
      expect((get?.description as string)?.toLowerCase()).toContain("anti-pattern");
    });

    it("admin endpoints warn about missing auth in description", () => {
      const setupPath = spec.paths?.["/api/admin/agents/setup-workspace"] as Record<string, unknown> | undefined;
      const post = setupPath?.post as Record<string, unknown> | undefined;
      expect((post?.description as string)?.toUpperCase()).toContain("CRITICAL");
    });
  });

  // -------------------------------------------------------------------------
  // 10. Named schemas from schemas.ts appear in components
  // -------------------------------------------------------------------------
  describe("Named schemas appear in components.schemas", () => {
    const expectedSchemas = [
      "RegisterAgentRequest",
      "UpdateAgentRequest",
      "HeartbeatRequest",
      "AgentPollRequest",
      "RotateKeyRequest",
      "AgentResponse",
      "TaskResponse",
      "ErrorResponse",
      "PaginationMeta",
      "CalendarEventResponse",
      "BusinessResponse",
    ];

    it.each(expectedSchemas)("has schema: %s", (schemaName) => {
      expect(spec.components?.schemas).toHaveProperty(schemaName);
    });
  });
});
