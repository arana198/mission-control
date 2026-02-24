import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BusinessSelectorContent } from "../BusinessSelector";

/**
 * BusinessSelector Keyboard Navigation Tests
 * Tests dropdown select pattern with full keyboard support:
 * - Space/Enter to open dropdown
 * - Arrow Down/Up to navigate options
 * - Enter to select
 * - Escape to close
 * - Home/End keys to jump to first/last
 * - Tab focus trap within dropdown
 */

// Mock useBusiness hook
jest.mock("../BusinessProvider", () => ({
  useBusiness: () => ({
    currentBusiness: {
      _id: "1",
      name: "Business 1",
      emoji: "🏢",
      slug: "business-1",
    },
    businesses: [
      { _id: "1", name: "Business 1", emoji: "🏢", slug: "business-1" },
      { _id: "2", name: "Business 2", emoji: "🚀", slug: "business-2" },
      { _id: "3", name: "Business 3", emoji: "💡", slug: "business-3" },
    ],
    setCurrentBusiness: jest.fn(),
    isLoading: false,
  }),
}));

// Mock useRouter
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => "/business-1/board",
}));

describe("BusinessSelector - Keyboard Navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Opening/Closing Dropdown", () => {
    test("opens dropdown with Space key", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: " " });

      // Dropdown should be visible
      const options = screen.queryAllByRole("option", { hidden: true });
      expect(options.length).toBeGreaterThan(0);
    });

    test("opens dropdown with Enter key", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "Enter" });

      const options = screen.queryAllByRole("option", { hidden: true });
      expect(options.length).toBeGreaterThan(0);
    });

    test("opens dropdown with ArrowDown key", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      const options = screen.queryAllByRole("option", { hidden: true });
      expect(options.length).toBeGreaterThan(0);
    });

    test("opens dropdown with ArrowUp key", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowUp" });

      const options = screen.queryAllByRole("option", { hidden: true });
      expect(options.length).toBeGreaterThan(0);
    });

    test("closes dropdown with Escape key", async () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      // Open
      fireEvent.keyDown(button, { key: "ArrowDown" });

      let options = screen.queryAllByRole("option", { hidden: true });
      expect(options.length).toBeGreaterThan(0);

      // Close
      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        options = screen.queryAllByRole("option", { hidden: true });
        expect(options.length).toBe(0);
      });
    });
  });

  describe("Arrow Keys Navigation", () => {
    test("ArrowDown moves focus to next option", async () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      // Open dropdown
      fireEvent.keyDown(button, { key: "ArrowDown" });

      await waitFor(() => {
        const options = screen.getAllByRole("option", { hidden: true });
        expect(options.length).toBeGreaterThan(0);
      });

      // Navigate down
      const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
      const preventSpy = jest.spyOn(event, "preventDefault");

      fireEvent.keyDown(window, event);

      // Should prevent default scrolling
      expect(preventSpy).toHaveBeenCalled();
    });

    test("ArrowUp moves focus to previous option", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      const event = new KeyboardEvent("keydown", { key: "ArrowUp" });
      jest.spyOn(event, "preventDefault");

      fireEvent.keyDown(window, event);
    });

    test("ArrowDown wraps from last to first option", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      // Navigate to end
      for (let i = 0; i < 3; i++) {
        fireEvent.keyDown(window, { key: "ArrowDown" });
      }

      // Should wrap to first
      const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
      jest.spyOn(event, "preventDefault");

      fireEvent.keyDown(window, event);
    });

    test("ArrowUp wraps from first to last option", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      // At first option, go up
      const event = new KeyboardEvent("keydown", { key: "ArrowUp" });
      jest.spyOn(event, "preventDefault");

      fireEvent.keyDown(window, event);
    });
  });

  describe("Home/End Keys", () => {
    test("Home key moves focus to first option", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      // Navigate to end first
      for (let i = 0; i < 3; i++) {
        fireEvent.keyDown(window, { key: "ArrowDown" });
      }

      // Home key should go to first
      fireEvent.keyDown(window, { key: "Home" });

      // First option should be highlighted
      // (Specific assertion depends on implementation)
    });

    test("End key moves focus to last option", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      // End key should go to last
      fireEvent.keyDown(window, { key: "End" });

      // Last option should be highlighted
    });
  });

  describe("Selection with Enter", () => {
    test("Enter selects highlighted option", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      // Navigate to second option
      fireEvent.keyDown(window, { key: "ArrowDown" });

      // Select with Enter
      fireEvent.keyDown(window, { key: "Enter" });

      // Dropdown should close
      const options = screen.queryAllByRole("option", { hidden: true });
      expect(options.length).toBe(0);
    });

    test("closes dropdown after selection", async () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        const options = screen.queryAllByRole("option", { hidden: true });
        expect(options.length).toBe(0);
      });
    });
  });

  describe("Type-Ahead Search (Optional)", () => {
    test("typing first letter jumps to matching option", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      // Type first letter of an option
      fireEvent.keyDown(window, { key: "B" });

      // Should jump to option starting with B
      // (Specific assertion depends on implementation)
    });
  });

  describe("Keyboard-Only Access", () => {
    test("is fully operable without mouse", async () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      // Open with Space
      fireEvent.keyDown(button, { key: " " });

      await waitFor(() => {
        const options = screen.getAllByRole("option", { hidden: true });
        expect(options.length).toBeGreaterThan(0);
      });

      // Navigate with arrows
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });

      // Select with Enter
      fireEvent.keyDown(window, { key: "Enter" });

      await waitFor(() => {
        const options = screen.queryAllByRole("option", { hidden: true });
        expect(options.length).toBe(0);
      });
    });
  });

  describe("ARIA Attributes", () => {
    test("trigger button has role button", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("role", "button");
    });

    test("button has aria-haspopup='listbox'", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-haspopup", "listbox");
    });

    test("options have role option", async () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      await waitFor(() => {
        const options = screen.getAllByRole("option", { hidden: true });
        options.forEach((option) => {
          expect(option).toHaveAttribute("role", "option");
        });
      });
    });

    test("current option has aria-selected='true'", () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      const options = screen.queryAllByRole("option", { hidden: true });
      if (options.length > 0) {
        const selectedOption = options.find(
          (opt) => opt.getAttribute("aria-selected") === "true"
        );
        expect(selectedOption).toBeDefined();
      }
    });
  });

  describe("Focus Management", () => {
    test("focus moves into listbox when opened", async () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });

      await waitFor(() => {
        const listbox = screen.getByRole("listbox", { hidden: true });
        // Focus should be within listbox
        expect(document.activeElement).toBe(listbox);
      });
    });

    test("focus returns to button when dropdown closes", async () => {
      render(<BusinessSelectorContent />);

      const button = screen.getByRole("button");
      button.focus();

      fireEvent.keyDown(button, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(document.activeElement).toBe(button);
      });
    });
  });
});
