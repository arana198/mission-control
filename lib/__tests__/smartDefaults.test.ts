import {
  extractPriorityFromText,
  detectEpicFromTitle,
  findLeastLoadedAgent,
  estimateTimeFromDescription,
} from "../smartDefaults";
import { Agent } from "@/types/agent";
import { Task } from "@/types/task";
import { Epic } from "@/types/epic";

describe("smartDefaults", () => {
  describe("extractPriorityFromText", () => {
    it("extracts P0 for urgent keywords", () => {
      expect(extractPriorityFromText("Urgent API fix")).toBe("P0");
      expect(extractPriorityFromText("Critical bug in login")).toBe("P0");
      expect(extractPriorityFromText("Blocker: database down")).toBe("P0");
      expect(extractPriorityFromText("Emergency hotfix needed")).toBe("P0");
      expect(extractPriorityFromText("ASAP response fix")).toBe("P0");
    });

    it("extracts P1 for important keywords", () => {
      expect(extractPriorityFromText("Important feature request")).toBe("P1");
      expect(extractPriorityFromText("High priority task")).toBe("P1");
      expect(extractPriorityFromText("Breaking change required")).toBe("P1");
      expect(extractPriorityFromText("Severe performance issue")).toBe("P1");
    });

    it("extracts P3 for low-priority keywords", () => {
      expect(extractPriorityFromText("Low priority tweak")).toBe("P3");
      expect(extractPriorityFromText("Minor UI adjustment")).toBe("P3");
      expect(extractPriorityFromText("Nice to have feature")).toBe("P3");
      expect(extractPriorityFromText("Someday refactor")).toBe("P3");
    });

    it("defaults to P2 when no keywords match", () => {
      expect(extractPriorityFromText("Refactor utils")).toBe("P2");
      expect(extractPriorityFromText("Update dependencies")).toBe("P2");
      expect(extractPriorityFromText("Add unit tests")).toBe("P2");
    });

    it("is case-insensitive", () => {
      expect(extractPriorityFromText("URGENT ISSUE")).toBe("P0");
      expect(extractPriorityFromText("ImPoRtAnT task")).toBe("P1");
      expect(extractPriorityFromText("LOW priority")).toBe("P3");
    });

    it("prefers first matching priority level", () => {
      // "critical" is P0, should not match P1
      expect(extractPriorityFromText("Critical but important")).toBe("P0");
    });
  });

  describe("detectEpicFromTitle", () => {
    const epics: Epic[] = [
      { _id: "epic1", title: "Authentication System", status: "active" },
      { _id: "epic2", title: "Payment Integration", status: "active" },
      { _id: "epic3", title: "Real-time Notifications", status: "active" },
    ];

    it("matches epic title words in task title", () => {
      expect(detectEpicFromTitle("Update authentication", epics)).toBe("epic1");
      expect(detectEpicFromTitle("Implement payment flow", epics)).toBe("epic2");
      expect(detectEpicFromTitle("Fix real-time notification bug", epics)).toBe("epic3");
    });

    it("skips short words (< 4 chars)", () => {
      const shortWordEpic: Epic[] = [
        { _id: "epic1", title: "API Design", status: "active" },
      ];
      // "API" is only 3 chars, should not match
      expect(detectEpicFromTitle("Improve API docs", shortWordEpic)).toBeNull();
      // "Design" is 6 chars, so it matches
      expect(detectEpicFromTitle("Implement Design system", shortWordEpic)).toBe("epic1");
    });

    it("is case-insensitive", () => {
      expect(detectEpicFromTitle("UPDATE AUTHENTICATION", epics)).toBe("epic1");
      expect(detectEpicFromTitle("implement payment", epics)).toBe("epic2");
    });

    it("returns null when no epic matches", () => {
      expect(detectEpicFromTitle("Refactor utils", epics)).toBeNull();
      expect(detectEpicFromTitle("Fix typo", epics)).toBeNull();
    });

    it("returns null for empty epic list", () => {
      expect(detectEpicFromTitle("Authentication", [])).toBeNull();
    });

    it("handles epic.name fallback", () => {
      const epicWithName: Epic[] = [
        { _id: "epic1", title: "", name: "Payment System", status: "active" },
      ];
      expect(detectEpicFromTitle("Implement Payment", epicWithName)).toBe("epic1");
    });

    it("prefers first matching epic", () => {
      const overlappingEpics: Epic[] = [
        { _id: "epic1", title: "Authentication System", status: "active" },
        { _id: "epic2", title: "System Design", status: "active" },
      ];
      expect(detectEpicFromTitle("Update System", overlappingEpics)).toBe("epic1");
    });
  });

  describe("findLeastLoadedAgent", () => {
    const agents: Agent[] = [
      { _id: "agent1", name: "Alice" } as Agent,
      { _id: "agent2", name: "Bob" } as Agent,
      { _id: "agent3", name: "Charlie" } as Agent,
    ];

    it("returns agent with fewest in_progress tasks", () => {
      const tasks: Task[] = [
        {
          _id: "task1",
          title: "Task 1",
          status: "in_progress",
          assigneeIds: ["agent1", "agent2"],
        } as Task,
        {
          _id: "task2",
          title: "Task 2",
          status: "in_progress",
          assigneeIds: ["agent1"],
        } as Task,
        {
          _id: "task3",
          title: "Task 3",
          status: "in_progress",
          assigneeIds: ["agent2"],
        } as Task,
      ];
      // agent1: 2, agent2: 2, agent3: 0 → agent3 is least loaded
      expect(findLeastLoadedAgent(agents, tasks)).toBe("agent3");
    });

    it("counts review tasks as active", () => {
      const tasks: Task[] = [
        {
          _id: "task1",
          title: "Task 1",
          status: "review",
          assigneeIds: ["agent1"],
        } as Task,
        {
          _id: "task2",
          title: "Task 2",
          status: "in_progress",
          assigneeIds: ["agent2"],
        } as Task,
      ];
      // agent1: 1 (review), agent2: 1 (in_progress), agent3: 0 → agent3
      expect(findLeastLoadedAgent(agents, tasks)).toBe("agent3");
    });

    it("ignores tasks with other statuses", () => {
      const tasks: Task[] = [
        {
          _id: "task1",
          title: "Task 1",
          status: "done",
          assigneeIds: ["agent1"],
        } as Task,
        {
          _id: "task2",
          title: "Task 2",
          status: "backlog",
          assigneeIds: ["agent2"],
        } as Task,
        {
          _id: "task3",
          title: "Task 3",
          status: "blocked",
          assigneeIds: ["agent3"],
        } as Task,
      ];
      // All have 0 active tasks, should return first (or any with equal count)
      const result = findLeastLoadedAgent(agents, tasks);
      expect(["agent1", "agent2", "agent3"]).toContain(result);
    });

    it("handles multiple assignees per task", () => {
      const tasks: Task[] = [
        {
          _id: "task1",
          title: "Task 1",
          status: "in_progress",
          assigneeIds: ["agent1", "agent2", "agent3"],
        } as Task,
      ];
      // All have 1 in_progress task, any could be returned
      const result = findLeastLoadedAgent(agents, tasks);
      expect(["agent1", "agent2", "agent3"]).toContain(result);
    });

    it("returns null for empty agents", () => {
      const tasks: Task[] = [];
      expect(findLeastLoadedAgent([], tasks)).toBeNull();
    });

    it("returns an agent when no tasks exist", () => {
      expect(findLeastLoadedAgent(agents, [])).toBe(agents[0]._id);
    });

    it("ignores agents not in the agent list", () => {
      const tasks: Task[] = [
        {
          _id: "task1",
          title: "Task 1",
          status: "in_progress",
          assigneeIds: ["unknown-agent"],
        } as Task,
      ];
      // "unknown-agent" is not in agents, so all agents have 0 active tasks
      const result = findLeastLoadedAgent(agents, tasks);
      expect(result).toBe(agents[0]._id);
    });
  });

  describe("estimateTimeFromDescription", () => {
    it("returns null for empty description", () => {
      expect(estimateTimeFromDescription("")).toBeNull();
      expect(estimateTimeFromDescription("   ")).toBeNull();
    });

    it("returns XS for < 100 chars", () => {
      expect(estimateTimeFromDescription("a".repeat(50))).toBe("XS");
      expect(estimateTimeFromDescription("a".repeat(99))).toBe("XS");
    });

    it("returns S for 100-299 chars", () => {
      expect(estimateTimeFromDescription("a".repeat(100))).toBe("S");
      expect(estimateTimeFromDescription("a".repeat(200))).toBe("S");
      expect(estimateTimeFromDescription("a".repeat(299))).toBe("S");
    });

    it("returns M for 300-699 chars", () => {
      expect(estimateTimeFromDescription("a".repeat(300))).toBe("M");
      expect(estimateTimeFromDescription("a".repeat(500))).toBe("M");
      expect(estimateTimeFromDescription("a".repeat(699))).toBe("M");
    });

    it("returns L for 700-1499 chars", () => {
      expect(estimateTimeFromDescription("a".repeat(700))).toBe("L");
      expect(estimateTimeFromDescription("a".repeat(1000))).toBe("L");
      expect(estimateTimeFromDescription("a".repeat(1499))).toBe("L");
    });

    it("returns XL for 1500+ chars", () => {
      expect(estimateTimeFromDescription("a".repeat(1500))).toBe("XL");
      expect(estimateTimeFromDescription("a".repeat(2000))).toBe("XL");
    });

    it("trims whitespace before counting", () => {
      // "   50 chars   " → trimmed to "50 chars" (8 chars) → XS
      expect(estimateTimeFromDescription("   " + "a".repeat(50) + "   ")).toBe("XS");
    });
  });
});
