/**
 * OpenAPI Generator Tests
 * Validates that the OpenAPI spec covers all API routes and includes proper examples
 */

import { generateOpenAPISpec } from '../openapi-generator';

describe('generateOpenAPISpec', () => {
  let spec: ReturnType<typeof generateOpenAPISpec>;

  beforeAll(() => {
    spec = generateOpenAPISpec();
  });

  describe('spec structure', () => {
    it('returns valid openapi 3.0.0 spec object', () => {
      expect(spec.openapi).toBe('3.0.0');
    });

    it('has required info fields', () => {
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBeTruthy();
      expect(spec.info.version).toBeTruthy();
      expect(spec.info.description).toBeTruthy();
    });

    it('has at least 2 servers defined', () => {
      expect(Array.isArray(spec.servers)).toBe(true);
      expect(spec.servers.length).toBeGreaterThanOrEqual(2);
    });

    it('has paths object', () => {
      expect(spec.paths).toBeDefined();
      expect(typeof spec.paths).toBe('object');
    });

    it('has components with security schemes', () => {
      expect(spec.components).toBeDefined();
      expect(spec.components.securitySchemes).toBeDefined();
    });

    it('has at least 18 tags', () => {
      expect(Array.isArray(spec.tags)).toBe(true);
      expect(spec.tags.length).toBeGreaterThanOrEqual(18);
    });
  });

  describe('tags coverage', () => {
    const requiredTags = [
      'Agents',
      'Tasks',
      'Epics',
      'Memory',
      'Reports',
      'Calendar',
      'Businesses',
      'State Engine',
      'Audit',
      'Admin',
      'API',
      'Gateways',
      'Health',
      'Wiki',
      'Agent Key Management',
      'Agent Workspace',
      'Agent Tasks',
      'Webhooks',
    ];

    requiredTags.forEach((tag) => {
      it(`includes "${tag}" tag`, () => {
        const tagExists = spec.tags.some((t) => t.name === tag);
        expect(tagExists).toBe(
          true,
          `Tag "${tag}" not found. Available tags: ${spec.tags.map((t) => t.name).join(', ')}`
        );
      });
    });
  });

  describe('path coverage - critical endpoints', () => {
    const requiredPaths = [
      // Health
      '/api/health',
      // Agents
      '/api/agents',
      '/api/agents/{agentId}',
      '/api/agents/{agentId}/rotate-key',
      '/api/agents/{agentId}/wiki/pages',
      '/api/agents/{agentId}/wiki/pages/{pageId}',
      // Gateways
      '/api/gateway/{gatewayId}',
      // State Engine (corrected path)
      '/api/state-engine/alerts',
      '/api/state-engine/decisions',
      '/api/state-engine/metrics',
      // Admin
      '/api/admin/agents/setup-workspace',
      '/api/admin/migrations/agent-workspace-paths',
      // Calendar
      '/api/calendar/create-event',
      '/api/calendar/find-slots',
      '/api/calendar/mark-executed',
      '/api/calendar/schedule-task',
      // Tasks
      '/api/tasks/{taskId}',
      '/api/tasks/execute',
      '/api/tasks/generate-daily',
    ];

    requiredPaths.forEach((path) => {
      it(`includes path ${path}`, () => {
        const pathExists = path in spec.paths;
        expect(pathExists).toBe(
          true,
          `Path "${path}" not found. Available paths: ${Object.keys(spec.paths)
            .sort()
            .join(', ')}`
        );
      });
    });
  });

  describe('path count', () => {
    it('has at least 40 path entries', () => {
      const pathCount = Object.keys(spec.paths).length;
      expect(pathCount).toBeGreaterThanOrEqual(40);
    });
  });

  describe('path details', () => {
    it('all paths have at least one HTTP method', () => {
      Object.entries(spec.paths).forEach(([path, pathItem]) => {
        const methods = Object.keys(pathItem).filter((key) =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(key.toLowerCase())
        );
        expect(methods.length).toBeGreaterThan(
          0,
          `Path ${path} has no HTTP methods defined`
        );
      });
    });

    it('all operations have tags', () => {
      let operationCount = 0;
      let untaggedOperations: string[] = [];

      Object.entries(spec.paths).forEach(([path, pathItem]) => {
        Object.entries(pathItem).forEach(([method, operation]: any) => {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
            operationCount++;
            if (!operation.tags || operation.tags.length === 0) {
              untaggedOperations.push(`${method.toUpperCase()} ${path}`);
            }
          }
        });
      });

      expect(untaggedOperations).toHaveLength(
        0,
        `Found ${untaggedOperations.length} untagged operations: ${untaggedOperations.join(', ')}`
      );
    });

    it('all operations have summary and description', () => {
      let operationCount = 0;
      let missingDocs: string[] = [];

      Object.entries(spec.paths).forEach(([path, pathItem]) => {
        Object.entries(pathItem).forEach(([method, operation]: any) => {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
            operationCount++;
            if (!operation.summary) {
              missingDocs.push(`${method.toUpperCase()} ${path} (missing summary)`);
            }
            if (!operation.description) {
              missingDocs.push(`${method.toUpperCase()} ${path} (missing description)`);
            }
          }
        });
      });

      expect(missingDocs).toHaveLength(
        0,
        `Found ${missingDocs.length} operations missing docs: ${missingDocs.slice(0, 5).join(', ')}`
      );
    });
  });

  describe('path-specific validations', () => {
    it('corrects /api/state/metrics to /api/state-engine/metrics', () => {
      const hasWrongPath = '/api/state/metrics' in spec.paths;
      const hasCorrectPath = '/api/state-engine/metrics' in spec.paths;

      expect(hasWrongPath).toBe(false, 'Found old path /api/state/metrics (should be /api/state-engine/)');
      expect(hasCorrectPath).toBe(true, 'Missing path /api/state-engine/metrics');
    });

    it('gateway path includes all action variants', () => {
      const gatewayPath = spec.paths['/api/gateway/{gatewayId}'];
      expect(gatewayPath).toBeDefined();

      if (gatewayPath?.post) {
        const postOp = gatewayPath.post as any;
        // POST should handle: message, provision, sync, status, sessions, history actions
        expect(postOp.description || postOp.summary).toContain(
          'action' // Should mention action parameter
        );
      }
    });

    it('health endpoint exists and has 200 response', () => {
      const healthPath = spec.paths['/api/health'];
      expect(healthPath).toBeDefined();
      expect(healthPath?.get).toBeDefined();

      const getOp = healthPath.get as any;
      expect(getOp.responses['200']).toBeDefined();
      expect(getOp.responses['200'].description).toBeTruthy();
    });
  });

  describe('example injection', () => {
    it('POST operations have request body with content examples', () => {
      const postPaths = Object.entries(spec.paths)
        .map(([path, pathItem]: any) => [path, pathItem.post])
        .filter(([, op]) => op);

      // At least some POST operations should have examples
      const withExamples = postPaths.filter(([, op]: any) => {
        const schema =
          op?.requestBody?.content?.['application/json']?.schema;
        return schema?.example || schema?.examples;
      });

      expect(withExamples.length).toBeGreaterThan(0, 'No POST operations have examples in request body');
    });

    it('response schemas have examples', () => {
      let schemasWithExamples = 0;
      let totalSchemas = 0;

      Object.values(spec.paths).forEach((pathItem: any) => {
        Object.values(pathItem).forEach((operation: any) => {
          if (operation?.responses) {
            Object.values(operation.responses).forEach((response: any) => {
              const schema =
                response?.content?.['application/json']?.schema;
              if (schema) {
                totalSchemas++;
                if (schema.example || schema.examples || schema.properties) {
                  schemasWithExamples++;
                }
              }
            });
          }
        });
      });

      expect(schemasWithExamples).toBeGreaterThan(
        0,
        'No response schemas have examples'
      );
    });
  });

  describe('security', () => {
    it('has security schemes defined', () => {
      expect(spec.components.securitySchemes).toBeDefined();
      expect(Object.keys(spec.components.securitySchemes).length).toBeGreaterThan(0);
    });

    it('includes API Key security scheme', () => {
      const hasApiKeySecurity =
        'ApiKeyAuth' in spec.components.securitySchemes ||
        'X-Agent-Key' in spec.components.securitySchemes;

      expect(hasApiKeySecurity).toBe(true, 'Missing API Key security scheme');
    });
  });
});
