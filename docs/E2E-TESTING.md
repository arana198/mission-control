# End-to-End Testing Guide

## Overview

Mission Control has comprehensive E2E testing to ensure stability and functionality across all critical user flows. Tests are automated and run on every push, pull request, and daily.

## Test Suites

### 1. Critical User Flows (`e2e/critical-flows.spec.ts`)

Covers essential user workflows:

- **Navigation**: Root redirect, route transitions, back button
- **Phase 2 RBAC**: Members management, invitations, role assignment
- **Phase 3 Approvals**: Approval workflow, confidence scoring
- **Phase 4 Gateways**: Gateway creation, configuration, session management
- **Stability**: Console errors, promise rejections, offline handling
- **Performance**: Page load times, memory leaks
- **Accessibility**: Semantic HTML, button labels, navigation

**Run locally:**
```bash
npm run e2e -- e2e/critical-flows.spec.ts
```

### 2. UI Audit (`e2e/ui-audit.spec.ts`)

Automated comprehensive UI validation:

- Visits all discovered routes
- Tests all interactive elements
- Captures console errors
- Monitors network requests
- Generates detailed audit report

**Run locally:**
```bash
npm run e2e -- e2e/ui-audit.spec.ts
```

### 3. UI Audit Script (`scripts/audit-ui.js`)

Quick Node.js-based audit for rapid validation:

```bash
node scripts/audit-ui.js
```

**Output:** `reports/mission-control-ui-audit-[date].md`

## Running Tests Locally

### Prerequisites

Ensure both servers are running:

**Terminal 1 - Convex Backend:**
```bash
npm run convex:dev
```

**Terminal 2 - Next.js Frontend:**
```bash
npm run dev
```

### Run All E2E Tests

```bash
npm run e2e
```

### Run Specific Test Suite

```bash
npm run e2e -- e2e/critical-flows.spec.ts
```

### Run in UI Mode (Interactive)

```bash
npm run e2e:ui
```

This opens Playwright Inspector where you can:
- Pause and step through tests
- Inspect elements
- View network requests
- Debug failures

### Run in Debug Mode

```bash
npm run e2e:debug
```

Allows full browser inspection and step-through debugging.

## Continuous Integration

Tests run automatically via GitHub Actions on:

- **Every push** to `main` or `develop`
- **Every pull request** to `main` or `develop`
- **Daily schedule** at 2 AM UTC

### GitHub Actions Workflow

File: `.github/workflows/e2e-tests.yml`

**What it does:**
1. Installs dependencies
2. Starts Convex backend
3. Starts Next.js server
4. Runs critical flow tests
5. Runs UI audit
6. Generates audit report
7. Uploads artifacts
8. Comments results on PRs

## Test Coverage

### Phase 2: RBAC (Role-Based Access Control)

- ✅ Members page loads
- ✅ Invite form displays
- ✅ Email validation
- ✅ Role selection
- ✅ Member list rendering
- ✅ Invitations page loading
- ✅ Pending invitations display

### Phase 3: Approvals Governance

- ✅ Approvals page loads
- ✅ Empty state handling
- ✅ Confidence score display
- ✅ Approval list rendering
- ✅ Detail view loading

### Phase 4: Gateways

- ✅ Gateways page loads
- ✅ Gateway list display
- ✅ New Gateway button
- ✅ Gateway form creation
- ✅ Form validation
- ✅ Session management UI

### Navigation & Stability

- ✅ Root redirect to /overview
- ✅ All main routes accessible
- ✅ Back button navigation
- ✅ No console errors
- ✅ No unhandled rejections
- ✅ Offline handling
- ✅ Network error recovery

### Performance

- ✅ Page load time < 5 seconds
- ✅ No memory leaks
- ✅ Responsive navigation

### Accessibility

- ✅ Semantic HTML
- ✅ Heading hierarchy
- ✅ Button labels
- ✅ ARIA attributes

## Interpreting Test Results

### Success ✅

```
Running 1 test using 1 worker
✓ Comprehensive UI Navigation & Validation (5s)

1 passed (15s)
```

### Failure ❌

Tests print detailed error messages:

```
Error: Timeout waiting for element: button:has-text("Create Gateway")
  at e2e/critical-flows.spec.ts:150:10
```

**Common issues:**
- Element not found → Check selectors in test
- Timeout → Server not running or route not found
- Network errors → Check Convex/Next.js logs

### Audit Report ✅

After running audit script:

```
✓ Audit complete!

  Pages visited: 15
  Errors found: 0
  Network errors: 0
  Console errors: 0

✅ Report saved: reports/mission-control-ui-audit-2026-02-25.md
```

## Debugging Failures

### 1. Check Server Logs

**Convex:**
```bash
tail -100 /tmp/convex.log
```

**Next.js:**
```bash
tail -100 /tmp/nextjs.log
```

### 2. Use Debug Mode

```bash
npm run e2e:debug
```

This opens browser dev tools for inspection.

### 3. Use UI Mode

```bash
npm run e2e:ui
```

Step through tests and inspect state.

### 4. Check Playwright Report

After test runs:

```bash
npm run e2e
# Report opens automatically, or:
npx playwright show-report
```

## Adding New Tests

### Template

```typescript
test('should do something specific', async ({ page }) => {
  // Arrange
  await page.goto(`${BASE_URL}/route`);
  await page.waitForLoadState('networkidle');

  // Act
  await page.click('button:has-text("Action")');

  // Assert
  const result = page.locator('text=Expected Result');
  await expect(result).toBeVisible();
});
```

### Best Practices

1. **Use descriptive names** - Test name should clearly describe what's tested
2. **Wait for network idle** - Ensure data is loaded: `await page.waitForLoadState('networkidle')`
3. **Use data-testid for flaky elements** - Add `data-testid="unique-id"` to components for reliable selection
4. **Avoid hardcoded waits** - Use proper wait conditions
5. **Test user workflows** - Think about real user actions
6. **Keep tests independent** - Each test should not depend on others
7. **Clean up state** - Use `beforeEach` for setup and cleanup

### Where to Add Tests

- **Navigation flows** → `e2e/critical-flows.spec.ts`
- **Feature-specific** → Create `e2e/feature-name.spec.ts`
- **Regression tests** → Add to `e2e/critical-flows.spec.ts`

## Test Data

Tests use **no seed data** and work with:
- Empty state UI
- Navigation structure
- Form rendering
- Error handling

If you need to test with specific data:

1. Add API calls in test:
   ```typescript
   // Create test data via API
   await page.request.post(`${BASE_URL}/api/businesses`, {
     data: { name: 'Test Business' }
   });
   ```

2. Use fixtures for complex setups

## Performance Benchmarks

Current acceptable thresholds:

| Metric | Threshold |
|--------|-----------|
| Page load time | < 5 seconds |
| Route navigation | < 2 seconds |
| Form submission | < 3 seconds |
| Console errors | 0 |
| Network failures | 0 |

## Monitoring

### Local Dashboard

After each test run:
1. Check console output for pass/fail summary
2. Review artifacts in `playwright-report/`
3. Check audit report in `reports/`

### CI Dashboard

GitHub Actions shows:
- ✅ All tests passed
- ❌ Test failures with logs
- 📊 Artifact downloads
- 💬 PR comments with results

## Troubleshooting

### "Port 3000 already in use"

Kill existing process:
```bash
lsof -i :3000 | grep -v PID | awk '{print $2}' | xargs kill -9
```

### "Cannot find Playwright browsers"

Install browsers:
```bash
npx playwright install
```

### "Connection refused"

Ensure servers are running:
```bash
curl http://localhost:3001
```

### "Element not found"

1. Check element exists in page
2. Verify selector is correct
3. Add wait condition: `await page.waitForSelector(selector)`
4. Run in debug mode to inspect

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/locators)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Support

For test issues:

1. Check test output and logs
2. Run in debug mode (`npm run e2e:debug`)
3. Review test code in `e2e/`
4. Check server logs
5. Open an issue with reproduction steps

---

**Last Updated:** 2026-02-25
**Test Framework:** Playwright
**Coverage:** Critical user flows + UI audit
**CI:** GitHub Actions
