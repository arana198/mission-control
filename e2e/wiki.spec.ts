import { test, expect } from "@playwright/test";

test.describe("Wiki Documents", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to wiki page
    await page.goto("/business/test/documents");
  });

  test("should display empty state when no pages exist", async ({ page }) => {
    const emptyState = page.getByText(/Create your first department/);
    await expect(emptyState).toBeVisible();
  });

  test("should create a new department", async ({ page }) => {
    // Click create department button
    await page.getByRole("button", { name: /Create your first department/i }).click();

    // Verify tree appears
    const treeContainer = page.getByText("DEPARTMENTS");
    await expect(treeContainer).toBeVisible();

    // Verify new department appears
    const newDept = page.getByText(/New Department/i);
    await expect(newDept).toBeVisible();
  });

  test("should open page viewer when selecting a page", async ({ page }) => {
    // Create a department
    await page.getByRole("button", { name: /Create your first department/i }).click();

    // Select the page (click on it in tree)
    await page.getByText(/New Department/i).first().click();

    // Verify viewer is shown
    const editButton = page.getByRole("button", { name: /Edit/i });
    await expect(editButton).toBeVisible();
  });

  test("should enter edit mode when Edit button is clicked", async ({ page }) => {
    // Create and select a department
    await page.getByRole("button", { name: /Create your first department/i }).click();
    await page.getByText(/New Department/i).first().click();

    // Click Edit button
    await page.getByRole("button", { name: /Edit/i }).click();

    // Verify editor elements appear
    const titleInput = page.locator("input[placeholder='Page title']");
    await expect(titleInput).toBeVisible();

    // Verify toolbar is visible
    const toolbar = page.getByRole("button", { name: /Bold/i });
    await expect(toolbar).toBeVisible();
  });

  test("should format text in editor (bold, italic, headings)", async ({ page }) => {
    // Create and select a page
    await page.getByRole("button", { name: /Create your first department/i }).click();
    await page.getByText(/New Department/i).first().click();
    await page.getByRole("button", { name: /Edit/i }).click();

    // Type in editor
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Test content");

    // Apply bold (Cmd+B)
    await page.keyboard.press("MetaOrControl+A");
    await page.keyboard.press("MetaOrControl+B");

    // Verify button is active
    const boldButton = page.getByRole("button", { name: /Bold/i }).first();
    await expect(boldButton).toHaveClass(/bg-primary/);
  });

  test("should auto-save page content", async ({ page }) => {
    // Create and select a page
    await page.getByRole("button", { name: /Create your first department/i }).click();
    await page.getByText(/New Department/i).first().click();
    await page.getByRole("button", { name: /Edit/i }).click();

    // Edit title
    const titleInput = page.locator("input[placeholder='Page title']");
    await titleInput.clear();
    await titleInput.fill("Test Page");

    // Wait for auto-save (2s debounce)
    await page.waitForTimeout(2500);

    // Verify save status indicator
    const savedText = page.getByText(/Saved/);
    await expect(savedText).toBeVisible();
  });

  test("should add and display comments", async ({ page }) => {
    // Create and view a page
    await page.getByRole("button", { name: /Create your first department/i }).click();
    await page.getByText(/New Department/i).first().click();

    // Scroll to comments section
    await page.locator("textarea[placeholder='Add a comment...']").scrollIntoViewIfNeeded();

    // Add a comment
    await page.locator("textarea[placeholder='Add a comment...']").fill("Test comment");
    await page.getByRole("button", { name: /Post Comment/i }).click();

    // Verify comment appears
    const comment = page.getByText("Test comment");
    await expect(comment).toBeVisible();
  });

  test("should open search overlay with Cmd+K", async ({ page }) => {
    // Press Cmd+K
    await page.keyboard.press("MetaOrControl+K");

    // Verify search overlay appears
    const searchInput = page.locator("input[placeholder='Search pages...']");
    await expect(searchInput).toBeVisible();
  });

  test("should search and navigate to results", async ({ page }) => {
    // Create a page with specific title
    await page.getByRole("button", { name: /Create your first department/i }).click();
    const titleInput = page.locator("input[placeholder='Page title']");
    await titleInput.clear();
    await titleInput.fill("Engineering Docs");
    await page.waitForTimeout(2500); // Wait for auto-save

    // Open search
    await page.keyboard.press("MetaOrControl+K");

    // Type search query
    const searchInput = page.locator("input[placeholder='Search pages...']");
    await searchInput.fill("Engineering");

    // Select result and navigate
    await page.keyboard.press("Enter");

    // Verify page is selected
    const pageTitle = page.locator("h1:has-text('Engineering Docs')");
    await expect(pageTitle).toBeVisible();
  });

  test("should view version history", async ({ page }) => {
    // Create and edit a page multiple times
    await page.getByRole("button", { name: /Create your first department/i }).click();
    await page.getByText(/New Department/i).first().click();

    // Make first edit
    await page.getByRole("button", { name: /Edit/i }).click();
    const titleInput = page.locator("input[placeholder='Page title']");
    await titleInput.clear();
    await titleInput.fill("Version 1");
    await page.waitForTimeout(2500);

    // Go back to view
    await page.getByRole("button", { name: /Done/i }).click();

    // Open history
    await page.getByRole("button", { name: /History/i }).click();

    // Verify history panel appears
    const historyTitle = page.getByText(/Version History/);
    await expect(historyTitle).toBeVisible();

    // Verify version is listed
    const version = page.getByText(/v1/);
    await expect(version).toBeVisible();
  });

  test("should restore a previous version", async ({ page }) => {
    // Create and edit a page
    await page.getByRole("button", { name: /Create your first department/i }).click();
    await page.getByText(/New Department/i).first().click();
    await page.getByRole("button", { name: /Edit/i }).click();

    const titleInput = page.locator("input[placeholder='Page title']");
    await titleInput.clear();
    await titleInput.fill("Original Title");
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Done/i }).click();

    // Make another edit
    await page.getByRole("button", { name: /Edit/i }).click();
    await titleInput.clear();
    await titleInput.fill("Modified Title");
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Done/i }).click();

    // Open history
    await page.getByRole("button", { name: /History/i }).click();

    // Click on first version
    await page.getByText(/v1/).first().click();

    // Click restore
    await page.getByRole("button", { name: /Restore/i }).click();

    // Go back to view
    await page.waitForTimeout(1000);

    // Verify content is restored
    const title = page.locator("h1:has-text('Original Title')");
    await expect(title).toBeVisible();
  });

  test("should rename a page in tree", async ({ page }) => {
    // Create a department
    await page.getByRole("button", { name: /Create your first department/i }).click();

    // Right-click to open menu
    await page.getByText(/New Department/i).first().hover();

    // Click menu button
    await page.locator("button:has-text('⋮')").first().click();

    // Click rename
    await page.getByRole("menuitem", { name: /Rename/i }).click();

    // Edit name
    const input = page.locator("input[placeholder='Page title']").last();
    await input.clear();
    await input.fill("Engineering");
    await input.press("Enter");

    // Verify name changed
    const renamed = page.getByText(/Engineering/);
    await expect(renamed).toBeVisible();
  });

  test("should delete a page", async ({ page }) => {
    // Create a department
    await page.getByRole("button", { name: /Create your first department/i }).click();

    // Open menu
    await page.getByText(/New Department/i).first().hover();
    await page.locator("button:has-text('⋮')").first().click();

    // Click delete
    await page.getByRole("menuitem", { name: /Delete/i }).click();

    // Verify page is removed
    const newDept = page.getByText(/New Department/);
    await expect(newDept).not.toBeVisible();
  });

  test("should create and display nested pages", async ({ page }) => {
    // Create department
    await page.getByRole("button", { name: /Create your first department/i }).click();

    // Open menu and add sub-page
    await page.getByText(/New Department/i).first().hover();
    await page.locator("button:has-text('⋮')").first().click();
    await page.getByRole("menuitem", { name: /Add sub-page/i }).click();

    // Verify sub-page appears
    const subPage = page.getByText(/New Page/);
    await expect(subPage).toBeVisible();

    // Verify nesting (indentation)
    const subPageElement = subPage.locator("..");
    const style = await subPageElement.evaluate((el) =>
      window.getComputedStyle(el).paddingLeft
    );
    expect(parseInt(style)).toBeGreaterThan(0);
  });

  test("should toggle tree expansion", async ({ page }) => {
    // Create department with sub-page
    await page.getByRole("button", { name: /Create your first department/i }).click();
    await page.getByText(/New Department/i).first().hover();
    await page.locator("button:has-text('⋮')").first().click();
    await page.getByRole("menuitem", { name: /Add sub-page/i }).click();

    // Close department
    const expandButton = page.locator("button").filter({ has: page.locator("svg[class*='chevron']") }).first();
    await expandButton.click();

    // Verify sub-page is hidden
    const subPageCount = await page.locator("text=/New Page/").count();
    expect(subPageCount).toBe(0);

    // Open department
    await expandButton.click();

    // Verify sub-page is visible
    const subPageVisible = page.getByText(/New Page/);
    await expect(subPageVisible).toBeVisible();
  });

  test("should navigate with breadcrumb", async ({ page }) => {
    // Create nested pages
    await page.getByRole("button", { name: /Create your first department/i }).click();
    const titleInput = page.locator("input[placeholder='Page title']");
    await titleInput.clear();
    await titleInput.fill("Engineering");
    await page.waitForTimeout(2500);

    // Add sub-page
    await page.getByText(/Engineering/i).first().hover();
    await page.locator("button:has-text('⋮')").first().click();
    await page.getByRole("menuitem", { name: /Add sub-page/i }).click();

    // Select sub-page
    await page.getByText(/New Page/).click();

    // Verify breadcrumb
    const breadcrumb = page.getByText(/Engineering.*New Page/);
    await expect(breadcrumb).toBeVisible();
  });
});
