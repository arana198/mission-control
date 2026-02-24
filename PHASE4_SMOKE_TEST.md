# Phase 4: Manual Smoke Testing Checklist

This document provides step-by-step instructions to manually validate all Phase 4 Enhanced UI/UX improvements.

## Prerequisites
Ensure both backends are running in separate terminals:

**Terminal 1 (Backend):**
```bash
npm run convex:dev
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

Then navigate to `http://localhost:3000` in your browser.

---

## Priority 1: Critical UX Bugs

### ✓ Toast Animation (slide-in keyframe)
**Steps:**
1. Open a business dashboard (any view)
2. Trigger an error or success notification:
   - Hover over a task and change status
   - Create a new task
   - Update task details
3. **Expected:** Toasts slide in from the top with smooth animation (not instant pop)
4. **Verify:** Animation is smooth and takes ~0.2 seconds

---

### ✓ TaskDetailModal - Escape Key Handler
**Steps:**
1. Navigate to any task board
2. Click on a task to open the detail modal
3. Press the **Escape** key on your keyboard
4. **Expected:** Modal closes immediately and URL reverts to `?task=` parameter

**Additional Test:**
- Verify keyboard shortcut help text exists (should show "Esc — Close modals")
- Click Escape multiple times (should be idempotent)

---

### ✓ EnhancedTaskComments - Data Loss Prevention
**Steps:**
1. Open a task detail modal
2. In the comments section, type a comment (e.g., "Test comment")
3. **Simulate network error:**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Check "Offline" to block requests
4. Click the Send button
5. **Expected:**
   - Error toast appears: "Failed to post comment"
   - Your text is **STILL IN THE TEXT BOX** (not cleared)
6. Uncheck "Offline" in DevTools
7. Click Send again
8. **Expected:** Comment posts successfully this time

**Verify Submit Button Behavior:**
- Submit button is **disabled** while text is empty
- Submit button is **disabled** while submission is in-flight (shows loading state)

---

### ✓ Bulk Actions - Error Handling
**Steps:**
1. Navigate to task board
2. Enable bulk mode (click the bulk action checkbox)
3. Select multiple tasks (5-10 tasks)
4. Open DevTools Network tab and enable "Offline" mode
5. Click "Move to Review" (or similar bulk action)
6. **Expected:** Error toast appears with message like "Failed to move tasks"
7. Tasks remain selected (can retry)
8. Disable Offline mode and retry
9. **Expected:** Bulk move succeeds and selection clears

---

## Priority 2: Next.js Error Pages

### ✓ Page-Level Error Boundary (error.tsx)
**Steps:**
1. In browser DevTools Console, paste:
   ```javascript
   throw new Error("Test page error");
   ```
2. Press Enter
3. **Expected:**
   - Error page displays with:
     - Red card with AlertTriangle icon
     - "Something went wrong" heading
     - Error message text
     - Red "Try again" button
   - Page is NOT white screen

4. Click "Try again" button
5. **Expected:** Page recovers and returns to normal state

---

### ✓ Root Layout Error Boundary (global-error.tsx)
**Steps:**
1. This is harder to test locally (requires root layout crash)
2. **Verify it exists:** Check that `/src/app/global-error.tsx` is present
3. **Note:** This will catch critical errors in the root layout (rarely triggered in dev)

---

## Priority 3: Silent Console Errors → User Feedback

### ✓ HelpRequestButton - Error Toast
**Steps:**
1. Open a task in "in_progress" status
2. Click "I'm Stuck" button (in task detail modal)
3. Fill out the help request form
4. Open DevTools Network and enable "Offline"
5. Click "Escalate to Lead"
6. **Expected:** Error toast appears (not just console error)
7. Disable Offline and retry
8. **Expected:** Help request succeeds

---

### ✓ DefinitionOfDoneChecklist - Error Toasts
**Steps:**
1. Open a task with a checklist in the detail modal
2. Disable network (DevTools → Offline)
3. Try each action:
   - Add a new checklist item
   - Toggle an existing item
   - Delete an item
4. **Expected:** Error toast appears for each (not console error)

---

### ✓ WikiPageEditor - Error Toast
**Steps:**
1. Navigate to Wiki section
2. Create or edit a wiki page
3. Disable network (DevTools → Offline)
4. Make changes and click "Save"
5. **Expected:**
   - Save state shows "Error saving" (inline)
   - Error toast appears with "Failed to save page"
6. Re-enable network and retry
7. **Expected:** Save succeeds

---

### ✓ WikiDocs Handlers - Error Toasts
**Steps:**
1. Navigate to Wiki section
2. For each operation, disable network first, then:
   - Create a new page
   - Update/rename a page
   - Delete a page
   - Move a page
3. **Expected:** Error toast appears (not alert dialog)
4. Verify alert() dialogs are gone (should see toasts instead)

---

## Priority 4: Loading State Polish

### ✓ Skeleton Loading - Undefined vs Empty
**Steps:**
1. Navigate to `/[businessSlug]/board` (task board)
2. Open DevTools Network tab
3. Set throttle to "Slow 3G" to slow down network
4. **Refresh the page**
5. **Expected:**
   - KanbanSkeleton with shimmer animation appears
   - Skeleton **animates** with gradient flow effect
   - NOT just a static gray box
6. Wait for data to load
7. **Expected:** Kanban board replaces skeleton smoothly

**Verify Shimmer Animation:**
- Look for gradient moving from left to right
- Takes ~2 seconds per cycle
- Repeats continuously while loading

---

### ✓ Loading State - Epics Tab
**Steps:**
1. Navigate to `/[businessSlug]/board?tab=epics`
2. Set network to "Slow 3G"
3. **Expected:** CardGridSkeleton appears with shimmer animation
4. Wait for data to load
5. **Expected:** Epic cards appear and skeleton fades

---

### ✓ Loading State - Overview Tab
**Steps:**
1. Navigate to `/[businessSlug]/board?tab=overview` (or main overview)
2. Set network to "Slow 3G"
3. **Expected:** LoadingSkeleton appears with shimmer animation
4. Wait for stats cards to appear
5. **Expected:** Stats render properly

---

## Summary Checklist

- [ ] Toast animations slide in smoothly
- [ ] Escape key closes task detail modal
- [ ] Comment text preserved on submission failure
- [ ] Submit button disabled during submission
- [ ] Bulk action errors show toast (not silent fail)
- [ ] Page error shows styled error boundary
- [ ] All console.error replaced with toasts
- [ ] Help request error shows toast
- [ ] Checklist operations show error toasts
- [ ] Wiki save error shows toast
- [ ] Wiki operations show error toasts (no alert dialogs)
- [ ] Skeleton loaders show shimmer animation
- [ ] Loading state appears while data fetches
- [ ] Data loads and replaces skeleton

---

## How to Run E2E Tests (with servers running)

Once manual smoke testing passes, you can run automated E2E tests:

```bash
# Terminal 3 (after Convex and Next.js are running):
npm run e2e
```

Or with UI mode for debugging:
```bash
npm run e2e:ui
```

---

## Notes

- All changes compile without errors: `npm run build` ✅
- Phase 4 is ready for production after manual validation
- No breaking changes to existing APIs or components
- All error handling is backwards compatible
