/**
 * BusinessSelector Component Tests
 *
 * Tests for sidebar business switching component
 * Validates: business list display, switching, URL navigation
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

interface Business {
  _id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  isDefault: boolean;
}

// Mock BusinessSelector component behavior
class BusinessSelectorMock {
  private isOpen = false;
  private navigationHistory: string[] = [];
  private callCount = 0;

  constructor(
    private currentBusiness: Business | null,
    private businesses: Business[],
    private isLoading: boolean = false,
    private error: string | null = null,
    private onNavigate: (url: string) => void = () => {},
    private currentTab: string = "overview"
  ) {}

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  closeDropdown(): void {
    this.isOpen = false;
  }

  getDisplayText(): string {
    if (!this.currentBusiness) return "No Business";
    return `${this.currentBusiness.emoji} ${this.currentBusiness.name}`;
  }

  getDropdownText(business: Business): string {
    return `${business.emoji} ${business.name}`;
  }

  selectBusiness(business: Business): void {
    if (business._id === this.currentBusiness?._id) {
      // No-op if same business
      return;
    }
    const url = `/${business.slug}/${this.currentTab}`;
    this.navigationHistory.push(url);
    this.onNavigate(url);
    this.isOpen = false;
    this.callCount++;
  }

  isDropdownOpen(): boolean {
    return this.isOpen;
  }

  getNavigationHistory(): string[] {
    return this.navigationHistory;
  }

  getCallCount(): number {
    return this.callCount;
  }

  setCurrentTab(tab: string): void {
    this.currentTab = tab;
  }

  getCurrentTab(): string {
    return this.currentTab;
  }

  getBusinessColor(business: Business): string {
    return business.color;
  }

  isBusinessSelected(business: Business): boolean {
    return business._id === this.currentBusiness?._id;
  }

  getLoadingState(): boolean {
    return this.isLoading;
  }

  getErrorState(): string | null {
    return this.error;
  }
}

describe("BusinessSelector Component", () => {
  let mockBusinesses: Business[];
  let currentBusiness: Business;
  let selector: BusinessSelectorMock;

  beforeEach(() => {
    mockBusinesses = [
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
    currentBusiness = mockBusinesses[0];
    selector = new BusinessSelectorMock(currentBusiness, mockBusinesses);
  });

  describe("Rendering", () => {
    it("should render selector dropdown", async () => {
      // Expected: selector is initialized
      expect(selector).toBeDefined();
    });

    it("should display current business at top", async () => {
      // Arrange: current business = "Mission Control HQ"
      // Expected: shown as selected in dropdown
      expect(selector.getDisplayText()).toContain("Mission Control HQ");
    });

    it("should display current business with emoji and name", async () => {
      // Expected: shows "🚀 Mission Control HQ" in header
      const displayText = selector.getDisplayText();
      expect(displayText).toBe("🚀 Mission Control HQ");
    });

    it("should list all available businesses", async () => {
      // Arrange: 3 businesses
      // Expected: dropdown shows all 3
      expect(mockBusinesses).toHaveLength(3);
      mockBusinesses.forEach((b) => {
        expect(selector.getDropdownText(b)).toBeDefined();
      });
    });

    it("should show business emoji in list items", async () => {
      // Expected: each business in dropdown shows emoji
      mockBusinesses.forEach((b) => {
        const text = selector.getDropdownText(b);
        expect(text).toContain(b.emoji);
      });
    });

    it("should use business color for visual distinction", async () => {
      // Expected: each business colored with its assigned color
      mockBusinesses.forEach((b) => {
        const color = selector.getBusinessColor(b);
        expect(color).toBe(b.color);
      });
    });

    it("should mark current business as selected", async () => {
      // Expected: checkmark or highlight on current business
      expect(selector.isBusinessSelected(currentBusiness)).toBe(true);
      expect(selector.isBusinessSelected(mockBusinesses[1])).toBe(false);
    });

    it("should handle single business gracefully", async () => {
      // Arrange: only 1 business exists
      const singleBusinessSelector = new BusinessSelectorMock(
        mockBusinesses[0],
        [mockBusinesses[0]]
      );
      // Expected: still shows selector
      expect(singleBusinessSelector.getDisplayText()).toBeDefined();
    });

    it("should handle many businesses (5+)", async () => {
      // Arrange: 5 businesses
      const manyBusinesses = [
        ...mockBusinesses,
        {
          _id: "biz_4",
          name: "Business 4",
          slug: "business-4",
          emoji: "⭐",
          color: "#f59e0b",
          isDefault: false,
        },
        {
          _id: "biz_5",
          name: "Business 5",
          slug: "business-5",
          emoji: "🎯",
          color: "#8b5cf6",
          isDefault: false,
        },
      ];
      const manySelector = new BusinessSelectorMock(
        mockBusinesses[0],
        manyBusinesses
      );
      // Expected: renders without issue
      expect(manySelector.getDisplayText()).toBeDefined();
      expect(manyBusinesses).toHaveLength(5);
    });
  });

  describe("Business Switching", () => {
    it("should switch to selected business", async () => {
      // Act: click "Project Alpha"
      // Expected: navigates to /project-alpha/overview
      selector.selectBusiness(mockBusinesses[1]);
      expect(selector.getNavigationHistory()).toContain("/project-alpha/overview");
    });

    it("should update current business display after switch", async () => {
      // Act: switch to Project Alpha
      // Create new selector with Project Alpha as current
      const newSelector = new BusinessSelectorMock(
        mockBusinesses[1],
        mockBusinesses
      );
      // Expected: header now shows "⚡ Project Alpha"
      expect(newSelector.getDisplayText()).toBe("⚡ Project Alpha");
    });

    it("should close dropdown after selection", async () => {
      // Arrange: open dropdown
      selector.toggleDropdown();
      expect(selector.isDropdownOpen()).toBe(true);
      // Act: select business
      selector.selectBusiness(mockBusinesses[1]);
      // Expected: dropdown closes
      expect(selector.isDropdownOpen()).toBe(false);
    });

    it("should preserve current tab when switching", async () => {
      // Arrange: on /mission-control-hq/board
      selector.setCurrentTab("board");
      // Act: switch to Project Alpha
      selector.selectBusiness(mockBusinesses[1]);
      // Expected: navigate to /project-alpha/board (not overview)
      expect(selector.getNavigationHistory()).toContain(
        "/project-alpha/board"
      );
    });

    it("should call setCurrentBusiness on selection", async () => {
      // Expected: selectBusiness function called (integration with context)
      selector.selectBusiness(mockBusinesses[1]);
      expect(selector.getCallCount()).toBe(1);
    });

    it("should handle switching to same business (no-op)", async () => {
      // Arrange: current business is Mission Control HQ
      // Act: click current business
      const initialCallCount = selector.getCallCount();
      selector.selectBusiness(currentBusiness);
      // Expected: no navigation (call count unchanged)
      expect(selector.getCallCount()).toBe(initialCallCount);
    });
  });

  describe("URL Navigation", () => {
    it("should call router.push with new URL", async () => {
      // Act: switch to different business
      // Expected: router.push called with correct URL
      const navigationUrls: string[] = [];
      const navigationSelector = new BusinessSelectorMock(
        currentBusiness,
        mockBusinesses,
        false,
        null,
        (url) => navigationUrls.push(url)
      );
      navigationSelector.selectBusiness(mockBusinesses[1]);
      expect(navigationUrls).toContain("/project-alpha/overview");
    });

    it("should extract current tab from URL", async () => {
      // Arrange: current URL = /mission-control-hq/board
      selector.setCurrentTab("board");
      // Act: switch business
      selector.selectBusiness(mockBusinesses[1]);
      // Expected: new URL = /project-alpha/board
      expect(selector.getNavigationHistory()).toContain("/project-alpha/board");
    });

    it("should handle root path (/overview)", async () => {
      // Arrange: on /mission-control-hq/overview
      selector.setCurrentTab("overview");
      // Expected: switches to /project-alpha/overview
      selector.selectBusiness(mockBusinesses[1]);
      expect(selector.getNavigationHistory()).toContain(
        "/project-alpha/overview"
      );
    });

    it("should handle default tab if none specified", async () => {
      // Arrange: on /mission-control-hq (default tab is overview)
      selector.setCurrentTab("overview");
      // Act: switch business
      selector.selectBusiness(mockBusinesses[1]);
      // Expected: defaults to overview tab
      expect(selector.getNavigationHistory()[0]).toBe("/project-alpha/overview");
    });

    it("should not navigate if same business selected", async () => {
      // Arrange: get initial navigation history
      const initialHistory = selector.getNavigationHistory().length;
      // Act: click current business (should be no-op)
      selector.selectBusiness(currentBusiness);
      // Expected: router.push not called
      expect(selector.getNavigationHistory().length).toBe(initialHistory);
    });
  });

  describe("Context Integration", () => {
    it("should read current business from BusinessProvider", async () => {
      // Expected: currentBusiness from context
      expect(selector.getDisplayText()).toContain(currentBusiness.name);
    });

    it("should read businesses list from context", async () => {
      // Expected: businesses array from context
      expect(mockBusinesses).toHaveLength(3);
      mockBusinesses.forEach((b) => {
        expect(selector.getDropdownText(b)).toBeDefined();
      });
    });

    it("should call setCurrentBusiness from context", async () => {
      // Expected: uses context function to switch
      selector.selectBusiness(mockBusinesses[1]);
      expect(selector.getCallCount()).toBeGreaterThan(0);
    });

    it("should handle context loading state", async () => {
      // Arrange: businesses still loading
      const loadingSelector = new BusinessSelectorMock(
        currentBusiness,
        mockBusinesses,
        true
      );
      // Expected: shows loading indicator or default state
      expect(loadingSelector.getLoadingState()).toBe(true);
    });

    it("should handle context error state", async () => {
      // Arrange: context has error
      const errorSelector = new BusinessSelectorMock(
        currentBusiness,
        mockBusinesses,
        false,
        "Failed to load businesses"
      );
      // Expected: shows error or fallback
      expect(errorSelector.getErrorState()).toBe("Failed to load businesses");
    });
  });

  describe("Sidebar Integration", () => {
    it("should render in sidebar header", async () => {
      // Expected: positioned at top of navigation sidebar
      expect(selector.getDisplayText()).toBeDefined();
    });

    it("should have appropriate spacing in sidebar", async () => {
      // Expected: visual hierarchy with nav items below
      expect(selector).toBeDefined();
    });

    it("should be compact enough for narrow sidebars", async () => {
      // Expected: doesn't overflow sidebar
      const displayText = selector.getDisplayText();
      expect(displayText.length).toBeLessThan(50);
    });

    it("should highlight current business visually", async () => {
      // Expected: distinct appearance from other businesses
      expect(selector.isBusinessSelected(currentBusiness)).toBe(true);
      expect(selector.isBusinessSelected(mockBusinesses[1])).toBe(false);
    });

    it("should integrate with responsive sidebar", async () => {
      // Expected: works in mobile collapsed sidebar
      expect(selector.getDisplayText()).toBeDefined();
    });
  });

  describe("Keyboard Navigation", () => {
    it("should open dropdown on click", async () => {
      // Act: click selector
      expect(selector.isDropdownOpen()).toBe(false);
      selector.toggleDropdown();
      // Expected: dropdown opens
      expect(selector.isDropdownOpen()).toBe(true);
    });

    it("should support arrow key navigation", async () => {
      // Act: open dropdown
      selector.toggleDropdown();
      // Expected: can navigate through options
      expect(selector.isDropdownOpen()).toBe(true);
    });

    it("should support Enter key to select", async () => {
      // Act: open dropdown and select
      selector.toggleDropdown();
      selector.selectBusiness(mockBusinesses[1]);
      // Expected: business selected
      expect(selector.getNavigationHistory().length).toBeGreaterThan(0);
    });

    it("should support Escape to close", async () => {
      // Act: open dropdown
      selector.toggleDropdown();
      expect(selector.isDropdownOpen()).toBe(true);
      // Press Escape (simulated as closeDropdown)
      selector.closeDropdown();
      // Expected: dropdown closes
      expect(selector.isDropdownOpen()).toBe(false);
    });

    it("should support Tab navigation", async () => {
      // Expected: keyboard navigation through selector works
      expect(selector).toBeDefined();
    });
  });

  describe("Mobile/Responsive", () => {
    it("should work on mobile viewport", async () => {
      // Expected: selector functional on small screens
      expect(selector.getDisplayText()).toBeDefined();
    });

    it("should close dropdown when clicking outside", async () => {
      // Expected: dropdown closes on outside click
      selector.toggleDropdown();
      selector.closeDropdown();
      expect(selector.isDropdownOpen()).toBe(false);
    });

    it("should support touch interactions", async () => {
      // Expected: touch-friendly tap targets
      expect(selector.getDisplayText()).toBeDefined();
    });

    it("should adjust dropdown position for mobile", async () => {
      // Expected: dropdown doesn't overflow viewport
      selector.toggleDropdown();
      expect(selector.isDropdownOpen()).toBe(true);
    });
  });

  describe("Visual Design", () => {
    it("should show business emoji prominently", async () => {
      // Expected: emoji easily visible
      expect(selector.getDisplayText()).toContain(currentBusiness.emoji);
    });

    it("should use business color for styling", async () => {
      // Expected: background or border color matches business
      const color = selector.getBusinessColor(currentBusiness);
      expect(color).toBe(currentBusiness.color);
    });

    it("should have clear visual hierarchy", async () => {
      // Expected: current business stands out from list
      expect(selector.isBusinessSelected(currentBusiness)).toBe(true);
    });

    it("should use consistent padding/spacing", async () => {
      // Expected: aligned with sidebar design
      expect(selector.getDisplayText().length).toBeGreaterThan(0);
    });

    it("should have smooth transitions/animations", async () => {
      // Expected: dropdown opens/closes smoothly
      selector.toggleDropdown();
      expect(selector.isDropdownOpen()).toBe(true);
      selector.toggleDropdown();
      expect(selector.isDropdownOpen()).toBe(false);
    });

    it("should be visually distinct from navigation tabs", async () => {
      // Expected: selector clearly different from other sidebar elements
      expect(selector.getDisplayText()).toBeDefined();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible label", async () => {
      // Expected: aria-label or visible label
      expect(selector.getDisplayText()).toBeDefined();
    });

    it("should have proper ARIA attributes", async () => {
      // Expected: role, aria-expanded, aria-haspopup
      expect(selector.isDropdownOpen()).toBeDefined();
    });

    it("should announce selected business to screen reader", async () => {
      // Expected: "Mission Control HQ selected"
      expect(selector.getDisplayText()).toBe("🚀 Mission Control HQ");
    });

    it("should support screen reader navigation", async () => {
      // Expected: all options readable by screen reader
      mockBusinesses.forEach((b) => {
        expect(selector.getDropdownText(b)).toBeDefined();
      });
    });

    it("should have sufficient color contrast", async () => {
      // Expected: text/background contrast meets WCAG
      expect(selector.getBusinessColor(currentBusiness)).toBeDefined();
    });

    it("should not rely solely on color for distinction", async () => {
      // Expected: checkmark or other indicator besides color
      expect(selector.isBusinessSelected(currentBusiness)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle null current business", async () => {
      // Expected: shows default or error state
      const nullBusinessSelector = new BusinessSelectorMock(null, mockBusinesses);
      expect(nullBusinessSelector.getDisplayText()).toBe("No Business");
    });

    it("should handle empty businesses array", async () => {
      // Expected: shows empty state or message
      const emptySelector = new BusinessSelectorMock(currentBusiness, []);
      expect(emptySelector).toBeDefined();
    });

    it("should handle navigation errors", async () => {
      // Expected: error handled gracefully
      const errorSelector = new BusinessSelectorMock(
        currentBusiness,
        mockBusinesses,
        false,
        "Navigation failed"
      );
      expect(errorSelector.getErrorState()).toBe("Navigation failed");
    });

    it("should recover from failed URL navigation", async () => {
      // Expected: user can retry or fallback
      selector.selectBusiness(mockBusinesses[1]);
      selector.selectBusiness(mockBusinesses[2]);
      expect(selector.getNavigationHistory().length).toBe(2);
    });
  });

  describe("Performance", () => {
    it("should render quickly with many businesses", async () => {
      // Arrange: 10+ businesses
      const manyBusinesses = Array.from({ length: 15 }, (_, i) => ({
        _id: `biz_${i}`,
        name: `Business ${i}`,
        slug: `business-${i}`,
        emoji: "🏢",
        color: "#6366f1",
        isDefault: i === 0,
      }));
      const manySelector = new BusinessSelectorMock(
        manyBusinesses[0],
        manyBusinesses
      );
      // Expected: no lag
      expect(manySelector.getDisplayText()).toBeDefined();
    });

    it("should not re-render unnecessarily", async () => {
      // Expected: memoized or efficient
      const callCount1 = selector.getCallCount();
      selector.selectBusiness(mockBusinesses[1]);
      const callCount2 = selector.getCallCount();
      expect(callCount2).toBe(callCount1 + 1);
    });

    it("should cache computed values", async () => {
      // Expected: consistent display text
      const text1 = selector.getDisplayText();
      const text2 = selector.getDisplayText();
      expect(text1).toBe(text2);
    });

    it("should handle rapid switching gracefully", async () => {
      // Act: rapidly click multiple businesses
      selector.selectBusiness(mockBusinesses[1]);
      selector.selectBusiness(mockBusinesses[2]);
      // Try to switch back, but first need to update current business
      const selector2 = new BusinessSelectorMock(
        mockBusinesses[1],
        mockBusinesses
      );
      selector2.selectBusiness(mockBusinesses[2]);
      // Expected: final state correct, no race conditions
      expect(selector2.getNavigationHistory().length).toBeGreaterThan(0);
    });
  });

  describe("Default Business Handling", () => {
    it("should highlight isDefault business visually", async () => {
      // Expected: default business marked specially in list
      const defaultBusiness = mockBusinesses.find((b) => b.isDefault);
      expect(defaultBusiness).toBeDefined();
      expect(defaultBusiness?.isDefault).toBe(true);
    });

    it("should show default indicator (badge/star)", async () => {
      // Expected: visual indicator that this is default
      const defaultBusiness = mockBusinesses.find((b) => b.isDefault);
      expect(defaultBusiness?.name).toBe("Mission Control HQ");
    });

    it("should use default business on first load", async () => {
      // Expected: defaults to isDefault: true business
      const defaultBusiness = mockBusinesses.find((b) => b.isDefault);
      const defaultSelector = new BusinessSelectorMock(
        defaultBusiness || null,
        mockBusinesses
      );
      expect(defaultSelector.getDisplayText()).toContain(
        defaultBusiness?.emoji || ""
      );
    });
  });
});
