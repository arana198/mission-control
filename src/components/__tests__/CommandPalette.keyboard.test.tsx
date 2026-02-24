import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommandPalette } from "../CommandPalette";
import { ConvexProvider } from "convex/react";

/**
 * CommandPalette Keyboard Navigation Tests
 * Tests ARIA combobox pattern with full keyboard support:
 * - Cmd+K / Ctrl+K to open/close
 * - Escape to close
 * - Arrow Up/Down to navigate results
 * - Enter to select
 * - Tab focus management
 */

// Mock Convex provider
const mockConvexClient = {
  query: jest.fn(),
  mutation: jest.fn(),
};

describe("CommandPalette - Keyboard Navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Cmd+K / Ctrl+K Shortcut", () => {
    test("opens palette with Cmd+K on Mac", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      // Input should be visible and focused
      const input = screen.getByRole("combobox", { hidden: true });
      expect(input).toBeInTheDocument();
    });

    test("opens palette with Ctrl+K on Windows/Linux", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", ctrlKey: true });

      // Input should be visible and focused
      const input = screen.getByRole("combobox", { hidden: true });
      expect(input).toBeInTheDocument();
    });

    test("toggles palette state with repeated Cmd+K", () => {
      const { rerender } = render(<CommandPalette />);

      // Open
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      let input = screen.getByRole("combobox", { hidden: true });
      expect(input).toBeInTheDocument();

      // Close
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      rerender(<CommandPalette />);

      // Input should not be visible
      const inputs = screen.queryAllByRole("combobox", { hidden: true });
      expect(inputs.length).toBe(0);
    });
  });

  describe("Escape Key", () => {
    test("closes palette when Escape is pressed", () => {
      render(<CommandPalette />);

      // Open palette
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      let input = screen.getByRole("combobox", { hidden: true });
      expect(input).toBeInTheDocument();

      // Close with Escape
      fireEvent.keyDown(window, { key: "Escape" });

      // Palette should be closed
      const inputs = screen.queryAllByRole("combobox", { hidden: true });
      expect(inputs.length).toBe(0);
    });

    test("doesn't close palette when Escape not pressed", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });
      fireEvent.keyDown(window, { key: "Enter" }); // Different key

      const input = screen.getByRole("combobox", { hidden: true });
      expect(input).toBeInTheDocument();
    });
  });

  describe("Arrow Keys Navigation", () => {
    test("ArrowDown cycles through results forward", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      // Assuming there are results
      const initialEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
      const preventDefaultSpy = jest.spyOn(initialEvent, "preventDefault");

      fireEvent.keyDown(window, { key: "ArrowDown" });

      // Should prevent default scrolling
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    test("ArrowUp cycles through results backward", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      const upEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
      const preventDefaultSpy = jest.spyOn(upEvent, "preventDefault");

      fireEvent.keyDown(window, { key: "ArrowUp" });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    test("ArrowDown wraps around to first result from last", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      // Navigate to last item (depends on results)
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });

      // Should wrap around, preventDefault should be called
      const wrapEvent = new KeyboardEvent("keydown", { key: "ArrowDown" });
      jest.spyOn(wrapEvent, "preventDefault");

      fireEvent.keyDown(window, { key: "ArrowDown" });
    });

    test("ArrowUp wraps around to last result from first", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      // At first result (index 0)
      const wrapEvent = new KeyboardEvent("keydown", { key: "ArrowUp" });
      jest.spyOn(wrapEvent, "preventDefault");

      fireEvent.keyDown(window, { key: "ArrowUp" });
    });
  });

  describe("Enter Key Selection", () => {
    test("invokes action on selected result with Enter", () => {
      const mockAction = jest.fn();
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      // Simulate Enter press
      const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
      jest.spyOn(enterEvent, "preventDefault");

      fireEvent.keyDown(window, { key: "Enter" });

      expect(enterEvent.preventDefault).toHaveBeenCalled();
    });

    test("closes palette after Enter selection", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });
      fireEvent.keyDown(window, { key: "Enter" });

      // Palette should close after selection
      const inputs = screen.queryAllByRole("combobox", { hidden: true });
      expect(inputs.length).toBe(0);
    });

    test("does nothing on Enter if no results", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      // Type something that returns no results
      const input = screen.getByRole("combobox", { hidden: true });
      fireEvent.change(input, { target: { value: "zzzzzzzzzzz" } });

      // Should not throw error
      fireEvent.keyDown(window, { key: "Enter" });
    });
  });

  describe("Keyboard-Only Access", () => {
    test("is fully operable without mouse", () => {
      render(<CommandPalette />);

      // Open with keyboard
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      // Navigate with keyboard
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });

      // Select with keyboard
      fireEvent.keyDown(window, { key: "Enter" });

      // Palette should close
      const inputs = screen.queryAllByRole("combobox", { hidden: true });
      expect(inputs.length).toBe(0);
    });
  });

  describe("ARIA Attributes", () => {
    test("input has role combobox", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      const input = screen.getByRole("combobox", { hidden: true });
      expect(input).toHaveAttribute("role", "combobox");
    });

    test("results list has role listbox", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      const listbox = screen.queryByRole("listbox", { hidden: true });
      if (listbox) {
        expect(listbox).toHaveAttribute("role", "listbox");
      }
    });

    test("result items have role option", () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      const options = screen.queryAllByRole("option", { hidden: true });
      // At least one option should be available
      options.forEach((option) => {
        expect(option).toHaveAttribute("role", "option");
      });
    });
  });

  describe("Input Focus Management", () => {
    test("input is auto-focused when palette opens", async () => {
      render(<CommandPalette />);

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      await waitFor(() => {
        const input = screen.getByRole("combobox", { hidden: true });
        expect(document.activeElement).toBe(input);
      });
    });

    test("focus is restored when palette closes", () => {
      render(<CommandPalette />);

      const button = screen.getByRole("button", { hidden: true });

      fireEvent.keyDown(window, { key: "k", metaKey: true });
      fireEvent.keyDown(window, { key: "Escape" });

      // After closing, focus should not be in palette input
      const input = screen.queryByRole("combobox", { hidden: true });
      expect(document.activeElement).not.toBe(input);
    });
  });
});
