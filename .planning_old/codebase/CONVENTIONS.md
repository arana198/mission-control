# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- Component files: PascalCase (e.g., `GatewaySessionsPanel.tsx`)
- Hook files: camelCase with `use` prefix (e.g., `useGatewaySessions.ts`)
- Utility/service files: camelCase (e.g., `gatewayRpc.ts`, `taskUtils.ts`)
- Test files: match source file name with `.test.ts` or `.test.tsx` suffix
  - Location: Co-located in `__tests__/` directory (e.g., `src/components/__tests__/GatewaySessionsPanel.test.tsx`)
  - Convex tests: `convex/__tests__/` or nested (e.g., `convex/tasks/__tests__/mutations.test.ts`)

**Functions:**
- camelCase for all functions (exports and internal)
- Examples: `useGatewaySessions()`, `fetchSessions()`, `detectCycle()`, `inferTagsFromContent()`
- Factory functions and helpers: prefix with action verb (e.g., `createMockCtx()`, `makeSessionsRequest()`)

**Variables:**
- camelCase for all variables, including state variables
- Examples: `isLoading`, `expandedSession`, `mockSessions`, `gatewayConfig`
- Constants (truly immutable): UPPER_SNAKE_CASE
  - Example: `const ONE_DAY = 86400000;` in `lib/taskUtils.ts`
  - Example: `const ALLOWED_TRANSITIONS` in `lib/constants/taskTransitions.ts`

**Types:**
- PascalCase for all interfaces and type aliases
- Examples: `GatewaySession`, `UseGatewaySessionsReturn`, `HistoryEntry`, `RpcRequest`
- Enum values: PascalCase (e.g., `ErrorCode.VALIDATION_ERROR`)

**Interfaces:**
- Props interfaces: `{ComponentName}Props` suffix (e.g., `GatewaySessionsPanelProps`)
- Return types: `Use{HookName}Return` for hooks (e.g., `UseGatewaySessionsReturn`)
- Generic structures: Descriptive names without suffix (e.g., `GatewaySession`, `HistoryEntry`)

## Code Style

**Formatting:**
- ESLint configured via `next lint` (Next.js default rules)
- Indentation: 2 spaces (checked in `.next/` generated files)
- Line length: No hard limit enforced; practical limit ~100 characters
- Semicolons: Required (enforced by Next.js/TypeScript)

**Linting:**
- Tool: ESLint with Next.js config (`eslint-config-next`)
- Command: `npm run lint`
- Rules follow Next.js opinionated defaults (import ordering, React rules, etc.)

## Import Organization

**Order (observed pattern):**
1. React and React utilities (hooks, utilities)
   - `import { useEffect, useState, useRef } from "react";`
   - `import { useRouter } from "next/navigation";`
2. External libraries
   - `import { useQuery } from "convex/react";`
   - `import WebSocket from "ws";`
3. Project alias imports (`@/...`)
   - `import { api } from "../../convex/_generated/api";` (or use `@/convex/...`)
   - `import { useWorkspace } from "./WorkspaceProvider";`
4. Type imports (rarely separate, usually inline)
   - `import { Task } from "@/types/task";`
5. Icon imports (grouped together)
   - `import { Search, FileText, Target, ... } from "lucide-react";`
6. Utility imports
   - `import clsx from "clsx";`

**Path Aliases (configured in tsconfig.json):**
- `@/*` → root-level files (fallback)
- `@/types/*` → `./src/types/*`
- `@/components/*` → `./src/components/*`
- `@/hooks/*` → `./src/hooks/*`
- `@/services/*` → `./src/services/*`
- `@/convex/*` → `./convex/*`
- `@/lib/*` → `./lib/*`

**No barrel files detected** - imports are direct from source files (e.g., `import { GatewaySession } from "@/hooks/useGatewaySessions"`)

## Error Handling

**Patterns:**
- `ApiError` class (`lib/errors/ApiError.ts`) for standardized errors in Convex mutations
  - Constructor: `new ApiError(ErrorCode.NOT_FOUND, message, details?)`
  - Static factories: `ApiError.notFound(resource, details?)`, `ApiError.validationError(message, details?)`, `ApiError.conflict(message, details?)`
  - Methods: `isRetryable()`, `toJSON()`

**Error Codes (enum):**
- `VALIDATION_ERROR` (422)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `FORBIDDEN` (403)
- `LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` (500)
- `SERVICE_UNAVAILABLE` (503)

**Usage examples:**
- Convex mutations: Wrap with `wrapConvexHandler()` from `lib/errors/convexErrorHandler.ts`
- In handlers: Check preconditions, throw `ApiError` with appropriate code
- Location: `convex/examples/errorHandlingPattern.ts` shows recommended patterns

**Component/Hook Error Handling:**
- State-based: `error` state variable (string or null)
  - Example: `const [error, setError] = useState<string | null>(null);`
  - Set on catch: `setError(message)` where message is parsed from Error instance
- Fetch errors: Parse response status, throw Error with descriptive message
  - Example: `throw new Error(\`API error: ${response.status} ${response.statusText}\`);`

## Logging

**Framework:** No logger detected in conventions; uses `console.*` methods
- `console.log()` - informational
- `console.error()` - errors
- Pino logger configured in `package.json` but not used in observed code

**Patterns (observed):**
- Minimal logging in source code
- Error context logged in test setup/teardown
- Activity logging in Convex: `resolveActorName()` utility in `convex/utils/activityLogger.ts`

## Comments

**When to Comment:**
- File headers: JSDoc block describing purpose and key responsibilities
  - Pattern: `/** File purpose ... */` at top of file
  - Example: `useGatewaySessions.ts` has "Real-time gateway session fetching and management"
- Function headers: JSDoc with parameters and return type
  - Example: `/** Check if a task is overdue (more than 1 day past due date) */`
- Inline: Sparingly, only for non-obvious logic
  - Example: "Skip if no gatewayId or not active"
  - Example: "Polling effect" before useEffect setup

**JSDoc/TSDoc:**
- Function parameters documented in JSDoc comments:
  ```typescript
  /**
   * Check if a task is overdue (more than 1 day past due date)
   * @param dueDate - timestamp in milliseconds
   * @returns true if dueDate is more than 24 hours in the past
   */
  export function isOverdue(dueDate?: number): boolean { ... }
  ```
- Return types implicit from code (TypeScript handles this)

## Function Design

**Size:** Keep functions small; complexity threshold ~50 lines
- Examples: Most utility functions 5-20 lines
- Larger functions (mutations, complex hooks): ~40-60 lines, well-commented

**Parameters:**
- Positional parameters for primary inputs
- Object parameter for multiple related options (seen in component props)
  - Example: `GatewaySessionsPanelProps` spreads 8 props instead of positional args
- Optional parameters: Use `?` in interface or default in function signature
  - Example: `isActive: boolean = true` (default in useGatewaySessions)
  - Example: `sessions?: GatewaySession[]` (optional in component props)

**Return Values:**
- Single value for simple functions
- Object return for multiple related values
  - Example: `UseGatewaySessionsReturn` returns `{ sessions, isLoading, error, refresh, sendMessage, fetchHistory }`
- Void for mutations with side effects (Convex pattern)
- Promise<T> for async operations

## Module Design

**Exports:**
- Named exports preferred (not default exports) for utilities and hooks
  - Example: `export function useGatewaySessions() { ... }`
  - Example: `export const clearAllData = mutation({ ... })`
- Default export for React components (some files)
  - Example: `export function GatewaySessionsPanel() { ... }` (named in this codebase)

**Barrel Files:**
- No barrel files observed (`src/types/index.ts` does not exist)
- Imports are direct from source files (e.g., `@/hooks/useGatewaySessions`)
- Recommendation: Add barrel files for cleaner imports if importing multiple items from same directory

**Module Patterns:**
- Services as functions with WebSocket lifecycle management
  - Example: `gatewayRpc.ts` exports `connect()` and `call()` functions for RPC over WebSocket
  - Pattern: Acquire resource, use, close in try/finally
- Hooks manage React state and side effects
  - Example: `useGatewaySessions` manages fetch state, polling, error handling
- Convex mutations/queries use `wrapConvexHandler()` for error standardization
  - Example: `admin.ts` mutations use ApiError for consistent responses

---

*Convention analysis: 2026-02-25*
