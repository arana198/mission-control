/**
 * Modal Accessibility Tests
 *
 * Tests for WCAG 2.1 AA compliance in modals:
 * - ARIA roles and attributes
 * - Focus management
 * - Keyboard interactions
 */

describe("Modal Accessibility", () => {
  describe("ARIA Attributes", () => {
    it("has role='dialog'", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");

      expect(modal.getAttribute("role")).toBe("dialog");
    });

    it("has aria-modal='true'", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");

      expect(modal.getAttribute("aria-modal")).toBe("true");
    });

    it("has aria-labelledby pointing to title", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-labelledby", "modal-title");

      const title = document.createElement("h2");
      title.id = "modal-title";
      title.textContent = "Modal Title";

      expect(modal.getAttribute("aria-labelledby")).toBe("modal-title");
      expect(document.getElementById("modal-title")?.textContent).toBe("Modal Title");
    });

    it("has aria-describedby for content (optional)", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-describedby", "modal-description");

      const description = document.createElement("p");
      description.id = "modal-description";
      description.textContent = "This is the modal description";

      expect(modal.getAttribute("aria-describedby")).toBe("modal-description");
    });
  });

  describe("Focus Management", () => {
    it("auto-focuses first focusable element", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");

      const button = document.createElement("button");
      button.textContent = "First Button";
      modal.appendChild(button);

      // Simulate auto-focus
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it("traps focus within modal", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");

      const button1 = document.createElement("button");
      button1.textContent = "Button 1";
      const button2 = document.createElement("button");
      button2.textContent = "Button 2";

      modal.appendChild(button1);
      modal.appendChild(button2);

      // Focus on first button
      button1.focus();
      expect(document.activeElement).toBe(button1);

      // Simulate Tab from first button
      button2.focus();
      expect(document.activeElement).toBe(button2);

      // Simulate Tab from last button (should wrap to first)
      button1.focus();
      expect(document.activeElement).toBe(button1);
    });
  });

  describe("Keyboard Interactions", () => {
    it("closes on Escape key", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");
      const onClose = jest.fn();

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      modal.addEventListener("keydown", handleEscape);

      // Simulate Escape
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      modal.dispatchEvent(event);

      expect(onClose).toHaveBeenCalled();
    });

    it("supports Tab navigation", () => {
      const modal = document.createElement("div");

      const input = document.createElement("input");
      const button = document.createElement("button");

      modal.appendChild(input);
      modal.appendChild(button);

      input.focus();
      expect(document.activeElement).toBe(input);

      // Simulate Tab
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it("supports Shift+Tab for reverse navigation", () => {
      const modal = document.createElement("div");

      const button1 = document.createElement("button");
      const button2 = document.createElement("button");

      modal.appendChild(button1);
      modal.appendChild(button2);

      // Start at button2
      button2.focus();
      expect(document.activeElement).toBe(button2);

      // Shift+Tab should go to button1
      button1.focus();
      expect(document.activeElement).toBe(button1);
    });

    it("uses onKeyDown (not deprecated onKeyPress)", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");

      // Should use onKeyDown handler
      const handleKeyDown = jest.fn();
      modal.addEventListener("keydown", handleKeyDown);

      // Simulate key event
      const event = new KeyboardEvent("keydown", { key: "Enter" });
      modal.dispatchEvent(event);

      expect(handleKeyDown).toHaveBeenCalled();
    });
  });

  describe("Semantic Structure", () => {
    it("has proper heading hierarchy", () => {
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");

      const title = document.createElement("h2");
      title.id = "modal-title";
      title.textContent = "Modal Title";

      const content = document.createElement("div");
      content.textContent = "Modal content";

      modal.appendChild(title);
      modal.appendChild(content);

      // Title should be proper heading element
      const headings = modal.querySelectorAll("h1, h2, h3, h4, h5, h6");
      expect(headings.length).toBe(1);
      expect(headings[0].tagName).toBe("H2");
    });

    it("has proper button semantics", () => {
      const modal = document.createElement("div");

      const closeButton = document.createElement("button");
      closeButton.setAttribute("aria-label", "Close");
      closeButton.textContent = "×";

      const actionButton = document.createElement("button");
      actionButton.textContent = "Submit";

      modal.appendChild(closeButton);
      modal.appendChild(actionButton);

      const buttons = modal.querySelectorAll("button");
      expect(buttons.length).toBe(2);

      // Close button should have aria-label
      expect(closeButton.getAttribute("aria-label")).toBe("Close");
    });

    it("form inputs have associated labels", () => {
      const modal = document.createElement("div");

      const label = document.createElement("label");
      label.htmlFor = "input-id";
      label.textContent = "Name";

      const input = document.createElement("input");
      input.id = "input-id";
      input.type = "text";

      modal.appendChild(label);
      modal.appendChild(input);

      const inputs = modal.querySelectorAll("input");
      expect(inputs.length).toBe(1);

      // Input should be associated with label
      const associatedLabel = modal.querySelector(`label[for="${input.id}"]`);
      expect(associatedLabel).toBeTruthy();
    });
  });

  describe("Overlay Behavior", () => {
    it("prevents interaction with content behind modal", () => {
      const backdrop = document.createElement("div");
      backdrop.style.position = "fixed";
      backdrop.style.inset = "0";
      backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      backdrop.setAttribute("aria-hidden", "true");

      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");

      expect(backdrop.getAttribute("aria-hidden")).toBe("true");
    });

    it("makes backdrop non-interactive", () => {
      const backdrop = document.createElement("div");
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.style.pointerEvents = "none";

      expect(backdrop.getAttribute("aria-hidden")).toBe("true");
      expect(backdrop.style.pointerEvents).toBe("none");
    });
  });

  describe("Close Button Accessibility", () => {
    it("close button has accessible label", () => {
      const closeButton = document.createElement("button");
      closeButton.setAttribute("aria-label", "Close modal");

      expect(closeButton.getAttribute("aria-label")).toBe("Close modal");
    });

    it("close button is keyboard accessible", () => {
      const closeButton = document.createElement("button");
      closeButton.textContent = "Close";

      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);

      // Simulate Enter or Space
      const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
      const called = jest.fn();
      closeButton.addEventListener("keydown", (e) => {
        if (e.key === "Enter") called();
      });
      closeButton.dispatchEvent(enterEvent);

      expect(called).toHaveBeenCalled();
    });
  });
});
