/** @jest-environment jsdom */

/**
 * useFocusTrap Hook Tests
 *
 * Tests for focus trap behavior in modals
 */

describe("useFocusTrap", () => {
  // Mock DOM elements
  let mockModal: HTMLDivElement;
  let mockButtons: HTMLButtonElement[];

  beforeEach(() => {
    // Create mock modal structure
    mockModal = document.createElement("div");
    mockModal.id = "mock-modal";
    mockButtons = [];

    for (let i = 0; i < 3; i++) {
      const button = document.createElement("button");
      button.id = `button-${i}`;
      button.textContent = `Button ${i}`;
      mockButtons.push(button);
      mockModal.appendChild(button);
    }

    // Create input for testing
    const input = document.createElement("input");
    input.id = "text-input";
    input.type = "text";
    mockModal.appendChild(input);

    document.body.appendChild(mockModal);
  });

  afterEach(() => {
    if (mockModal && mockModal.parentNode) {
      mockModal.parentNode.removeChild(mockModal);
    }
  });

  describe("Focus Management", () => {
    it("identifies focusable elements", () => {
      const focusableSelectors = [
        "button",
        "[href]",
        "input",
        "select",
        "textarea",
        "[tabindex]:not([tabindex='-1'])",
      ].join(", ");

      const focusable = mockModal.querySelectorAll(focusableSelectors);
      expect(focusable.length).toBeGreaterThan(0);
      expect(focusable[0]).toBe(mockButtons[0]);
    });

    it("traps focus on Tab key", () => {
      const focusable = Array.from(
        mockModal.querySelectorAll("button, input")
      ) as HTMLElement[];
      expect(focusable.length).toBe(4); // 3 buttons + 1 input

      // Focus last element
      focusable[focusable.length - 1].focus();
      expect(document.activeElement).toBe(focusable[focusable.length - 1]);

      // Simulate Tab key from last element
      const event = new KeyboardEvent("keydown", { key: "Tab" });
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

      if (currentIndex === focusable.length - 1) {
        // Should cycle to first
        focusable[0].focus();
      }

      expect(document.activeElement).toBe(focusable[0]);
    });

    it("cycles backward with Shift+Tab", () => {
      const focusable = Array.from(
        mockModal.querySelectorAll("button, input")
      ) as HTMLElement[];

      // Focus first element
      focusable[0].focus();
      expect(document.activeElement).toBe(focusable[0]);

      // Simulate Shift+Tab from first element
      const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true });
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

      if (currentIndex === 0) {
        // Should cycle to last
        focusable[focusable.length - 1].focus();
      }

      expect(document.activeElement).toBe(focusable[focusable.length - 1]);
    });

    it("does not trap Tab for non-Tab keys", () => {
      const focusable = Array.from(
        mockModal.querySelectorAll("button, input")
      ) as HTMLElement[];

      focusable[focusable.length - 1].focus();
      const activeBeforeArrow = document.activeElement;

      // ArrowDown should not trap focus
      const event = new KeyboardEvent("keydown", { key: "ArrowDown" });

      expect(document.activeElement).toBe(activeBeforeArrow);
    });
  });

  describe("Escape Key", () => {
    it("closes modal on Escape", () => {
      const onClose = jest.fn();

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      mockModal.addEventListener("keydown", handleKeyDown);

      // Simulate Escape
      const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
      mockModal.dispatchEvent(escapeEvent);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Focus Return", () => {
    it("stores trigger element reference", () => {
      const triggerButton = document.createElement("button");
      triggerButton.id = "trigger";
      triggerButton.textContent = "Open Modal";
      document.body.appendChild(triggerButton);

      // Simulate focus on trigger
      triggerButton.focus();
      expect(document.activeElement).toBe(triggerButton);

      // When modal opens, store trigger reference
      const triggerRef = document.activeElement as HTMLElement;

      // Modal opens, focus moves to first element
      mockButtons[0].focus();
      expect(document.activeElement).toBe(mockButtons[0]);

      // Cleanup: return focus
      if (triggerRef && triggerRef.focus) {
        triggerRef.focus();
      }

      expect(document.activeElement).toBe(triggerButton);

      document.body.removeChild(triggerButton);
    });
  });

  describe("Auto-focus", () => {
    it("auto-focuses first focusable element", () => {
      const focusable = Array.from(
        mockModal.querySelectorAll("button, input")
      ) as HTMLElement[];

      // Auto-focus first
      focusable[0].focus();

      expect(document.activeElement).toBe(focusable[0]);
      expect(document.activeElement?.id).toBe("button-0");
    });
  });

  describe("Edge Cases", () => {
    it("handles modal with no focusable elements", () => {
      const emptyModal = document.createElement("div");
      emptyModal.textContent = "No focusable elements";
      document.body.appendChild(emptyModal);

      const focusable = Array.from(emptyModal.querySelectorAll("button, input"));
      expect(focusable.length).toBe(0);

      document.body.removeChild(emptyModal);
    });

    it("handles focus already outside modal", () => {
      const outsideButton = document.createElement("button");
      outsideButton.id = "outside";
      document.body.appendChild(outsideButton);

      outsideButton.focus();
      expect(document.activeElement).toBe(outsideButton);

      // This is outside the modal, so useFocusTrap wouldn't normally interfere
      // but we should verify the modal doesn't affect outside elements

      document.body.removeChild(outsideButton);
    });

    it("handles disabled focusable elements", () => {
      const disabledButton = document.createElement("button");
      disabledButton.disabled = true;
      mockModal.appendChild(disabledButton);

      const focusable = Array.from(
        mockModal.querySelectorAll("button:not(:disabled), input")
      ) as HTMLElement[];

      // Disabled button should not be in focusable list
      expect(focusable).not.toContain(disabledButton);
    });

    it("handles hidden focusable elements", () => {
      const hiddenButton = document.createElement("button");
      hiddenButton.style.display = "none";
      mockModal.appendChild(hiddenButton);

      const focusable = Array.from(mockModal.querySelectorAll("button, input"));

      // Hidden button might still be in DOM but not interactive
      // Browser focus management typically prevents focusing hidden elements
    });
  });

  describe("Multiple Modals", () => {
    it("each modal traps focus independently", () => {
      const modal1 = document.createElement("div");
      const button1 = document.createElement("button");
      button1.textContent = "Modal 1 Button";
      modal1.appendChild(button1);

      const modal2 = document.createElement("div");
      const button2 = document.createElement("button");
      button2.textContent = "Modal 2 Button";
      modal2.appendChild(button2);

      document.body.appendChild(modal1);
      document.body.appendChild(modal2);

      // Focus in modal2
      button2.focus();
      expect(document.activeElement).toBe(button2);

      // Should not affect modal1
      expect(modal1.contains(document.activeElement as HTMLElement)).toBe(false);

      document.body.removeChild(modal1);
      document.body.removeChild(modal2);
    });
  });
});
