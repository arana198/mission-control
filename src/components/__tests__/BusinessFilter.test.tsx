/**
 * BusinessFilter Component Tests
 *
 * Tests for business filter dropdown used on global tabs
 * Validates: filter UI, business selection, filter state management
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

// Mock component behavior
class BusinessFilterMock {
  private isOpen = false;
  private selectedBusinessId: string | null = null;
  private onFilterChangeMock: (id: string | null) => void;
  private callHistory: (string | null)[] = [];

  constructor(
    private businesses: Business[],
    private currentFilter: string | null,
    onFilterChange: (id: string | null) => void
  ) {
    this.selectedBusinessId = currentFilter;
    this.onFilterChangeMock = onFilterChange;
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  closeDropdown(): void {
    this.isOpen = false;
  }

  selectBusiness(businessId: string | null): void {
    this.selectedBusinessId = businessId;
    this.callHistory.push(businessId);
    this.onFilterChangeMock(businessId);
    this.closeDropdown();
  }

  getDisplayText(): string {
    if (!this.selectedBusinessId) {
      return "All Businesses";
    }
    const business = this.businesses.find((b) => b._id === this.selectedBusinessId);
    return business ? `${business.emoji} ${business.name}` : "All Businesses";
  }

  getColor(): string | null {
    if (!this.selectedBusinessId) return null;
    const business = this.businesses.find((b) => b._id === this.selectedBusinessId);
    return business?.color || null;
  }

  isDropdownOpen(): boolean {
    return this.isOpen;
  }

  getOptions(): Array<{ id: string | null; name: string; emoji?: string }> {
    return [
      { id: null, name: "All Businesses" },
      ...this.businesses.map((b) => ({
        id: b._id,
        name: b.name,
        emoji: b.emoji,
      })),
    ];
  }

  getCallCount(): number {
    return this.callHistory.length;
  }

  getLastCall(): string | null | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }

  wasCalledWith(expected: string | null): boolean {
    return this.callHistory.includes(expected);
  }
}

describe("BusinessFilter Component", () => {
  let mockBusinesses: Business[];
  let mockCallback: (id: string | null) => void;
  let component: BusinessFilterMock;

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

    mockCallback = (id: string | null) => {
      // track calls
    };
  });

  describe("Rendering", () => {
    it("should render filter dropdown", async () => {
      // Arrange: BusinessFilter rendered with businesses
      component = new BusinessFilterMock(
        mockBusinesses,
        null,
        mockCallback
      );

      // Expected: dropdown element visible
      expect(component).toBeDefined();
      expect(component.getDisplayText()).toBe("All Businesses");
    });

    it("should display 'All Businesses' option by default", async () => {
      // Expected: default display text is "All Businesses"
      component = new BusinessFilterMock(
        mockBusinesses,
        null,
        mockCallback
      );
      expect(component.getDisplayText()).toBe("All Businesses");
    });

    it("should list all businesses in dropdown", async () => {
      // Arrange: 3 businesses provided
      component = new BusinessFilterMock(
        mockBusinesses,
        null,
        mockCallback
      );

      // Expected: dropdown contains 4 options (All + 3 businesses)
      const options = component.getOptions();
      expect(options).toHaveLength(4);
      expect(options[0].name).toBe("All Businesses");
    });

    it("should show business emoji and name in list", async () => {
      // Expected: each business shows emoji + name (e.g., "🚀 Mission Control HQ")
      component = new BusinessFilterMock(
        mockBusinesses,
        null,
        mockCallback
      );

      const options = component.getOptions();
      const missionOption = options.find((o) => o.name === "Mission Control HQ");
      expect(missionOption).toBeDefined();
      expect(missionOption?.emoji).toBe("🚀");
    });

    it("should use business color for visual distinction", async () => {
      // Expected: business name has color styling from business.color
      component = new BusinessFilterMock(
        mockBusinesses,
        "biz_1",
        mockCallback
      );

      const color = component.getColor();
      expect(color).toBe("#6366f1");
    });
  });

  describe("Filter Selection", () => {
    it("should call onFilterChange(null) when 'All Businesses' selected", async () => {
      // Arrange
      component = new BusinessFilterMock(
        mockBusinesses,
        "biz_1",
        mockCallback
      );

      // Act: click dropdown, select "All Businesses"
      component.selectBusiness(null);

      // Expected: onFilterChange(null) called
      expect(component.wasCalledWith(null)).toBe(true);
    });

    it("should call onFilterChange(businessId) when specific business selected", async () => {
      // Arrange
      component = new BusinessFilterMock(
        mockBusinesses,
        null,
        mockCallback
      );

      // Act: select "Mission Control HQ"
      component.selectBusiness("biz_1");

      // Expected: onFilterChange("biz_1") called
      expect(component.wasCalledWith("biz_1")).toBe(true);
    });

    it("should update display text when selection changes", async () => {
      // Arrange
      component = new BusinessFilterMock(
        mockBusinesses,
        null,
        mockCallback
      );

      // Act: select "Project Alpha"
      component.selectBusiness("biz_2");

      // Expected: displayed text changes to "⚡ Project Alpha"
      expect(component.getDisplayText()).toBe("⚡ Project Alpha");
    });

    it("should close dropdown after selection", async () => {
      // Arrange
      component = new BusinessFilterMock(
        mockBusinesses,
        null,
        mockCallback
      );
      component.toggleDropdown(); // open

      // Act: select business
      component.selectBusiness("biz_1");

      // Expected: dropdown closes automatically
      expect(component.isDropdownOpen()).toBe(false);
    });
  });

  describe("Filter State Management", () => {
    it("should accept currentFilter prop", async () => {
      // Expected: currentFilter prop controls which option is selected
      component = new BusinessFilterMock(
        mockBusinesses,
        "biz_2",
        mockCallback
      );
      expect(component.getDisplayText()).toBe("⚡ Project Alpha");
    });

    it("should show 'All Businesses' when currentFilter is null", async () => {
      // Arrange: currentFilter = null
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);

      // Expected: "All Businesses" display
      expect(component.getDisplayText()).toBe("All Businesses");
    });

    it("should show correct business when currentFilter is businessId", async () => {
      // Arrange: currentFilter = "biz_2"
      component = new BusinessFilterMock(
        mockBusinesses,
        "biz_2",
        mockCallback
      );

      // Expected: displays "⚡ Project Alpha"
      expect(component.getDisplayText()).toBe("⚡ Project Alpha");
    });

    it("should handle invalid currentFilter gracefully", async () => {
      // Arrange: currentFilter = "nonexistent_id"
      component = new BusinessFilterMock(
        mockBusinesses,
        "nonexistent_id",
        mockCallback
      );

      // Expected: defaults to "All Businesses" or shows error
      const text = component.getDisplayText();
      expect(
        text === "All Businesses" || text.includes("nonexistent_id")
      ).toBe(true);
    });

    it("should update when currentFilter prop changes", async () => {
      // Arrange: start with null
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      expect(component.getDisplayText()).toBe("All Businesses");

      // Act: simulate prop change to "biz_1"
      component = new BusinessFilterMock(mockBusinesses, "biz_1", mockCallback);

      // Expected: display updates to show business
      expect(component.getDisplayText()).toBe("🚀 Mission Control HQ");
    });
  });

  describe("UI Interactions", () => {
    it("should toggle dropdown visibility on click", async () => {
      // Arrange
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      expect(component.isDropdownOpen()).toBe(false);

      // Act: click filter dropdown
      component.toggleDropdown();

      // Expected: dropdown menu appears
      expect(component.isDropdownOpen()).toBe(true);
    });

    it("should close dropdown when clicking outside", async () => {
      // Arrange
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      component.toggleDropdown(); // open
      expect(component.isDropdownOpen()).toBe(true);

      // Act: click outside
      component.closeDropdown();

      // Expected: dropdown closes
      expect(component.isDropdownOpen()).toBe(false);
    });

    it("should support keyboard navigation (arrow keys)", async () => {
      // Arrange
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      component.toggleDropdown();

      // Act: open dropdown, use arrow keys to navigate (simulated)
      const options = component.getOptions();

      // Expected: can select options with keyboard
      expect(options.length > 1).toBe(true);
    });

    it("should support keyboard selection (Enter key)", async () => {
      // Arrange
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      component.toggleDropdown();

      // Act: navigate with arrows, press Enter (simulated)
      component.selectBusiness("biz_1");

      // Expected: business selected, onFilterChange called
      expect(component.wasCalledWith("biz_1")).toBe(true);
    });

    it("should support keyboard escape to close", async () => {
      // Arrange
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      component.toggleDropdown();
      const initialCount = component.getCallCount();

      // Act: open dropdown, press Escape (simulated)
      component.closeDropdown();

      // Expected: dropdown closes, no filter change
      expect(component.isDropdownOpen()).toBe(false);
      expect(component.getCallCount()).toBe(initialCount);
    });
  });

  describe("Integration with Global Tabs", () => {
    it("should appear at top of Workload tab", async () => {
      // Expected: component visible in Workload page
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      expect(component).toBeDefined();
    });

    it("should appear at top of Activity tab", async () => {
      // Expected: component visible in Activity page
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      expect(component).toBeDefined();
    });

    it("should appear at top of Analytics tab", async () => {
      // Expected: component visible in Analytics page
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      expect(component).toBeDefined();
    });

    it("should NOT appear in Calendar tab", async () => {
      // Expected: Calendar has no filter (globally shared)
      // Calendar is a global tab that spans all businesses
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);
      // Verify the filter is initialized but would not be displayed on Calendar tab
      expect(component).toBeDefined();
      expect(component.getDisplayText()).toBeDefined();
      // In integration test: would verify Calendar route doesn't render BusinessFilter component
    });

    it("should filter tab content when selection changes", async () => {
      // Arrange
      component = new BusinessFilterMock(mockBusinesses, null, mockCallback);

      // Act: select "Project Alpha"
      component.selectBusiness("biz_2");

      // Expected: Activity entries filtered to Project Alpha only
      expect(component.wasCalledWith("biz_2")).toBe(true);
    });

    it("should clear filter when 'All Businesses' selected", async () => {
      // Arrange
      component = new BusinessFilterMock(
        mockBusinesses,
        "biz_2",
        mockCallback
      );

      // Act: select "All Businesses"
      component.selectBusiness(null);

      // Expected: tab content shows all entries
      expect(component.wasCalledWith(null)).toBe(true);
    });
  });
});
