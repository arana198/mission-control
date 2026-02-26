/**
 * OpenAPI Generation Tests
 * Tests OpenAPI 3.0 spec generation and validation
 */

import {
  createOpenAPIDocument,
  addRoute,
  successResponseSchema,
  paginatedResponseSchema,
  standardErrorResponses,
  createPathParameters,
  createQueryParameters,
  exportOpenAPISpec,
  validateOpenAPIDocument,
} from "../openapi";

describe("OpenAPI Spec Generation", () => {
  describe("createOpenAPIDocument", () => {
    it("should create base OpenAPI document", () => {
      const doc = createOpenAPIDocument("Test API", "1.0.0");

      expect(doc.openapi).toBe("3.0.0");
      expect(doc.info.title).toBe("Test API");
      expect(doc.info.version).toBe("1.0.0");
      expect(doc.paths).toEqual({});
      expect(doc.components.schemas).toBeDefined();
      expect(doc.components.securitySchemes).toBeDefined();
    });

    it("should include servers configuration", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      expect(doc.servers.length).toBeGreaterThan(0);
      expect(doc.servers[0].url).toBe("http://localhost:3000");
    });

    it("should include security schemes for auth", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      expect(doc.components.securitySchemes.BearerAuth).toBeDefined();
      expect(doc.components.securitySchemes.LegacyAuth).toBeDefined();
    });

    it("should include standard error schema", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      expect(doc.components.schemas.Error).toBeDefined();
      expect(doc.components.schemas.Error.properties.type).toBeDefined();
    });

    it("should include pagination schema", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      expect(doc.components.schemas.PaginationMeta).toBeDefined();
      expect(doc.components.schemas.PaginationMeta.properties.total).toBeDefined();
    });
  });

  describe("addRoute", () => {
    it("should add a GET route", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      addRoute(doc, {
        path: "/api/test",
        method: "GET",
        summary: "Test endpoint",
        responses: {
          "200": { description: "Success" },
        },
      });

      expect(doc.paths["/api/test"].get).toBeDefined();
      expect(doc.paths["/api/test"].get.summary).toBe("Test endpoint");
    });

    it("should add a POST route", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      addRoute(doc, {
        path: "/api/test",
        method: "POST",
        summary: "Create test",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "201": { description: "Created" },
        },
      });

      expect(doc.paths["/api/test"].post).toBeDefined();
      expect(doc.paths["/api/test"].post.requestBody).toBeDefined();
    });

    it("should add parameters to route", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      addRoute(doc, {
        path: "/api/items/{id}",
        method: "GET",
        summary: "Get item",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Success" },
        },
      });

      expect(doc.paths["/api/items/{id}"].get.parameters).toBeDefined();
      expect(doc.paths["/api/items/{id}"].get.parameters[0].name).toBe("id");
    });

    it("should add tags to route", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      addRoute(doc, {
        path: "/api/users",
        method: "GET",
        summary: "List users",
        tags: ["Users"],
        responses: {
          "200": { description: "Success" },
        },
      });

      expect(doc.paths["/api/users"].get.tags).toContain("Users");
    });
  });

  describe("successResponseSchema", () => {
    it("should create success response schema", () => {
      const schema = successResponseSchema({
        type: "object",
        properties: { id: { type: "string" } },
      });

      expect(schema.properties.success).toBeDefined();
      expect(schema.properties.data).toBeDefined();
      expect(schema.properties.timestamp).toBeDefined();
    });

    it("should include data schema", () => {
      const dataSchema = {
        type: "object",
        properties: { name: { type: "string" } },
      };

      const schema = successResponseSchema(dataSchema);

      expect(schema.properties.data).toEqual(dataSchema);
    });

    it("should require all fields", () => {
      const schema = successResponseSchema({ type: "object" });

      expect(schema.required).toContain("success");
      expect(schema.required).toContain("data");
      expect(schema.required).toContain("timestamp");
    });
  });

  describe("paginatedResponseSchema", () => {
    it("should create paginated response schema", () => {
      const schema = paginatedResponseSchema({
        type: "object",
        properties: { id: { type: "string" } },
      });

      expect(schema.properties.success).toBeDefined();
      expect(schema.properties.data).toBeDefined();
      expect(schema.properties.pagination).toBeDefined();
      expect(schema.properties.timestamp).toBeDefined();
    });

    it("should have array data property", () => {
      const schema = paginatedResponseSchema({ type: "object" });

      expect(schema.properties.data.type).toBe("array");
    });

    it("should reference pagination schema", () => {
      const schema = paginatedResponseSchema({ type: "object" });

      expect(schema.properties.pagination.$ref).toContain("PaginationMeta");
    });
  });

  describe("standardErrorResponses", () => {
    it("should include all standard error codes", () => {
      const responses = standardErrorResponses();

      expect(responses["400"]).toBeDefined(); // Bad Request
      expect(responses["401"]).toBeDefined(); // Unauthorized
      expect(responses["403"]).toBeDefined(); // Forbidden
      expect(responses["404"]).toBeDefined(); // Not Found
      expect(responses["429"]).toBeDefined(); // Rate Limit
      expect(responses["500"]).toBeDefined(); // Server Error
    });

    it("should reference error schema", () => {
      const responses = standardErrorResponses();

      expect(responses["400"].content["application/json"].schema.$ref).toContain("Error");
    });

    it("should include Retry-After header for 429", () => {
      const responses = standardErrorResponses();

      expect(responses["429"].headers["Retry-After"]).toBeDefined();
    });
  });

  describe("createPathParameters", () => {
    it("should create workspace ID parameter", () => {
      const params = createPathParameters();

      expect(params.workspaceId.name).toBe("workspaceId");
      expect(params.workspaceId.in).toBe("path");
      expect(params.workspaceId.required).toBe(true);
    });

    it("should create resource ID parameter", () => {
      const params = createPathParameters();

      expect(params.resourceId.name).toBe("resourceId");
      expect(params.resourceId.in).toBe("path");
      expect(params.resourceId.required).toBe(true);
    });

    it("should have pattern validation", () => {
      const params = createPathParameters();

      expect(params.workspaceId.schema.pattern).toBeDefined();
    });
  });

  describe("createQueryParameters", () => {
    it("should create limit parameter", () => {
      const params = createQueryParameters();

      expect(params.limit.name).toBe("limit");
      expect(params.limit.in).toBe("query");
      expect(params.limit.required).toBe(false);
      expect(params.limit.schema.type).toBe("integer");
    });

    it("should create cursor parameter", () => {
      const params = createQueryParameters();

      expect(params.cursor.name).toBe("cursor");
      expect(params.cursor.in).toBe("query");
      expect(params.cursor.required).toBe(false);
      expect(params.cursor.schema.type).toBe("string");
    });

    it("should have limit constraints", () => {
      const params = createQueryParameters();

      expect(params.limit.schema.minimum).toBe(1);
      expect(params.limit.schema.maximum).toBe(100);
      expect(params.limit.schema.default).toBe(20);
    });
  });

  describe("exportOpenAPISpec", () => {
    it("should export spec as JSON string", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");
      const json = exportOpenAPISpec(doc);

      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(parsed.openapi).toBe("3.0.0");
    });

    it("should be valid JSON", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");
      const json = exportOpenAPISpec(doc);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe("validateOpenAPIDocument", () => {
    it("should validate complete document", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      const result = validateOpenAPIDocument(doc);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should detect missing openapi version", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");
      delete doc.openapi;

      const result = validateOpenAPIDocument(doc);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing openapi version");
    });

    it("should detect missing info", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");
      doc.info.title = "";

      const result = validateOpenAPIDocument(doc);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect missing paths", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");
      delete doc.paths;

      const result = validateOpenAPIDocument(doc);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing paths");
    });

    it("should detect missing schemas", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");
      delete doc.components.schemas;

      const result = validateOpenAPIDocument(doc);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing components.schemas");
    });
  });

  describe("Integration scenarios", () => {
    it("should create complete API spec with routes", () => {
      const doc = createOpenAPIDocument("Mission Control", "1.0.0");

      addRoute(doc, {
        path: "/api/v1/agents",
        method: "GET",
        summary: "List agents",
        tags: ["Agents"],
        responses: { "200": { description: "Success" } },
      });

      const validation = validateOpenAPIDocument(doc);
      expect(validation.valid).toBe(true);
      expect(doc.paths["/api/v1/agents"].get).toBeDefined();
    });

    it("should support multiple HTTP methods on same path", () => {
      const doc = createOpenAPIDocument("API", "1.0.0");

      addRoute(doc, {
        path: "/api/items",
        method: "GET",
        summary: "List items",
        responses: { "200": { description: "Success" } },
      });

      addRoute(doc, {
        path: "/api/items",
        method: "POST",
        summary: "Create item",
        responses: { "201": { description: "Created" } },
      });

      expect(doc.paths["/api/items"].get).toBeDefined();
      expect(doc.paths["/api/items"].post).toBeDefined();
    });

    it("should build complete response documentation", () => {
      const schema = paginatedResponseSchema({
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      });

      expect(schema.properties.data.items).toBeDefined();
      expect(schema.properties.pagination.$ref).toBeDefined();
    });
  });
});
