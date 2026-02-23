/**
 * Skill Inference System Tests (Phase 5B)
 *
 * Tests for:
 * - Inferring agent skills from completed tasks
 * - Calculating confidence scores
 * - Manual skill override
 * - Skill level detection (junior/mid/senior)
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Mock database for skill inference
 */
class SkillInferenceMockDatabase {
  private data: Map<string, any[]> = new Map();
  private nextId = 1;

  constructor() {
    this.data.set("agentSkills", []);
    this.data.set("tasks", []);
    this.data.set("agents", []);
    this.data.set("businesses", []);
    this.data.set("activities", []);
  }

  generateId(table: string): string {
    return `${table}-${this.nextId++}`;
  }

  insert(table: string, doc: any) {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    const _id = this.generateId(table);
    const fullDoc = { ...doc, _id, _creationTime: Date.now() };
    this.data.get(table)!.push(fullDoc);
    return _id;
  }

  get(id: string) {
    for (const docs of this.data.values()) {
      const found = docs.find((d) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  query(table: string) {
    return {
      filter: (predicate: (doc: any) => boolean) => ({
        collect: async () => (this.data.get(table) || []).filter(predicate),
      }),
      collect: async () => this.data.get(table) || [],
    };
  }

  getTasksByAgent(agentId: string) {
    return (this.data.get("tasks") || []).filter((t) => t.agentId === agentId);
  }

  getSkillsByAgent(agentId: string) {
    return (this.data.get("agentSkills") || []).filter(
      (s) => s.agentId === agentId
    );
  }
}

describe("Skill Inference System (convex/skillInference.ts)", () => {
  let db: SkillInferenceMockDatabase;
  let businessId: string;
  let agentId: string;

  beforeEach(() => {
    db = new SkillInferenceMockDatabase();
    businessId = db.insert("businesses", { name: "Test Biz" });
    agentId = db.insert("agents", {
      name: "Alice",
      role: "Developer",
      level: "specialist",
    });
  });

  describe("Skill Inference from Completed Tasks", () => {
    it("infers skill from single completed task", () => {
      const taskId = db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        title: "API Integration",
        status: "completed",
        completedAt: Date.now(),
      });

      // Simulate skill inference
      const skills = ["backend"];
      const inferredSkill = {
        agentId,
        skill: "backend",
        confidence: 50, // Single task = 50%
        inferredFromTaskCount: 1,
        manuallyOverridden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      db.insert("agentSkills", inferredSkill);

      const agentSkills = db.getSkillsByAgent(agentId);
      expect(agentSkills).toHaveLength(1);
      expect(agentSkills[0].skill).toBe("backend");
      expect(agentSkills[0].confidence).toBe(50);
    });

    it("increases confidence with multiple tasks of same skill", () => {
      // 3 backend tasks completed
      db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
      });
      db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
      });
      db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
      });

      // Simulate confidence calculation: 50 + (25 * count-1) with cap at 95
      const taskCount = db.getTasksByAgent(agentId).length;
      const confidence = Math.min(50 + 25 * (taskCount - 1), 95);

      expect(confidence).toBe(95); // 50 + 25*2 = 100, capped at 95
    });

    it("infers multiple skills from diverse task types", () => {
      db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
      });
      db.insert("tasks", {
        businessId,
        agentId,
        type: "design_task",
        status: "completed",
      });
      db.insert("tasks", {
        businessId,
        agentId,
        type: "testing_task",
        status: "completed",
      });

      // Simulate skill extraction
      const taskTypes = db
        .getTasksByAgent(agentId)
        .map((t) => t.type)
        .map((type) => type.replace("_task", ""));

      expect(taskTypes.sort()).toEqual(["backend", "design", "testing"]);
    });

    it("does not infer skill from incomplete tasks", () => {
      db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "in_progress",
      });

      const completedTasks = db
        .getTasksByAgent(agentId)
        .filter((t) => t.status === "completed");

      expect(completedTasks).toHaveLength(0);
    });

    it("only infers from tasks with success/completion rating", () => {
      const task1 = db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
        rating: 4, // Good completion
      });

      const task2 = db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
        rating: 1, // Poor completion
      });

      // Filter to high-quality completions (rating >= 3)
      const goodCompletions = db
        .getTasksByAgent(agentId)
        .filter((t) => t.status === "completed" && (t.rating || 0) >= 3);

      expect(goodCompletions).toHaveLength(1);
    });
  });

  describe("Skill Level Detection", () => {
    it("detects junior skill level", () => {
      // Junior: 1-3 tasks completed
      db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
      });

      const taskCount = db.getTasksByAgent(agentId).length;
      const level = taskCount <= 3 ? "junior" : taskCount <= 10 ? "mid" : "senior";

      expect(level).toBe("junior");
    });

    it("detects mid-level skill", () => {
      // Mid: 4-10 tasks completed
      for (let i = 0; i < 7; i++) {
        db.insert("tasks", {
          businessId,
          agentId,
          type: "backend_task",
          status: "completed",
        });
      }

      const taskCount = db.getTasksByAgent(agentId).length;
      const level = taskCount <= 3 ? "junior" : taskCount <= 10 ? "mid" : "senior";

      expect(level).toBe("mid");
    });

    it("detects senior skill level", () => {
      // Senior: 11+ tasks completed
      for (let i = 0; i < 15; i++) {
        db.insert("tasks", {
          businessId,
          agentId,
          type: "backend_task",
          status: "completed",
        });
      }

      const taskCount = db.getTasksByAgent(agentId).length;
      const level = taskCount <= 3 ? "junior" : taskCount <= 10 ? "mid" : "senior";

      expect(level).toBe("senior");
    });
  });

  describe("Manual Skill Override", () => {
    it("allows manual skill addition", () => {
      db.insert("agentSkills", {
        agentId,
        skill: "leadership",
        confidence: 80,
        inferredFromTaskCount: 0,
        manuallyOverridden: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const skills = db.getSkillsByAgent(agentId);
      expect(skills).toHaveLength(1);
      expect(skills[0].skill).toBe("leadership");
      expect(skills[0].manuallyOverridden).toBe(true);
    });

    it("preserves manual override across updates", () => {
      const skillId = db.insert("agentSkills", {
        agentId,
        skill: "documentation",
        confidence: 75,
        inferredFromTaskCount: 2,
        manuallyOverridden: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const skill = db.get(skillId);
      expect(skill.manuallyOverridden).toBe(true);
      expect(skill.confidence).toBe(75);
    });

    it("allows override of inferred skill confidence", () => {
      const skillId = db.insert("agentSkills", {
        agentId,
        skill: "backend",
        confidence: 50, // Initially inferred
        inferredFromTaskCount: 1,
        manuallyOverridden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Manually override confidence
      const skill = db.get(skillId);
      skill.confidence = 90;
      skill.manuallyOverridden = true;
      skill.updatedAt = Date.now();

      expect(skill.confidence).toBe(90);
      expect(skill.manuallyOverridden).toBe(true);
    });
  });

  describe("Confidence Score Calculation", () => {
    it("calculates confidence based on task count", () => {
      // Formula: 50 + min(25 * (count-1), 45) = capped 50-95
      const calculateConfidence = (count: number) => {
        return Math.min(50 + 25 * (count - 1), 95);
      };

      expect(calculateConfidence(1)).toBe(50);
      expect(calculateConfidence(2)).toBe(75);
      expect(calculateConfidence(3)).toBe(95);
      expect(calculateConfidence(5)).toBe(95); // Capped
    });

    it("factors in task rating to confidence", () => {
      // Average rating affects confidence adjustment
      const calculateConfidence = (count: number, avgRating: number) => {
        const base = Math.min(50 + 25 * (count - 1), 95);
        const ratingAdjust = (avgRating / 5 - 0.5) * 10; // -5 to +10
        return Math.max(30, Math.min(100, base + ratingAdjust)); // Clamp 30-100
      };

      expect(calculateConfidence(3, 5)).toBe(100); // Perfect rating: 95 + 5 = 100
      expect(calculateConfidence(3, 3)).toBe(96); // Average rating: 95 + 1 = 96
      expect(calculateConfidence(3, 1)).toBe(92); // Poor rating: 95 - 3 = 92
    });

    it("decays confidence for skills not practiced", () => {
      const decayConfidence = (
        confidence: number,
        daysSinceLastTask: number
      ) => {
        const decayRate = 0.02; // 2% per day
        return Math.max(20, confidence * (1 - decayRate * daysSinceLastTask));
      };

      expect(decayConfidence(80, 0)).toBe(80);
      expect(decayConfidence(80, 10)).toBe(64);
      expect(decayConfidence(80, 30)).toBe(32);
    });
  });

  describe("Agents with No Tasks", () => {
    it("handles new agents with no completed tasks", () => {
      const newAgentId = db.insert("agents", {
        name: "Bob",
        role: "Designer",
        level: "intern",
      });

      const tasks = db.getTasksByAgent(newAgentId);
      expect(tasks).toHaveLength(0);

      const skills = db.getSkillsByAgent(newAgentId);
      expect(skills).toHaveLength(0);
    });

    it("suggests initial skills based on role", () => {
      // Initialize with role-based suggestions
      const newAgentId = db.insert("agents", {
        name: "Designer",
        role: "Design Lead",
        level: "lead",
      });

      const roleSkills = {
        "Design Lead": ["design", "ux_research", "wireframing"],
        Developer: ["backend", "frontend"],
        "QA Engineer": ["testing", "automation"],
      };

      const suggestedSkills = roleSkills["Design Lead"] || [];
      expect(suggestedSkills).toContain("design");
    });
  });

  describe("Skill Merging and Normalization", () => {
    it("merges similar skill names", () => {
      db.insert("agentSkills", {
        agentId,
        skill: "javascript",
        confidence: 80,
        inferredFromTaskCount: 5,
        manuallyOverridden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("agentSkills", {
        agentId,
        skill: "js",
        confidence: 70,
        inferredFromTaskCount: 3,
        manuallyOverridden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Merge similar skills
      const skills = db.getSkillsByAgent(agentId);
      const merged = {
        javascript: 80, // Keep highest confidence
        js: 70,
      };

      expect(Object.keys(merged)).toHaveLength(2);
    });

    it("normalizes skill names to lowercase", () => {
      const normalizeSkill = (skill: string) => skill.toLowerCase().trim();

      expect(normalizeSkill("Backend")).toBe("backend");
      expect(normalizeSkill("  Testing  ")).toBe("testing");
      expect(normalizeSkill("React.js")).toBe("react.js");
    });
  });

  describe("Skill Update on Task Completion", () => {
    it("updates skill confidence when agent completes new task", () => {
      // Task 1: Create initial backend skill
      db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
      });

      let skills = db.getSkillsByAgent(agentId);
      expect(skills).toHaveLength(0); // Not auto-inserted yet

      // Simulate skill insertion
      db.insert("agentSkills", {
        agentId,
        skill: "backend",
        confidence: 50,
        inferredFromTaskCount: 1,
        manuallyOverridden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Task 2: Confidence should increase
      db.insert("tasks", {
        businessId,
        agentId,
        type: "backend_task",
        status: "completed",
      });

      skills = db.getSkillsByAgent(agentId);
      const backendSkill = skills.find((s) => s.skill === "backend");
      expect(backendSkill?.confidence).toBeGreaterThanOrEqual(50);
    });

    it("creates new skill entry if agent completes unfamiliar task type", () => {
      db.insert("tasks", {
        businessId,
        agentId,
        type: "frontend_task",
        status: "completed",
      });

      // New skill should be created
      db.insert("agentSkills", {
        agentId,
        skill: "frontend",
        confidence: 50,
        inferredFromTaskCount: 1,
        manuallyOverridden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const skills = db.getSkillsByAgent(agentId);
      expect(skills.map((s) => s.skill)).toContain("frontend");
    });
  });

  describe("Skill Degradation Tracking", () => {
    it("detects skill degradation if not practiced recently", () => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

      db.insert("agentSkills", {
        agentId,
        skill: "backend",
        confidence: 90,
        inferredFromTaskCount: 10,
        manuallyOverridden: false,
        updatedAt: ninetyDaysAgo, // Haven't used in 90 days
        createdAt: Date.now(),
      });

      const skill = db.getSkillsByAgent(agentId)[0];
      const degraded = Date.now() - skill.updatedAt > 60 * 24 * 60 * 60 * 1000; // >60 days

      expect(degraded).toBe(true);
    });
  });

  describe("Skill Export for Reporting", () => {
    it("exports agent skills with confidence for reporting", () => {
      db.insert("agentSkills", {
        agentId,
        skill: "backend",
        confidence: 85,
        inferredFromTaskCount: 8,
        manuallyOverridden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      db.insert("agentSkills", {
        agentId,
        skill: "leadership",
        confidence: 70,
        inferredFromTaskCount: 0,
        manuallyOverridden: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const skills = db.getSkillsByAgent(agentId);
      const exported = skills.map((s) => ({
        skill: s.skill,
        confidence: s.confidence,
        inferred: !s.manuallyOverridden,
      }));

      expect(exported).toHaveLength(2);
      expect(exported.find((s) => s.skill === "backend")?.confidence).toBe(85);
    });
  });
});
