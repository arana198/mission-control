# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Runner:**
- Jest 30.2.0
- Config: `jest.config.js` (ts-jest preset for TypeScript support)
- Test environment: `node` by default (overrideable with `@jest-environment jsdom` comment for React component tests)

**Assertion Library:**
- Jest built-in matchers (`expect()` API)
- Testing Library for React components (React Testing Library 16.3.2)
- Playwright for E2E tests (1.58.2)

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report with HTML
npm run test:ci       # CI mode (2 workers, coverage)
npm run e2e           # E2E tests (Playwright)
npm run e2e:ui        # E2E with interactive UI
npm run e2e:debug     # E2E in debug mode
```

## Test File Organization

**Location:**
- Co-located with source code in `__tests__/` subdirectory
- Same directory as the file being tested
  - Example: `src/hooks/__tests__/useGatewaySessions.test.ts` tests `src/hooks/useGatewaySessions.ts`
  - Example: `src/components/__tests__/GatewaySessionsPanel.test.tsx` tests `src/components/GatewaySessionsPanel.tsx`
  - Example: `convex/__tests__/admin.test.ts` tests `convex/admin.ts`
  - Example: `src/app/api/gateway/[gatewayId]/__tests__/sessions.test.ts` tests route handler

**Naming:**
- Pattern: `{SourceFileName}.test.{ts|tsx}`
- Examples: `admin.test.ts`, `useGatewaySessions.test.ts`, `GatewaySessionsPanel.test.tsx`
- New test files: `src/services/__tests__/gatewayConnectionPool.test.ts`

**Structure:**
```
src/
├── hooks/
│   ├── useGatewaySessions.ts
│   └── __tests__/
│       └── useGatewaySessions.test.ts
├── components/
│   ├── GatewaySessionsPanel.tsx
│   └── __tests__/
│       └── GatewaySessionsPanel.test.tsx
convex/
├── admin.ts
└── __tests__/
    └── admin.test.ts
```

## Test Structure

**Suite Organization (Convex backend example):**
```typescript
import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock Database for Admin Tests
 * Simulates all tables that need to be cleared
 */
class AdminMockDatabase {
  private data: Map<string, any[]> = new Map();
  // ... implementation ...
}

describe("Admin Mutations", () => {
  let mockDb: AdminMockDatabase;
  let mockCtx: any;

  beforeEach(() => {
    mockDb = new AdminMockDatabase();
    mockCtx = { db: mockDb };
  });

  describe("clearAllData", () => {
    it("should delete all records from all tables", async () => {
      // Setup
      mockDb.insert("businesses", { name: "Test" });
      // ...

      // Execute
      const result = await clearAllData(mockCtx);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});
```

**Patterns:**
- Setup phase: beforeEach() initializes fresh mocks and state
- Arrange/Act/Assert: Comments mark phases in each test
- Descriptive test names: "should [expected behavior]"
- Nested describe blocks for related tests
- Async tests: Use `async () => { ... }` and `await` for async operations

## Mocking

**Framework:** Jest built-in `jest.mock()` and `jest.fn()`

**Patterns:**
```typescript
// Mock modules at top of file (before imports)
jest.mock('convex/browser');
jest.mock('@/services/gatewayRpc', () => ({
  connect: jest.fn(),
  call: jest.fn(),
  ping: jest.fn(),
}));

// Create typed mock references
const mockConnect = connect as jest.Mock;
const mockCall = call as jest.Mock;

// Mock Convex HTTP Client (class)
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;
MockConvexHttpClient.mockImplementation(() => ({
  query: mockQuery,
  mutation: jest.fn(),
}) as any);

// Setup mock responses in beforeEach
beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(mockWs);
  mockQuery.mockResolvedValue(GATEWAY_CONFIG);
});
```

**What to Mock:**
- External services (Convex API, WebSocket connections, HTTP clients)
- Database operations (Convex db.query, db.get, db.patch)
- Network calls (fetch, axios, custom RPC clients)
- Time-based operations (when testing polling, debouncing)

**What NOT to Mock:**
- Pure utility functions (keep real: date helpers, string utilities)
- State management hooks (test with React Testing Library, not mocked)
- Business logic (test real logic, mock dependencies)
- Error constructors/classes (use real for validation)

**Test Data Constants:**
```typescript
const GATEWAY_CONFIG = {
  _id: 'gateway_123',
  name: 'Test Gateway',
  url: 'wss://test.gateway.example.com',
  token: 'tok_abc',
  disableDevicePairing: true,
  allowInsecureTls: false,
  workspaceRoot: '/workspace',
};

const mockSessions = [
  { key: 'session-1', label: 'Main Session' },
  { key: 'session-2', label: 'Backup Session' },
];
```

## Fixtures and Factories

**Test Data (observed patterns):**
```typescript
// Mock class: Create reusable database mock
class MockDatabase {
  private tasks: Map<string, any> = new Map();

  addTask(id: string, task: any) {
    this.tasks.set(id, task);
  }

  async get(id: string) {
    return this.tasks.get(id);
  }
}

// Factory function: Create mock context
function createMockCtx(db: MockDatabase) {
  return {
    db: {
      get: (id: string) => db.get(id),
      insert: (table: string, data: any) => db.insert(table, data),
      patch: (id: string, updates: any) => db.patch(id, updates),
    },
    storage: {
      getUrl: async () => 'mock-url',
    },
  };
}

// Test data builder: Inline object literals
const mockSessions: GatewaySession[] = [
  { key: 'session-1', label: 'Main Session', lastActivity: Date.now() - 5000 },
  { key: 'session-2', label: 'Backup Session', lastActivity: Date.now() - 30000 },
];
```

**Location:**
- Fixtures: Defined in test file itself (no separate fixture files observed)
- Mock classes: At top of test file, before describe blocks
- Constants: Defined before describe or within beforeEach
- Reusable factories: Export from test file or keep in same file

## Coverage

**Requirements:**
- Threshold: 50% globally (branches, functions, lines, statements)
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
npm run test:coverage  # Generates HTML report in ./coverage/
# Open coverage/index.html to view detailed breakdown
```

**Coverage Metrics Collected:**
- `lib/**/*.ts` - Utility and helper functions
- `convex/**/*.ts` - Backend mutations and queries
- `src/app/api/**/*.ts` - API route handlers
- Excluded: `.d.ts` files, node_modules, .next, dist, coverage

## Test Types

**Unit Tests:**
- **Scope:** Individual functions, utilities, pure logic
- **Approach:** No external dependencies, all inputs and outputs controlled
- **Examples:**
  - `lib/taskUtils.ts` functions: `isOverdue()`, `isDueSoon()`
  - `convex/utils/graphValidation.ts`: `detectCycle()`, `getTransitiveDependencies()`
  - Error class tests: `lib/errors/ApiError.ts` functionality
- **Assertion style:** Direct equality/property checks

**Integration Tests:**
- **Scope:** Convex mutations, API route handlers, full feature workflows
- **Approach:** Mock database and external services; test data flow through handler
- **Examples:**
  - `convex/tasks/__tests__/mutations.test.ts`: Test createTask, updateTask with mocked db
  - `src/app/api/gateway/[gatewayId]/__tests__/sessions.test.ts`: Test route handler with mocked RPC calls
  - `convex/__tests__/admin.test.ts`: Test clearAllData mutation across multiple tables
- **Assertion style:** Verify handler behavior, return values, database mutations

**E2E Tests:**
- **Framework:** Playwright (`playwright.config.ts`)
- **Scope:** User workflows, navigation, component rendering, page interactions
- **Examples:**
  - `e2e/gateway-sessions.spec.ts`: Navigate to gateways page, verify layout and interactions
  - `e2e/dashboard-header.spec.ts`: Test header rendering and behavior
  - `e2e/task-management.spec.ts`: Create, update, complete tasks through UI
- **Approach:** Real browser, real Next.js server, real Convex backend
- **Setup:** Playwright starts `npm run dev` automatically (configured in playwright.config.ts)

## Common Patterns

**Async Testing:**
```typescript
// Hook testing with React Testing Library
const { result } = renderHook(() => useGatewaySessions('gateway-1'));

// Wait for async operation
await waitFor(() => {
  expect(result.current.isLoading).toBe(false);
});

// Verify final state
expect(result.current.sessions).toEqual(mockSessions);

// Alternative: act() for state updates
await act(async () => {
  // Trigger state change
  fireEvent.click(screen.getByText('Button'));
});
```

**Error Testing:**
```typescript
// Mock API error
(global.fetch as jest.Mock).mockResolvedValueOnce({
  ok: false,
  status: 500,
  statusText: 'Internal Server Error',
});

// Test error handling
const { result } = renderHook(() => useGatewaySessions('gateway-1'));

await waitFor(() => {
  expect(result.current.isLoading).toBe(false);
});

expect(result.current.error).toBeTruthy();
expect(result.current.sessions).toEqual([]);

// Exception testing in Convex
it('should throw NOT_FOUND when agent not found', async () => {
  const ctx = createMockCtx(mockDb); // Empty db

  await expect(async () => {
    await updateAgent(ctx, { agentId: 'invalid', status: 'active' });
  }).rejects.toThrow('Agent not found');
});
```

**React Component Testing:**
```typescript
// @jest-environment jsdom
// Set environment at top of test file for React tests

describe('GatewaySessionsPanel Component', () => {
  it('renders sessions list when provided', () => {
    render(
      <GatewaySessionsPanel gatewayId="gateway-1" sessions={mockSessions} />
    );

    expect(screen.getByText('Main Session')).toBeInTheDocument();
    expect(screen.getByText('Backup Session')).toBeInTheDocument();
  });

  it('expands session to show details on click', () => {
    render(
      <GatewaySessionsPanel gatewayId="gateway-1" sessions={mockSessions} />
    );

    const mainSessionButton = screen.getByText('Main Session');
    fireEvent.click(mainSessionButton);

    expect(screen.getByText('Message History')).toBeInTheDocument();
  });
});
```

**Mock Cleanup:**
```typescript
// Automatic via jest.clearAllMocks()
beforeEach(() => {
  jest.clearAllMocks();
  // Reset global state
  process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

## Test Distribution

**Current Test Count:** 2507+ tests passing (98.6% success rate)

**Test Breakdown (by module):**
- Convex mutations/queries: ~400 tests
- React components: ~600 tests
- React hooks: ~200 tests
- API routes: ~150 tests
- Utilities: ~300 tests
- E2E: ~5 tests

**High Priority Gaps (observed):**
- `src/services/gatewayConnectionPool.ts`: New test file added (`gatewayConnectionPool.test.ts`)
- Error handling integration: Some mutation tests incomplete (partial coverage)
- E2E coverage: Only 5 E2E tests for entire application (expand as needed)

---

*Testing analysis: 2026-02-25*
