# Mission Control

**Autonomous task coordination platform for AI agent squads**

Mission Control is a next-generation task management and coordination system designed to orchestrate autonomous AI agents working as a cohesive squad. Built with modern React/Next.js and Convex, it provides real-time task assignment, dependency tracking, and squad performance analytics.

## 🎯 Core Features

- **Squad Management** - Coordinate up to 10 specialized AI agents with different roles and expertise levels
- **Intelligent Task Assignment** - Auto-assign tasks based on agent capabilities, workload, and expertise matching
- **Kanban Board** - Drag-and-drop task organization across 6 status columns (Backlog → Done)
- **Dependency Tracking** - Prevent circular dependencies and visualize task blocking relationships
- **Epic Management** - Structure work into strategic initiatives with progress tracking
- **Real-time Notifications** - Live updates on task status, agent activity, and blockers
- **Workload Analytics** - Monitor agent utilization, identify bottlenecks, critical paths
- **Persistence & Filtering** - Save filter preferences, search tasks, organize by priority/epic
- **Mobile-Responsive UI** - Scroll-snap Kanban for seamless mobile experience
- **Accessibility First** - Full ARIA support, keyboard navigation, semantic HTML

## 🏗️ Architecture

**Frontend:**
- Next.js 14+ with App Router
- React 18+ with Suspense boundaries
- TailwindCSS for styling
- Custom hooks for state management and mutations
- Error boundaries and loading skeletons

**Backend:**
- Convex for real-time database and mutations
- Deterministic migrations for schema safety
- Automated seeding with demo data
- Comprehensive logging and monitoring

## ⚡ Recent Improvements

### Phase 1: Developer Experience (28 Tests)
- Comprehensive mutation test coverage for critical functions
- Test-driven development for all new logic

### Phase 2: Code Quality (Hooks)
- Centralized error handling with `useMutationWithNotification`
- Immutable state management with `useSetState`
- Integrated into 6+ components (67% average code reduction)

### Phase 3: Component Architecture (SRP)
- Refactored DashboardContent: 489 → 150 lines
- Extracted 5 specialized sub-components
- Single Responsibility Principle throughout

### Phase 4: User Experience
- ConfirmDialog for destructive actions
- Per-mutation loading indicators with spinners
- Filter persistence to localStorage
- Mobile Kanban with horizontal scroll-snap

### Phase 5: Accessibility & Type Safety
- Full ARIA attributes and keyboard navigation
- 5 shared TypeScript interfaces
- Replaced 48 `any[]` instances with proper types
- 162 passing tests, clean TypeScript compilation

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start Convex backend (Terminal 1)
npm run convex:dev

# Start Next.js frontend (Terminal 2)
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## 📊 Project Stats

- **Components**: 30+ reusable React components
- **Tests**: 162 unit & integration tests
- **Type Safety**: Full TypeScript with Convex types
- **Performance**: Lazy-loaded components, optimized queries
- **Mobile**: Responsive design with scroll-snap
- **Accessibility**: WCAG compliant with keyboard nav

## 🎓 Design Principles

- **Test First**: TDD enforced - tests written before implementation
- **DRY**: Centralized logic in reusable hooks
- **SOLID**: Single Responsibility, Dependency Inversion
- **Type Safe**: Comprehensive TypeScript coverage
- **Accessible**: Keyboard navigation and screen reader support

## 🔧 Tech Stack

- **Runtime**: Node.js 18+, Browser ES2020+
- **Frontend**: Next.js 14, React 18, TailwindCSS
- **Backend**: Convex (Real-time Database)
- **Testing**: Jest, Vitest
- **Linting**: ESLint, TypeScript
- **Icons**: Lucide React
- **Utilities**: Zod (validation), Clsx (CSS classes)

## 📝 License

MIT

---

**Mission Control**: Because coordinating autonomous agents shouldn't require manual intervention.
