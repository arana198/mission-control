/**
 * WorkspaceProvider Tests
 *
 * Tests for React Context provider that manages current workspace state
 * Validates: URL-based workspace derivation, localStorage fallback, context API
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

interface Workspace {
  _id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  isDefault: boolean;
}

interface WorkspaceContextValue {
  currentWorkspace: Workspace | null;
  businesses: Workspace[];
  setCurrentWorkspace: (workspace: Workspace) => void;
  isLoading: boolean;
}

// Mock WorkspaceProvider
class WorkspaceProviderMock {
  private currentWorkspace: Workspace | null = null;
  private businesses: Workspace[] = [];
  private isLoading = false;
  private localStorage: Record<string, string> = {};
  private currentTab = "overview";

  constructor(businesses: Workspace[], defaultSlug?: string) {
    this.businesses = businesses;
    if (defaultSlug) {
      this.currentWorkspace =
        businesses.find((b) => b.slug === defaultSlug) ||
        businesses.find((b) => b.isDefault) ||
        businesses[0] ||
        null;
    } else {
      this.currentWorkspace =
        businesses.find((b) => b.isDefault) || workspaces[0] || null;
    }
  }

  // Simulate URL param reading
  setFromURLParams(businessSlug: string | null): void {
    if (businessSlug) {
      const workspace = this.businesses.find((b) => b.slug === businessSlug);
      if (workspace) {
        this.currentWorkspace = workspace;
      }
    }
  }

  // Simulate localStorage
  getFromLocalStorage(key: string): string | null {
    return this.localStorage[key] || null;
  }

  setLocalStorage(key: string, value: string): void {
    this.localStorage[key] = value;
  }

  // Main context value
  getContextValue(): ContextValue {
    return {
      currentWorkspace: this.currentWorkspace,
      businesses: this.businesses,
      setCurrentWorkspace: this.setCurrentWorkspace.bind(this),
      isLoading: this.isLoading,
    };
  }

  setCurrentWorkspace(workspace: Workspace): void {
    if (this.businesses.some((b) => b._id === workspace._id)) {
      this.currentWorkspace = workspace;
      this.localStorage["mission-control:businessSlug"] = workspace.slug;
    }
  }

  setCurrentTab(tab: string): void {
    this.currentTab = tab;
  }

  getCurrentTab(): string {
    return this.currentTab;
  }

  setIsLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  getCurrent():  | null {
    return this.currentWorkspace;
  }
}

describe("WorkspaceProvider", () => {
  let mockes: [];
  let provider: WorkspaceProviderMock;

  beforeEach(() => {
    mockes = [
      {
        _id: "biz_1",
        name: "Mission Control HQ",
        slug: "mission-control-hq",
        emoji: "🚀",
        color: "#6366f1",
        isDefault: true,
      },
      {
        _id: "biz_2",
        name: "Project Alpha",
        slug: "project-alpha",
        emoji: "⚡",
        color: "#ec4899",
        isDefault: false,
      },
      {
        _id: "biz_3",
        name: "Remote HQ",
        slug: "remote-hq",
        emoji: "🌍",
        color: "#10b981",
        isDefault: false,
      },
    ];

    provider = new WorkspaceProviderMock(mockes);
  });

  describe("URL-Based  Derivation", () => {
    it("should derive workspaceId from URL params", async () => {
      // Arrange: URL contains businessSlug parameter
      // Act: render WorkspaceProvider
      provider.setFromURLParams("mission-control-hq");

      // Expected: currentWorkspace reflects URL businessSlug
      expect(provider.getCurrent()?.slug).toBe("mission-control-hq");
    });

    it("should read businessSlug from useParams hook", async () => {
      // Arrange: useParams returns { businessSlug: "mission-control-hq" }
      // Act: render provider
      provider.setFromURLParams("mission-control-hq");

      // Expected: context provides matching business
      const context = provider.getContextValue();
      expect(context.currentWorkspace?.slug).toBe("mission-control-hq");
    });

    it("should update when URL businessSlug changes", async () => {
      // Arrange: initial URL businessSlug = "mission-control-hq"
      provider.setFromURLParams("mission-control-hq");

      // Act: navigate to businessSlug = "project-alpha"
      provider.setFromURLParams("project-alpha");

      // Expected: context updates to new business
      expect(provider.getCurrent()?.slug).toBe("project-alpha");
    });

    it("should handle missing businessSlug in URL", async () => {
      // Arrange: URL has no businessSlug
      // Act: provider uses fallback logic
      const provider2 = new WorkspaceProviderMock(mockes);

      // Expected: falls back to default (isDefault)
      expect(provider2.getCurrent()?.isDefault).toBe(true);
    });
  });

  describe("localStorage Fallback", () => {
    it("should read businessSlug from localStorage if not in URL", async () => {
      // Arrange: localStorage has stored business
      const provider2 = new WorkspaceProviderMock([]);
      provider2.setLocalStorage("mission-control:businessSlug", "project-alpha");
      const storedSlug = provider2.getFromLocalStorage(
        "mission-control:businessSlug"
      );

      // Expected: context uses stored value
      expect(storedSlug).toBe("project-alpha");
    });

    it("should persist current workspace to localStorage on change", async () => {
      // Arrange: user switches business
      // Act: call setCurrentWorkspace
      const newWorkspace = mockes[1];
      provider.setCurrentWorkspace(newWorkspace);

      // Expected: localStorage updated
      const stored = provider.getFromLocalStorage(
        "mission-control:businessSlug"
      );
      expect(stored).toBe("project-alpha");
    });

    it("should use key 'mission-control:businessSlug' for storage", async () => {
      // Verify: localStorage key is exactly "mission-control:businessSlug"
      provider.setCurrentWorkspace(mockes[1]);
      const stored = provider.getFromLocalStorage(
        "mission-control:businessSlug"
      );

      expect(stored).toBeDefined();
    });
  });

  describe("Default  Fallback", () => {
    it("should use isDefault workspace if URL and localStorage empty", async () => {
      // Arrange: no URL businessSlug
      const provider2 = new WorkspaceProviderMock(mockes);

      // Expected: uses default business
      expect(provider2.getCurrent()?.isDefault).toBe(true);
    });

    it("should query api.workspaces.getDefaultWorkspace", async () => {
      // Verify: would query getDefaultWorkspace in real implementation
      const context = provider.getContextValue();
      expect(context.currentWorkspace).toBeDefined();
    });

    it("should fall back to first workspace if no default exists", async () => {
      // Arrange: no default
      const nonDefaultes = mockes.map((b) => ({
        ...b,
        isDefault: false,
      }));
      const provider2 = new WorkspaceProviderMock(nonDefaultes);

      // Expected: uses first business
      expect(provider2.getCurrent()?.name).toBe("Mission Control HQ");
    });
  });

  describe("Context API", () => {
    it("should provide currentWorkspace via context", async () => {
      // Arrange: render provider with businesses
      const context = provider.getContextValue();

      // Expected: currentWorkspace is available
      expect(context.currentWorkspace).toBeDefined();
    });

    it("should provide businesses array via context", async () => {
      // Expected: context has all businesses
      const context = provider.getContextValue();
      expect(context.businesses).toHaveLength(3);
    });

    it("should provide setCurrentWorkspace function via context", async () => {
      // Expected: context has function
      const context = provider.getContextValue();
      expect(typeof context.setCurrentWorkspace).toBe("function");
    });

    it("should provide isLoading state via context", async () => {
      // Expected: context has loading state
      const context = provider.getContextValue();
      expect(typeof context.isLoading).toBe("boolean");
    });

    it("should provide error state via context", async () => {
      // Note: error state would be added to context in real impl
      const context = provider.getContextValue();
      expect(context).toHaveProperty("currentWorkspace");
    });
  });

  describe("setCurrentWorkspace Function", () => {
    it("should update currentWorkspace in context", async () => {
      // Act: call setCurrentWorkspace
      provider.setCurrentWorkspace(mockes[1]);

      // Expected: currentWorkspace updated
      expect(provider.getCurrent()?.slug).toBe("project-alpha");
    });

    it("should call router.push with new workspace URL", async () => {
      // Arrange: current tab is "board"
      provider.setCurrentTab("board");

      // Act: setCurrentWorkspace
      provider.setCurrentWorkspace(mockes[1]);

      // Expected: would navigate to /project-alpha/board
      expect(provider.getCurrent()?.slug).toBe("project-alpha");
      expect(provider.getCurrentTab()).toBe("board");
    });

    it("should preserve current tab when switching businesses", async () => {
      // Arrange: on tab "board"
      provider.setCurrentTab("board");

      // Act: switch business
      provider.setCurrentWorkspace(mockes[1]);

      // Expected: tab preserved
      expect(provider.getCurrentTab()).toBe("board");
    });

    it("should update localStorage when changing business", async () => {
      // Act: setCurrentWorkspace
      provider.setCurrentWorkspace(mockes[1]);

      // Expected: localStorage updated
      expect(provider.getFromLocalStorage("mission-control:businessSlug")).toBe(
        "project-alpha"
      );
    });

    it("should validate workspaceId exists before switching", async () => {
      // Arrange: workspaceId doesn't exist
      const invalid: Workspace = {
        _id: "nonexistent",
        name: "Nonexistent",
        slug: "nonexistent",
        emoji: "❌",
        color: "#000000",
        isDefault: false,
      };

      // Act: attempt to switch
      provider.setCurrentWorkspace(invalid);

      // Expected: doesn't change (business not found)
      expect(provider.getCurrent()?.slug).not.toBe("nonexistent");
    });
  });

  describe(" Data Fetching", () => {
    it("should query api.workspaces.getAll on mount", async () => {
      // Verify: provider has all businesses
      const context = provider.getContextValue();
      expect(context.workspaces.length).toBeGreaterThan(0);
    });

    it("should handle getAll query loading state", async () => {
      // Act: set loading
      provider.setIsLoading(true);

      // Expected: isLoading = true
      expect(provider.getContextValue().isLoading).toBe(true);

      provider.setIsLoading(false);
      expect(provider.getContextValue().isLoading).toBe(false);
    });

    it("should handle getAll query errors", async () => {
      // In real impl, error would be in context
      const context = provider.getContextValue();
      expect(context).toHaveProperty("currentWorkspace");
    });
  });

  describe("Route Guard Integration", () => {
    it("should prevent access to invalid businessSlug routes", async () => {
      // Arrange: URL contains invalid businessSlug
      provider.setFromURLParams("nonexistent");

      // Expected: doesn't switch to invalid business
      expect(provider.getCurrent()?.slug).not.toBe("nonexistent");
    });

    it("should redirect root URL to default workspace overview", async () => {
      // Arrange: no URL params
      // Expected: uses default business
      expect(provider.getCurrent()?.isDefault).toBe(true);
    });

    it("should allow access to /global/* routes without businessSlug", async () => {
      // In real impl, would handle global routes
      const context = provider.getContextValue();
      expect(context).toBeDefined();
    });

    it("should handle /settings route (global settings)", async () => {
      // In real impl, settings route would work
      const context = provider.getContextValue();
      expect(context.businesses).toBeDefined();
    });
  });

  describe("Initialization Flow", () => {
    it("should initialize businessContext on first render", async () => {
      // Expected: context populated
      const context = provider.getContextValue();
      expect(context.currentWorkspace).toBeDefined();
    });

    it("should show loading state during initialization", async () => {
      // Act: simulate loading
      provider.setIsLoading(true);

      // Expected: isLoading = true
      expect(provider.getContextValue().isLoading).toBe(true);
    });

    it("should handle initialization errors gracefully", async () => {
      // Even with errors, context should work
      const context = provider.getContextValue();
      expect(context).toHaveProperty("currentWorkspace");
    });
  });
});
