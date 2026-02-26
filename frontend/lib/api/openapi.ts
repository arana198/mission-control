/**
 * OpenAPI 3.0 Spec Generation
 * Auto-generates OpenAPI spec from route definitions and Zod schemas
 */

export interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  security: Array<Record<string, string[]>>;
}

export interface RouteDefinition {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: "query" | "path" | "header";
    required?: boolean;
    schema: Record<string, any>;
  }>;
  requestBody?: {
    required?: boolean;
    content: Record<string, any>;
  };
  responses: Record<string, any>;
}

/**
 * Create base OpenAPI document structure
 */
export function createOpenAPIDocument(title: string, version: string): OpenAPIDocument {
  return {
    openapi: "3.0.0",
    info: {
      title,
      version,
      description: "Mission Control REST API - Standardized API with rate limiting and pagination",
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://api.mission-control.dev",
        description: "Production server",
      },
    ],
    paths: {},
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["type", "title", "detail", "status", "requestId", "timestamp"],
          properties: {
            type: {
              type: "string",
              description: "RFC 9457 error type URI",
              example: "https://api.mission-control.dev/errors/validation_error",
            },
            title: {
              type: "string",
              description: "Human-readable error title",
              example: "Validation Error",
            },
            detail: {
              type: "string",
              description: "Detailed error message",
              example: "Missing required field: agentKey",
            },
            instance: {
              type: "string",
              description: "Request path or context",
              example: "/api/v1/agents",
            },
            status: {
              type: "integer",
              description: "HTTP status code",
              example: 400,
            },
            requestId: {
              type: "string",
              description: "Unique request ID for tracing",
              example: "req-1234567890-a1b2c3",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "ISO 8601 timestamp",
              example: "2026-02-26T12:00:00Z",
            },
          },
        },
        RateLimitError: {
          allOf: [
            { $ref: "#/components/schemas/Error" },
            {
              type: "object",
              properties: {
                retryAfter: {
                  type: "integer",
                  description: "Seconds until quota resets",
                  example: 300,
                },
              },
            },
          ],
        },
        PaginationMeta: {
          type: "object",
          required: ["total", "limit", "offset", "cursor", "hasMore"],
          properties: {
            total: {
              type: "integer",
              description: "Total items available",
              example: 100,
            },
            limit: {
              type: "integer",
              description: "Items per page",
              example: 20,
            },
            offset: {
              type: "integer",
              description: "Current offset",
              example: 0,
            },
            cursor: {
              type: "string",
              description: "Base64 encoded cursor for current page",
              example: "b2Zmc2V0OjA6Y3JlYXRlZEF0OjEyMzQ1Njc4OTA=",
            },
            nextCursor: {
              type: ["string", "null"],
              description: "Cursor for next page (null if no more items)",
              example: "b2Zmc2V0OjIwOmNyZWF0ZWRBdDoxMjM0NTY3ODkw",
            },
            hasMore: {
              type: "boolean",
              description: "Whether more items are available",
              example: true,
            },
          },
        },
      },
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "apikey",
          description: "Bearer token authentication: Authorization: Bearer {apiKey}",
        },
        LegacyAuth: {
          type: "apiKey",
          name: "X-Agent-Key",
          in: "header",
          description: "Legacy API key authentication (requires X-Agent-ID header too)",
        },
      },
    },
    security: [
      { BearerAuth: [] },
      { LegacyAuth: [] },
    ],
  };
}

/**
 * Add a route definition to OpenAPI document
 */
export function addRoute(doc: OpenAPIDocument, route: RouteDefinition): OpenAPIDocument {
  const pathKey = route.path;
  const methodKey = route.method.toLowerCase();

  if (!doc.paths[pathKey]) {
    doc.paths[pathKey] = {};
  }

  doc.paths[pathKey][methodKey] = {
    summary: route.summary,
    description: route.description,
    tags: route.tags,
    parameters: route.parameters,
    requestBody: route.requestBody,
    responses: route.responses,
  };

  return doc;
}

/**
 * Generate standard success response schema
 */
export function successResponseSchema<T>(dataSchema: Record<string, any>) {
  return {
    type: "object",
    required: ["success", "data", "timestamp"],
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: dataSchema,
      timestamp: {
        type: "string",
        format: "date-time",
        example: "2026-02-26T12:00:00Z",
      },
    },
  };
}

/**
 * Generate paginated list response schema
 */
export function paginatedResponseSchema<T>(dataSchema: Record<string, any>) {
  return {
    type: "object",
    required: ["success", "data", "pagination", "timestamp"],
    properties: {
      success: {
        type: "boolean",
        example: true,
      },
      data: {
        type: "array",
        items: dataSchema,
      },
      pagination: {
        $ref: "#/components/schemas/PaginationMeta",
      },
      timestamp: {
        type: "string",
        format: "date-time",
        example: "2026-02-26T12:00:00Z",
      },
    },
  };
}

/**
 * Generate standard error responses (400, 401, 403, 404, 429, 500)
 */
export function standardErrorResponses() {
  return {
    "400": {
      description: "Bad Request",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "401": {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Not Found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "429": {
      description: "Rate Limit Exceeded",
      headers: {
        "Retry-After": {
          description: "Seconds until quota resets",
          schema: { type: "integer" },
        },
      },
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/RateLimitError" },
        },
      },
    },
    "500": {
      description: "Internal Server Error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
  };
}

/**
 * Create standard path parameters (workspace ID, resource ID)
 */
export function createPathParameters() {
  return {
    workspaceId: {
      name: "workspaceId",
      in: "path",
      required: true,
      schema: {
        type: "string",
        pattern: "^[a-zA-Z0-9_-]+$",
        example: "ws-123",
      },
      description: "Workspace ID",
    },
    resourceId: {
      name: "resourceId",
      in: "path",
      required: true,
      schema: {
        type: "string",
        pattern: "^[a-zA-Z0-9_-]+$",
        example: "agent-456",
      },
      description: "Resource ID",
    },
  };
}

/**
 * Create standard query parameters (pagination)
 */
export function createQueryParameters() {
  return {
    limit: {
      name: "limit",
      in: "query",
      required: false,
      schema: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 20,
        example: 20,
      },
      description: "Number of items per page",
    },
    cursor: {
      name: "cursor",
      in: "query",
      required: false,
      schema: {
        type: "string",
        example: "b2Zmc2V0OjIwOmNyZWF0ZWRBdDoxMjM0NTY3ODkw",
      },
      description: "Pagination cursor (base64 encoded)",
    },
  };
}

/**
 * Export OpenAPI spec as JSON string
 */
export function exportOpenAPISpec(doc: OpenAPIDocument): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Validate OpenAPI document structure
 */
export function validateOpenAPIDocument(doc: Partial<OpenAPIDocument>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!doc.openapi) errors.push("Missing openapi version");
  if (!doc.info?.title) errors.push("Missing info.title");
  if (!doc.info?.version) errors.push("Missing info.version");
  if (!doc.paths) errors.push("Missing paths");
  if (!doc.components?.schemas) errors.push("Missing components.schemas");
  if (!doc.components?.securitySchemes) errors.push("Missing components.securitySchemes");

  return {
    valid: errors.length === 0,
    errors,
  };
}
