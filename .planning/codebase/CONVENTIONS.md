# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- TypeScript files: `camelCase.ts` (e.g., `gatewayConnectionPool.ts`, `workflowValidation.ts`)
- React components: `PascalCase.tsx` (e.g., `BusinessFilter.tsx`, `WorkspaceFilter.tsx`, `AgentDetailModal.tsx`)
- Test files: `__tests__/` directory with `*.test.ts` or `*.test.tsx` suffix (e.g., `__tests__/workflowValidation.test.ts`)
- Utility modules: `camelCase.ts` for functions and classes (e.g., `agentProvisioning.ts`, `epicTaskSync.ts`)
- Barrel files: `index.ts` exports all named exports from a module

**Functions:**
- Regular functions: `camelCase` (e.g., `detectWorkflowCycle()`, `topologicalSort()`, `buildCacheKey()`)
- React hooks: `useXxx` (e.g., `useNotification()`, `useGatewaySessions()`, `useFilterPersistence()`)
- Helper functions: `camelCase`, internal functions use no prefix (e.g., `interpolate()`, `identityTemplate()`)
- Class methods: `camelCase` (e.g., `acquire()`, `release()`, `buildCacheKey()`)

**Variables:**
- Local variables: `camelCase` (e.g., `cacheKey`, `filteredWorkspaces`, `selectedWorkspaceId`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `POOL_TTL_MS = 60_000`, `POOL_MAX_PER_KEY = 3`)
- Boolean variables: `isX` or `hasX` (e.g., `isOpen`, `inUse`, `isValid`)
- React state: `useState<Type>` with variable and setter (e.g., `const [selectedWorkspaceId, setSelectedId]`)

**Types and Interfaces:**
- Types: `PascalCase` (e.g., `WorkflowExecutionStatus`, `StepExecutionStatus`)
- Interfaces: `PascalCase` (e.g., `ConnectConfig`, `PoolEntry`, `ValidationResult`)
- Props interfaces: `{ComponentName}Props` (e.g., `WorkspaceFilterProps`)
- Exported types: defined at module top with JSDoc comments

## Code Style

**Formatting:**
- No formatter configured in repo (no prettier/biome config files)
- TypeScript strict mode enabled: `"strict": true` in frontend/tsconfig.json
- 2-space indentation (inferred from code samples)
- Line length: ~80 characters (observed in comments and code structure)
- Semicolons: required at statement end (TypeScript default)

**Linting:**
- ESLint configured: `eslint: ^8.0.0` in dependencies
- Next.js ESLint config: `eslint-config-next: ^14.0.0`
- No custom `.eslintrc` found; uses Next.js defaults
- Run: `npm run lint` (proxies to `next lint`)

## Import Organization

**Order:**
1. External packages (React, third-party libraries)
2. Absolute path imports (@/ aliases)
3. Relative imports (internal modules)
4. Blank line between groups (if present)

**Example from `workflowValidation.ts`:**
```typescript
// No external imports (pure logic)
// Interfaces and types defined inline at top
export type WorkflowExecutionStatus = "pending" | "running" | ...
```

**Example from `gatewayConnectionPool.ts`:**
```typescript
import WebSocket from 'ws';        // External package
import { connect } from '@/services/gatewayRpc';  // Absolute path (@/)
```

**Path Aliases:**
- `@/convex/*` → `../backend/convex/*`
- `@/lib/*` → `./lib/*` (frontend)
- `@/types/*` → `./src/types/*`
- `@/components/*` → `./src/components/*`
- `@/hooks/*` → `./src/hooks/*`
- `@/services/*` → `./src/services/*`
- `@/contexts/*` → `./src/contexts/*`
- `@/styles/*` → `./src/styles/*`
- `@/*` → `./*` (catch-all)

## Error Handling

**Patterns:**

**Throwing errors with context:**
```typescript
// From agentProvisioning.ts
} catch (error) {
  throw new Error(`Failed to provision agent ${agentKey}: ${(error as Error).message}`);
}
```

**Catching specific errors:**
```typescript
// From gatewayRpc.ts
} catch (e) {
  // Error handling with type assertion
  reject(new Error(`RPC call timeout: ${method}`));
}
```

**Silent catches (when safe):**
```typescript
// From gatewayConnectionPool.ts
} catch {
  // Socket cleanup on error, silently continue with pool management
}
```

**Error response structure (API handlers):**
```typescript
// Return { success: false, error: "message" } for failures
expect(data.success).toBe(false);
```

**Status codes:**
- 200: Success
- 201: Created
- 400: Bad request (validation failed)
- 401: Unauthorized (auth failed)
- 500: Server error

## Logging

**Framework:** `console` for basic logging

**Patterns:**
- No pino/winston integration for logs in analyzed code
- Console.log used implicitly in error messages
- Error tracking: use Error constructors with context (e.g., "Failed to provision agent X")
- No DEBUG env var patterns observed

## Comments

**When to Comment:**
- File-level: JSDoc block at top of file explaining module purpose
- Function-level: JSDoc blocks for exported functions, especially public APIs
- Inline: Only for non-obvious logic or workarounds
- Decision points: Why a choice was made (not what the code does)

**JSDoc/TSDoc:**
```typescript
/**
 * Detect if a workflow graph contains a cycle using DFS.
 *
 * @param nodes - Map of node IDs to node objects
 * @param edges - Map of node IDs to arrays of successor node IDs
 * @returns true if a cycle is detected, false otherwise
 */
export function detectWorkflowCycle(
  nodes: Record<string, WorkflowNode>,
  edges: Record<string, string[]>
): boolean
```

**File-level comments:**
```typescript
/**
 * Pure Logic Functions for Workflow Validation
 *
 * Zero Convex dependencies. All functions are deterministic and testable in isolation.
 * Used by Convex mutations to validate workflows before persisting.
 */
```

**Architecture comments:**
```typescript
/**
 * Gateway Connection Pool
 *
 * Module-level singleton that keeps authenticated WebSocket connections alive
 * for 60 seconds of idle time. Handlers call pool.acquire() instead of connect()
 * and pool.release() instead of ws.close().
 */
```

## Function Design

**Size:** Functions should be < 50 lines when possible (observed: most utility functions 10-40 lines)

**Parameters:**
- Prefer explicit parameters over object spreading
- Use interface for complex parameter objects
```typescript
export interface ConnectConfig {
  url: string;
  token?: string;
  disableDevicePairing?: boolean;
  allowInsecureTls?: boolean;
}
async acquire(gatewayId: string, config: ConnectConfig): Promise<WebSocket>
```

**Return Values:**
- Explicit return types for all exported functions
- Use `void` for side-effect-only functions
- Async functions return `Promise<T>`
- Use union types for multiple return states
```typescript
export type WorkflowExecutionStatus = "pending" | "running" | "success" | "failed" | "aborted";
```

## Module Design

**Exports:**
- Named exports preferred: `export function`, `export const`, `export interface`
- Default exports avoided (not observed in codebase)
- Module singletons exported as constants: `export const gatewayPool = new GatewayConnectionPool()`
- Interfaces exported for consumers to use in type annotations

**Barrel Files:**
- `index.ts` exists but role not extensively documented in samples
- Path aliases used to shield consumers from internal structure

## Type Safety

**TypeScript Strict Mode:**
- `"strict": true` enforced
- All parameters explicitly typed
- All return types explicitly declared
- No implicit `any` types
- Type guards for runtime checks:
```typescript
if (!visited.has(successor)) {
  if (dfs(successor)) {
    return true;
  }
}
```

## Testing Conventions (Related to Code)

- Pure functions isolated from side effects (no Convex dependencies in validation logic)
- Class methods clearly defined with public/private intent via naming
- Exports grouped at end of module for clarity

---

*Convention analysis: 2026-02-26*
