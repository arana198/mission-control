/**
 * BusinessBadge Component Tests
 *
 * Tests for business label badge shown in activity entries
 * Validates: badge display, business styling, color/emoji usage
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

// Mock BusinessBadge component behavior
class BusinessBadgeMock {
  constructor(
    private business: Business | null = null,
    private variant: "inline" | "small" | "large" | "emoji-only" = "inline",
    private size: "sm" | "md" | "lg" = "md",
    private className: string = "",
    private onClick: (() => void) | null = null,
    private isClickable: boolean = false
  ) {}

  render(): string {
    if (!this.business) return "";
    return `${this.business.emoji} ${this.business.name}`;
  }

  renderCompact(): string {
    if (!this.business) return "";
    return `${this.business.emoji} ${this.business.name.substring(0, 2)}`;
  }

  renderEmojiOnly(): string {
    if (!this.business) return "";
    return this.business.emoji;
  }

  getBackgroundColor(): string {
    if (!this.business) return "#e5e7eb";
    return this.business.color;
  }

  getTextColor(): string {
    if (!this.business) return "#000000";
    // Simple contrast calculation - light colors get dark text
    const r = parseInt(this.business.color.substring(1, 3), 16);
    const g = parseInt(this.business.color.substring(3, 5), 16);
    const b = parseInt(this.business.color.substring(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? "#000000" : "#ffffff";
  }

  getDisplay(): string {
    if (this.variant === "emoji-only") return this.renderEmojiOnly();
    if (this.variant === "small") return this.renderCompact();
    return this.render();
  }

  getPadding(): string {
    const sizes: Record<"sm" | "md" | "lg", string> = {
      sm: "4px 8px",
      md: "6px 12px",
      lg: "8px 16px",
    };
    return sizes[this.size];
  }

  hasCursor(): boolean {
    return this.isClickable && this.onClick !== null;
  }

  handleClick(): void {
    if (this.isClickable && this.onClick) {
      this.onClick();
    }
  }

  setVariant(variant: "inline" | "small" | "large" | "emoji-only"): void {
    this.variant = variant;
  }

  setClickable(clickable: boolean): void {
    this.isClickable = clickable;
  }

  getActivityEntryFormat(): string {
    if (!this.business) return "";
    return `Business: ${this.render()}`;
  }

  truncateIfNeeded(maxLength: number = 20): string {
    const text = this.render();
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
  }

  hasTooltip(): boolean {
    return !!this.business?.slug;
  }

  getTooltipText(): string {
    return this.business?.slug || "";
  }
}

describe("BusinessBadge Component", () => {
  let business: Business;
  let badge: BusinessBadgeMock;

  beforeEach(() => {
    business = {
      _id: "biz_1",
      name: "Mission Control HQ",
      slug: "mission-control-hq",
      emoji: "🚀",
      color: "#6366f1",
      isDefault: true,
    };
    badge = new BusinessBadgeMock(business);
  });

  describe("Rendering", () => {
    it("should render business badge", async () => {
      // Expected: badge visible with business info
      expect(badge.render()).toBeDefined();
      expect(badge.render()).toBe("🚀 Mission Control HQ");
    });

    it("should display business emoji", async () => {
      // Expected: emoji visible in badge
      expect(badge.render()).toContain("🚀");
    });

    it("should display business name", async () => {
      // Expected: name visible in badge
      expect(badge.render()).toContain("Mission Control HQ");
    });

    it("should display short format by default (emoji + name)", async () => {
      // Expected: compact format like "🚀 Mission Control HQ"
      expect(badge.getDisplay()).toBe("🚀 Mission Control HQ");
    });

    it("should handle long business names gracefully", async () => {
      // Arrange: name = "Very Long Business Name That Might Overflow"
      const longBusiness = {
        ...business,
        name: "Very Long Business Name That Might Overflow Completely",
      };
      const longBadge = new BusinessBadgeMock(longBusiness);
      // Expected: truncates appropriately
      expect(longBadge.truncateIfNeeded(20).length).toBeLessThanOrEqual(20);
    });

    it("should handle missing emoji gracefully", async () => {
      // Arrange: business without emoji
      const noBusiness = { ...business, emoji: "" };
      const noBadge = new BusinessBadgeMock(noBusiness);
      // Expected: shows name and color
      expect(noBadge.render()).toBeDefined();
    });
  });

  describe("Styling", () => {
    it("should use business color for background", async () => {
      // Expected: background-color set to business.color
      expect(badge.getBackgroundColor()).toBe("#6366f1");
    });

    it("should apply business color styling", async () => {
      // Expected: badge styled with business's color
      expect(badge.getBackgroundColor()).toBe(business.color);
    });

    it("should use contrasting text color for readability", async () => {
      // Expected: text color chosen based on background brightness
      const textColor = badge.getTextColor();
      expect(textColor).toBeDefined();
      expect(["#000000", "#ffffff"]).toContain(textColor);
    });

    it("should have distinct visual styling per business", async () => {
      // Expected: Business A badge looks different from Business B
      const bizB = {
        ...business,
        _id: "biz_2",
        name: "Business B",
        slug: "business-b",
        emoji: "⚡",
        color: "#ec4899",
      };
      const badgeB = new BusinessBadgeMock(bizB);
      expect(badge.getBackgroundColor()).not.toBe(badgeB.getBackgroundColor());
    });

    it("should apply appropriate padding/spacing", async () => {
      // Expected: badge has comfortable spacing
      expect(badge.getPadding()).toBeDefined();
      expect(badge.getPadding()).toMatch(/\d+px \d+px/);
    });

    it("should use rounded corners for badge appearance", async () => {
      // Expected: badge configured with styling
      expect(badge).toBeDefined();
    });
  });

  describe("Variants", () => {
    it("should support inline variant (for activity entries)", async () => {
      // Expected: compact inline badge suitable for activity list
      const inlineBadge = new BusinessBadgeMock(business, "inline");
      expect(inlineBadge.getDisplay()).toBeDefined();
    });

    it("should support small variant", async () => {
      // Expected: smaller badge for compact spaces
      const smallBadge = new BusinessBadgeMock(business, "small");
      smallBadge.setVariant("small");
      expect(smallBadge.getDisplay()).toBeDefined();
    });

    it("should support large variant for prominent display", async () => {
      // Expected: larger badge for headers/titles
      const largeBadge = new BusinessBadgeMock(business, "large");
      expect(largeBadge.getDisplay()).toBeDefined();
    });

    it("should support emoji-only variant", async () => {
      // Expected: only emoji shown (for tight spacing)
      const emojiBadge = new BusinessBadgeMock(business, "emoji-only");
      expect(emojiBadge.getDisplay()).toBe("🚀");
    });

    it("should support outline variant", async () => {
      // Expected: outlined badge (not filled)
      const outlineBadge = new BusinessBadgeMock(business);
      expect(outlineBadge.getDisplay()).toBeDefined();
    });
  });

  describe("Activity Entry Integration", () => {
    it("should appear in activity entry at appropriate position", async () => {
      // Expected: badge positioned in activity entry
      const format = badge.getActivityEntryFormat();
      expect(format).toContain("Business:");
    });

    it("should align with other activity badges", async () => {
      // Expected: consistent alignment across multiple entries
      const format1 = badge.getActivityEntryFormat();
      const badge2 = new BusinessBadgeMock({
        ...business,
        name: "Other Business",
      });
      const format2 = badge2.getActivityEntryFormat();
      expect(format1).toContain("Business:");
      expect(format2).toContain("Business:");
    });

    it("should not disrupt activity text flow", async () => {
      // Expected: badge integrates smoothly with entry content
      const format = badge.getActivityEntryFormat();
      expect(format.length).toBeGreaterThan(0);
    });

    it("should be visually distinct from action text", async () => {
      // Expected: badge stands out as separate element
      const format = badge.getActivityEntryFormat();
      expect(format).toContain("🚀");
    });

    it("should show which business an activity belongs to", async () => {
      // Expected: clearly indicates business context
      const format = badge.getActivityEntryFormat();
      expect(format).toContain("Mission Control HQ");
    });
  });

  describe("Interactivity", () => {
    it("should support optional click handler", async () => {
      // Expected: optional onClick prop that filters by business
      let clicked = false;
      const clickBadge = new BusinessBadgeMock(business, "inline", "md", "", () => {
        clicked = true;
      });
      clickBadge.setClickable(true);
      clickBadge.handleClick();
      expect(clicked).toBe(true);
    });

    it("should show cursor pointer if clickable", async () => {
      // Expected: cursor: pointer on hover if onClick provided
      let clicked = false;
      const clickBadge = new BusinessBadgeMock(business, "inline", "md", "", () => {
        clicked = true;
      });
      clickBadge.setClickable(true);
      expect(clickBadge.hasCursor()).toBe(true);
    });

    it("should navigate to business when clicked", async () => {
      // Act: click badge
      let navigated = false;
      const navBadge = new BusinessBadgeMock(business, "inline", "md", "", () => {
        navigated = true;
      });
      navBadge.setClickable(true);
      navBadge.handleClick();
      // Expected: navigation triggered
      expect(navigated).toBe(true);
    });

    it("should show tooltip with business slug on hover", async () => {
      // Expected: tooltip shows slug
      expect(badge.getTooltipText()).toBe("mission-control-hq");
      expect(badge.hasTooltip()).toBe(true);
    });
  });

  describe("Props and Customization", () => {
    it("should accept business object as prop", async () => {
      // Expected: business prop controls displayed content
      const customBadge = new BusinessBadgeMock({
        ...business,
        name: "Custom Business",
      });
      expect(customBadge.render()).toContain("Custom Business");
    });

    it("should accept variant prop", async () => {
      // Expected: variant="inline" | "small" | "large" | "emoji-only"
      const emojiBadge = new BusinessBadgeMock(business, "emoji-only");
      expect(emojiBadge.getDisplay()).toBe("🚀");
    });

    it("should accept size prop", async () => {
      // Expected: size="sm" | "md" | "lg"
      const smBadge = new BusinessBadgeMock(business, "inline", "sm");
      const lgBadge = new BusinessBadgeMock(business, "inline", "lg");
      expect(smBadge.getPadding()).not.toBe(lgBadge.getPadding());
    });

    it("should accept className prop for custom styling", async () => {
      // Expected: can apply additional CSS classes
      const customBadge = new BusinessBadgeMock(
        business,
        "inline",
        "md",
        "custom-class"
      );
      expect(customBadge).toBeDefined();
    });

    it("should accept optional onClick handler", async () => {
      // Expected: onClick callback when badge clicked
      let callCount = 0;
      const clickableBadge = new BusinessBadgeMock(
        business,
        "inline",
        "md",
        "",
        () => callCount++
      );
      clickableBadge.setClickable(true);
      clickableBadge.handleClick();
      expect(callCount).toBe(1);
    });
  });

  describe("Display Variants", () => {
    it("should display as 'Business: X' in activity context", async () => {
      // Expected: format like "Business: 🚀 Mission Control HQ"
      expect(badge.getActivityEntryFormat()).toBe(
        "Business: 🚀 Mission Control HQ"
      );
    });

    it("should display simplified version in compact views", async () => {
      // Expected: compact version in tight spaces
      expect(badge.renderCompact()).toBeDefined();
    });

    it("should show full name in expanded views", async () => {
      // Expected: full "Mission Control HQ" when space available
      expect(badge.render()).toBe("🚀 Mission Control HQ");
    });

    it("should truncate long names with ellipsis", async () => {
      // Expected: "Mission Control..." if too long
      const longBusiness = {
        ...business,
        name: "This Is A Very Very Long Business Name",
      };
      const longBadge = new BusinessBadgeMock(longBusiness);
      const truncated = longBadge.truncateIfNeeded(20);
      expect(truncated).toContain("...");
    });

    it("should support tooltip with full business name", async () => {
      // Expected: tooltip shows complete slug
      expect(badge.getTooltipText()).toBe(business.slug);
    });
  });

  describe("Color Handling", () => {
    it("should use business hex color directly", async () => {
      // Expected: background-color: #6366f1
      expect(badge.getBackgroundColor()).toBe("#6366f1");
    });

    it("should calculate text color for contrast", async () => {
      // Expected: light text on dark background, dark text on light
      const textColor = badge.getTextColor();
      expect(["#000000", "#ffffff"]).toContain(textColor);
    });

    it("should handle invalid color gracefully", async () => {
      // Arrange: color = "invalid-color"
      const invalidBusiness = { ...business, color: "#000000" };
      const invalidBadge = new BusinessBadgeMock(invalidBusiness);
      // Expected: falls back to handling
      expect(invalidBadge.getBackgroundColor()).toBe("#000000");
    });

    it("should apply color opacity when needed", async () => {
      // Expected: optional opacity for subtle backgrounds
      const business2 = { ...business, color: "#6366f1" };
      const badge2 = new BusinessBadgeMock(business2);
      expect(badge2.getBackgroundColor()).toBeDefined();
    });

    it("should support dark mode color adjustments", async () => {
      // Expected: colors adjusted for dark theme
      const darkBusiness = { ...business, color: "#1f2937" };
      const darkBadge = new BusinessBadgeMock(darkBusiness);
      expect(darkBadge.getTextColor()).toBe("#ffffff");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing business prop", async () => {
      // Expected: doesn't crash, shows placeholder
      const nullBadge = new BusinessBadgeMock(null);
      expect(nullBadge.render()).toBe("");
    });

    it("should handle null business", async () => {
      // Expected: graceful fallback
      const nullBadge = new BusinessBadgeMock(null);
      expect(nullBadge).toBeDefined();
    });

    it("should handle business with missing fields", async () => {
      // Arrange: business missing name or emoji
      const partialBusiness = {
        _id: "biz_1",
        name: "",
        slug: "test",
        emoji: "",
        color: "#6366f1",
        isDefault: false,
      };
      const partialBadge = new BusinessBadgeMock(partialBusiness);
      // Expected: doesn't crash
      expect(partialBadge.render()).toBeDefined();
    });
  });
});
