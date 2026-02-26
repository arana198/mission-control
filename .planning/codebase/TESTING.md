# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Jest 30.2.0
- Config: `jest.config.js` in project root
- TypeScript support via ts-jest preset

**Assertion Library:**
- Jest built-in `expect()` assertions
- Testing Library for DOM assertions (via `@testing-library/jest-dom`)

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode (re-runs on file changes)
npm run test:coverage # Generate coverage report (HTML output)
npm run test:unit    # Run only unit tests (--testPathPattern=unit)
npm run test:ci      # CI mode: --ci --coverage --maxWorkers=2
npm run validate     # Comprehensive: lint + build + tests
```

## Test File Organization

**Location:**
- Co-located: Test files in `__tests__/` subdirectory next to source files
- Pattern: `src/services/__tests__/gatewayConnectionPool.test.ts` for `src/services/gatewayConnectionPool.ts`
- Pattern: `convex/utils/__tests__/workflowValidation.test.ts` for `convex/utils/workflowValidation.ts`
- API route tests: `src/app/api/{feature}/__tests__/route.test.ts` for `src/app/api/{feature}/route.ts`
- E2E tests: Separate `e2e/` directory with `*.spec.ts` files

**Naming:**
- Unit/integration tests: `*.test.ts` or `*.test.tsx`
- E2E tests: `*.spec.ts`
- Test suites: `describe()` blocks organize related tests

**Structure:**
```
frontend/src/
├── services/
│   ├── gatewayConnectionPool.ts
│   └── __tests__/
│       └── gatewayConnectionPool.test.ts
├── app/api/agents/
│   ├── route.ts
│   └── __tests__/
│       └── register.test.ts
└── hooks/
    └── useNotification.ts  (no tests in samples, but pattern applies)

backend/convex/
├── utils/
│   ├── workflowValidation.ts
│   └── __tests__/
│       └── workflowValidation.test.ts
└── agents/
    ├── index.ts
    └── __tests__/
        └── register.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
// From workflowValidation.test.ts
describe("detectWorkflowCycle", () => {
  test("empty graph has no cycle", () => {
    const result = detectWorkflowCycle({}, {});
    expect(result).toBe(false);
  });

  test("single node with no edges has no cycle", () => {
    const nodes = { step_1: createNode("Step 1") };
    const edges = {};
    expect(detectWorkflowCycle(nodes, edges)).toBe(false);
  });

  // More test cases...
});

describe("topologicalSort", () => {
  test("empty graph returns empty array", () => {
    const result = topologicalSort({}, {});
    expect(result).toEqual([]);
  });
  // More test cases...
});
```

**Patterns:**

**Setup/Teardown:**
```typescript
// From taskUtils.test.ts
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);  // NOW = 1704067200000
});

afterEach(() => {
  jest.useRealTimers();
});
```

**Test isolation:**
```typescript
// From heartbeat.test.ts
beforeEach(() => {
  jest.clearAllMocks();  // Reset all mocks between tests
  MockConvexHttpClient.mockImplementation(() => ({
    mutation: mockMutation,
  } as any));
  mockVerify.mockReset();
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
});
```

**Assertion patterns:**
```typescript
// Status code assertions
expect(res.status).toBe(200);
expect(res.status).toBe(400);
expect(res.status).toBe(401);
expect(res.status).toBe(500);

// JSON response assertions
const data = await res.json();
expect(data.success).toBe(true);
expect(data.data.agentId).toBe("abc123");
expect(data.data.isNew).toBe(true);

// Array assertions
expect(data.businesses).toHaveLength(2);
expect(data).toHaveLength(0);

// Array element assertions
expect(data.workspaces[0].name).toBe("Mission Control HQ");

// Boolean assertions
expect(isOverdue(undefined)).toBe(false);

// Defined checks
expect(data.data.apiKey).toBeDefined();

// Error assertions
expect(result).toBeDefined();
```

## Mocking

**Framework:** Jest's built-in mocking (jest.mock, jest.fn)

**Patterns:**

**Module mocking (at file top before imports):**
```typescript
jest.mock("convex/browser");
jest.mock("@/convex/_generated/api", () => ({
  api: {
    agents: {
      register: "agents:register",
      getByName: "agents:getByName",
    },
  },
}));
jest.mock("@/services/gatewayRpc", () => ({
  connect: jest.fn(),
  call: jest.fn(),
  ping: jest.fn(),
}));
```

**Function mocking:**
```typescript
const mockMutation = jest.fn();
const mockQuery = jest.fn();
const mockVerify = verifyAgent as jest.Mock;

// Setup return values
mockMutation.mockResolvedValue({
  agentId: "abc123",
  apiKey: "ak_new_12345",
  isNew: true,
});

// Setup rejections
mockMutation.mockRejectedValue(new Error("DB error"));

// Reset between tests
jest.clearAllMocks();
mockVerify.mockReset();
```

**Class mocking:**
```typescript
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<
  typeof ConvexHttpClient
>;

MockConvexHttpClient.mockImplementation(() => ({
  mutation: mockMutation,
  query: mockQuery,
} as any));
```

**What to Mock:**
- External services: `convex/browser`, `ConvexHttpClient`
- External API calls: `@/services/gatewayRpc`
- Authentication functions: `@/lib/agent-auth`
- Generated API: `@/convex/_generated/api`
- Network-dependent functions

**What NOT to Mock:**
- Pure utility functions (e.g., `detectWorkflowCycle`)
- Simple transformations (e.g., `topologicalSort`)
- Type definitions and interfaces
- Local state management (useState, etc.)

## Fixtures and Factories

**Test Data:**

**Helper factory functions:**
```typescript
// From workflowValidation.test.ts
const createNode = (title: string): WorkflowNode => ({
  taskTemplate: {
    title,
    description: `Description for ${title}`,
  },
});

// Usage:
const nodes = { step_1: createNode("Step 1"), step_2: createNode("Step 2") };
```

**Mock HTTP Request:**
```typescript
// From register.test.ts
function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Usage:
const req = makeRequest({
  name: "jarvis",
  role: "Squad Lead",
  level: "lead",
  sessionKey: "agent:main:main",
});
```

**Mock WebSocket:**
```typescript
// From sessions.test.ts
const mockWs = { close: jest.fn(), terminate: jest.fn() };

// Setup mock return
mockAcquire.mockResolvedValue(mockWs);
```

**Constant test data:**
```typescript
// From taskUtils.test.ts
const NOW = 1704067200000; // 2024-01-01 00:00:00 UTC

// From sessions.test.ts
const GATEWAY_CONFIG = {
  _id: 'gateway_123',
  name: 'Test Gateway',
  url: 'wss://test.gateway.example.com',
  token: 'tok_abc',
  disableDevicePairing: true,
  allowInsecureTls: false,
  workspaceRoot: '/workspace',
};
```

**Location:**
- Inline within test file for isolated tests
- Exported from test file for reuse across test suites (not observed but conventional)
- No separate `fixtures/` directory; all test data in `__tests__/` alongside tests

## Coverage

**Requirements:**
- Threshold: 50% minimum (branches, functions, lines, statements)
- Configured in `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50,
  },
}
```

**View Coverage:**
```bash
npm run test:coverage   # Generates HTML report in ./coverage
# Open coverage/index.html in browser
```

**Coverage Files Collected:**
- `backend/lib/**/*.ts`
- `backend/convex/**/*.ts`
- `frontend/src/app/api/**/*.ts`
- Excludes: `.d.ts`, `node_modules`, `dist`, `.next`, `coverage`

**Coverage Reporters:** text, text-summary, html, json

## Test Types

**Unit Tests:**
- Scope: Single function or class method in isolation
- Approach: Mock all external dependencies
- Example: `workflowValidation.test.ts` tests pure functions with no Convex dependencies
- Pattern: Direct function calls with prepared inputs, assertions on outputs
- Timeout: 10 seconds (configurable via `testTimeout` in jest.config.js)

```typescript
it("returns false when dueDate is undefined", () => {
  expect(isOverdue(undefined)).toBe(false);
});
```

**Integration Tests:**
- Scope: API route handler + Convex mutations + database interactions
- Approach: Mock Convex client and backend services, but test actual route logic
- Example: `src/app/api/agents/__tests__/register.test.ts` tests POST handler with mocked ConvexHttpClient
- Pattern: Make HTTP request to route, assert status code and response shape

```typescript
it("returns 201 with agentId and apiKey for new agent", async () => {
  const { POST } = await import("../route");
  mockMutation.mockResolvedValue({
    agentId: "abc123",
    apiKey: "ak_new_12345",
    isNew: true,
  });
  const req = makeRequest({ name: "jarvis", role: "Squad Lead", ... });
  const res = await POST(req, { params: { agentId: "agent-123", taskId: "task-456" } });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.success).toBe(true);
  expect(data.data.agentId).toBe("abc123");
});
```

**E2E Tests:**
- Framework: Playwright 1.58.2
- Scope: Full user workflows from browser perspective
- Approach: Test real app with Convex backend running
- Example: `e2e/gateway-sessions.spec.ts` tests gateways page load and interactions
- Pattern: Navigate page, wait for elements, perform clicks, assert UI state

```typescript
test('loads gateways page without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  await page.waitForLoadState('networkidle');
  expect(errors).toHaveLength(0);
});
```

## Common Patterns

**Async Testing:**

**With async/await:**
```typescript
it("returns 201 with agentId and apiKey for new agent", async () => {
  mockMutation.mockResolvedValue({...});
  const res = await POST(req, { params: {...} });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.success).toBe(true);
});
```

**With jest.fn().mockResolvedValue():**
```typescript
mockQuery.mockResolvedValue([
  { _id: "b1", name: "Mission Control HQ", slug: "mission-control-hq" },
]);
const res = await GET();
expect(res.status).toBe(200);
```

**Error Testing:**

**Testing error responses:**
```typescript
it("returns 400 for missing required fields", async () => {
  const { POST } = await import("../route");
  const req = makeRequest({ name: "jarvis" }); // Missing required fields
  const res = await POST(req, { params: {...} });
  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.success).toBe(false);
});
```

**Testing thrown errors:**
```typescript
it("returns 500 when Convex mutation fails", async () => {
  mockMutation.mockRejectedValue(new Error("DB error"));
  const req = makeRequest({...});
  const res = await POST(req, { params: {...} });
  expect(res.status).toBe(500);
});
```

**Testing error recovery:**
```typescript
it("handles gateway connection timeout gracefully", async () => {
  mockAcquire.mockRejectedValue(new Error("Connection timeout"));
  const res = await GET(makeRequest(...));
  expect(res.status).toBe(500);
  const data = await res.json();
  expect(data.error).toContain("timeout");
});
```

## E2E Test Structure

**Setup:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Gateway Sessions Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gateways');
  });

  test('loads gateways page without errors', async ({ page }) => {
    // Test implementation
  });
});
```

**Configuration:** `playwright.config.ts`
- Base URL: `http://localhost:3000`
- Test directory: `./e2e`
- Web server: `npm run dev` (starts Next.js)
- Retries: 0 in local, 2 in CI
- Reporter: HTML
- Devices: Desktop Chrome only

**Common E2E patterns:**

```typescript
// Wait for page load
await page.waitForLoadState('networkidle');

// Find elements
const gatewaysList = page.locator('text=Gateways');
const firstGateway = page.locator('button').first();

// Assertions on visibility
await expect(gatewaysList).toBeVisible({ timeout: 5000 });

// Click elements
await firstGateway.click();

// Capture console errors
const errors: string[] = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(msg.text());
  }
});
expect(errors).toHaveLength(0);

// Count elements
const healthBadges = page.locator('[class*="bg-green"]');
const count = await healthBadges.count();
expect(count).toBeGreaterThanOrEqual(0);
```

## Mandatory Definition of Done

From `.claude/testing.md`:

Before every commit:

1. **Unit tests written** for all new logic.
2. **Integration tests written** for all Convex mutations.
3. **E2E tests written** for all UI changes (use Playwright).
4. `npm test` passes (all unit/integration tests).
5. `npm run build` passes (TypeScript compilation, imports verified).
6. `npm run lint` passes.
7. `npm run validate` passes (lint + build + tests — comprehensive validation).
8. **Manual validation performed:** Run both terminals and verify the feature works in browser.

**No exceptions. Tests first. Build must pass. UI changes need E2E tests.**

## Testing Policy (From Code Quality)

- Run `npm run test:coverage` before finalizing features.
- Integration tests for Convex mutations are non-negotiable.
- A feature with missing tests is an incomplete feature, not a "fast" one.
- Logic is not validated unless explicitly tested. If tests are missing, the feature is incomplete.
- Production stability depends on test coverage.

---

*Testing analysis: 2026-02-26*
