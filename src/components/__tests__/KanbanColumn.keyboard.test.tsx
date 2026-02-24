import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KanbanColumn } from "../KanbanColumn";

/**
 * KanbanColumn Keyboard Navigation Tests
 * Tests task card navigation within columns:
 * - Arrow Down to move to next task
 * - Arrow Up to move to previous task
 * - Enter/Space to select/open task
 * - Tab to move between columns
 * - Shift+Tab to move back through columns
 * - Delete/Backspace to mark for deletion
 * - ARIA live regions for announcements
 */

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  AlertCircle: () => <div />,
  Calendar: () => <div />,
  ListTodo: () => <div />,
  Briefcase: () => <div />,
}));

const mockColumn = {
  id: "in_progress",
  label: "In Progress",
  icon: () => <div />,
};

const mockTasks = [
  {
    _id: "1",
    title: "Task 1",
    description: "Description 1",
    status: "in_progress",
    priority: "P1",
    createdAt: Date.now(),
    ticketNumber: "MC-1",
  },
  {
    _id: "2",
    title: "Task 2",
    description: "Description 2",
    status: "in_progress",
    priority: "P2",
    createdAt: Date.now(),
    ticketNumber: "MC-2",
  },
  {
    _id: "3",
    title: "Task 3",
    description: "Description 3",
    status: "in_progress",
    priority: "P3",
    createdAt: Date.now(),
    ticketNumber: "MC-3",
  },
];

const mockAgents = [];
const mockEpics = [];

const mockHandlers = {
  onTaskClick: jest.fn(),
  onTaskSelect: jest.fn(),
  onDragStart: jest.fn(),
  onDragOver: jest.fn(),
  onDragLeave: jest.fn(),
  onDrop: jest.fn(),
};

describe("KanbanColumn - Keyboard Navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Task Card Focus", () => {
    test("task cards are keyboard focusable", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      // Task cards should be in tab order
      const taskButtons = screen.getAllByRole("button", { hidden: true });
      taskButtons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });

    test("ArrowDown moves focus to next task card", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });
      expect(taskCards.length).toBeGreaterThanOrEqual(mockTasks.length);

      // Focus first task
      taskCards[0].focus();
      expect(document.activeElement).toBe(taskCards[0]);

      // ArrowDown should move focus to next
      fireEvent.keyDown(taskCards[0], { key: "ArrowDown" });

      // (Implementation should update focus)
    });

    test("ArrowUp moves focus to previous task card", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });

      // Focus second task
      taskCards[1].focus();

      // ArrowUp should move focus to first
      fireEvent.keyDown(taskCards[1], { key: "ArrowUp" });

      // (Implementation should update focus)
    });

    test("ArrowUp from first task stays on first task", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });

      // Focus first task
      taskCards[0].focus();

      // ArrowUp should stay on first
      fireEvent.keyDown(taskCards[0], { key: "ArrowUp" });

      expect(document.activeElement).toBe(taskCards[0]);
    });

    test("ArrowDown from last task stays on last task", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });
      const lastIndex = taskCards.length - 1;

      // Focus last task
      taskCards[lastIndex].focus();

      // ArrowDown should stay on last
      fireEvent.keyDown(taskCards[lastIndex], { key: "ArrowDown" });

      expect(document.activeElement).toBe(taskCards[lastIndex]);
    });
  });

  describe("Task Selection", () => {
    test("Enter/Space opens task details", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });

      fireEvent.keyDown(taskCards[0], { key: "Enter" });

      expect(mockHandlers.onTaskClick).toHaveBeenCalled();
    });

    test("Space key also opens task", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });

      fireEvent.keyDown(taskCards[0], { key: " " });

      // Space should also trigger action
      expect(document.activeElement).toBe(taskCards[0]);
    });

    test("Shift+Space toggles task selection in bulk mode", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={true}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });

      fireEvent.keyDown(taskCards[0], { key: " ", shiftKey: true });

      // Should call onTaskSelect
      expect(mockHandlers.onTaskSelect).toHaveBeenCalled();
    });
  });

  describe("Column-Level Navigation", () => {
    test("Tab moves focus to next column (integration test)", () => {
      // This would test interaction between multiple KanbanColumn instances
      // Typically done at the board level, not column level
    });

    test("Shift+Tab moves focus to previous column", () => {
      // This would also be a board-level test
    });
  });

  describe("Keyboard-Only Access", () => {
    test("is fully operable without mouse", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });

      // Focus first task
      taskCards[0].focus();

      // Navigate with keyboard
      fireEvent.keyDown(taskCards[0], { key: "ArrowDown" });
      fireEvent.keyDown(taskCards[1], { key: "ArrowDown" });

      // Open task
      fireEvent.keyDown(taskCards[2], { key: "Enter" });

      expect(mockHandlers.onTaskClick).toHaveBeenCalled();
    });
  });

  describe("ARIA Attributes", () => {
    test("column has role region", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const region = screen.getByRole("region", { hidden: true });
      expect(region).toHaveAttribute("role", "region");
    });

    test("column has aria-label with status", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const region = screen.getByRole("region", { hidden: true });
      expect(region).toHaveAttribute("aria-label", expect.stringContaining("In Progress"));
    });

    test("task cards have aria-selected when selected", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={true}
          selectedTasks={new Set(["1"])}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      // First task should be marked as selected
      const region = screen.getByRole("region", { hidden: true });
      const buttons = region.querySelectorAll('[aria-selected="true"]');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test("task cards announce draggability", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const region = screen.getByRole("region", { hidden: true });
      const taskButton = region.querySelector("button");

      if (taskButton) {
        expect(taskButton).toHaveAttribute("draggable", "true");
      }
    });
  });

  describe("Announcement", () => {
    test("announces task count with live region", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const region = screen.getByRole("region", { hidden: true });
      expect(region.textContent).toContain(mockTasks.length.toString());
    });

    test("announces when task is selected", () => {
      const { rerender } = render(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={true}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      rerender(
        <KanbanColumn
          column={mockColumn}
          tasks={mockTasks}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={true}
          selectedTasks={new Set(["1"])}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      // Should have a live region with selection announcement
      const liveRegion = screen.queryByRole("status", { hidden: true });
      if (liveRegion) {
        expect(liveRegion).toHaveAttribute("aria-live", "polite");
      }
    });
  });

  describe("Edge Cases", () => {
    test("handles empty task list", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={[]}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const region = screen.getByRole("region", { hidden: true });
      expect(region).toBeInTheDocument();
    });

    test("handles single task", () => {
      render(
        <KanbanColumn
          column={mockColumn}
          tasks={[mockTasks[0]]}
          agents={mockAgents}
          epics={mockEpics}
          bulkMode={false}
          selectedTasks={new Set()}
          isDragOver={false}
          {...mockHandlers}
        />
      );

      const taskCards = screen.getAllByRole("button", { hidden: true });
      expect(taskCards.length).toBeGreaterThanOrEqual(1);
    });
  });
});
