/**
 * Task state transition rules tests
 */

import { isTransitionAllowed, ALLOWED_TRANSITIONS } from "../taskTransitions";

describe("taskTransitions", () => {
  describe("isTransitionAllowed", () => {
    describe("from backlog", () => {
      it("allows transition to ready", () => {
        expect(isTransitionAllowed("backlog", "ready")).toBe(true);
      });

      it("allows transition to blocked", () => {
        expect(isTransitionAllowed("backlog", "blocked")).toBe(true);
      });

      it("rejects transition to in_progress", () => {
        expect(isTransitionAllowed("backlog", "in_progress")).toBe(false);
      });

      it("rejects transition to review", () => {
        expect(isTransitionAllowed("backlog", "review")).toBe(false);
      });

      it("rejects transition to done", () => {
        expect(isTransitionAllowed("backlog", "done")).toBe(false);
      });

      it("rejects transition to self", () => {
        expect(isTransitionAllowed("backlog", "backlog")).toBe(false);
      });
    });

    describe("from ready", () => {
      it("allows transition to in_progress", () => {
        expect(isTransitionAllowed("ready", "in_progress")).toBe(true);
      });

      it("allows transition to backlog", () => {
        expect(isTransitionAllowed("ready", "backlog")).toBe(true);
      });

      it("allows transition to blocked", () => {
        expect(isTransitionAllowed("ready", "blocked")).toBe(true);
      });

      it("rejects transition to review", () => {
        expect(isTransitionAllowed("ready", "review")).toBe(false);
      });

      it("rejects transition to done", () => {
        expect(isTransitionAllowed("ready", "done")).toBe(false);
      });
    });

    describe("from in_progress", () => {
      it("allows transition to review", () => {
        expect(isTransitionAllowed("in_progress", "review")).toBe(true);
      });

      it("allows transition to blocked", () => {
        expect(isTransitionAllowed("in_progress", "blocked")).toBe(true);
      });

      it("allows transition to done", () => {
        expect(isTransitionAllowed("in_progress", "done")).toBe(true);
      });

      it("allows transition to ready", () => {
        expect(isTransitionAllowed("in_progress", "ready")).toBe(true);
      });

      it("rejects transition to backlog", () => {
        expect(isTransitionAllowed("in_progress", "backlog")).toBe(false);
      });
    });

    describe("from review", () => {
      it("allows transition to done", () => {
        expect(isTransitionAllowed("review", "done")).toBe(true);
      });

      it("allows transition to in_progress", () => {
        expect(isTransitionAllowed("review", "in_progress")).toBe(true);
      });

      it("allows transition to blocked", () => {
        expect(isTransitionAllowed("review", "blocked")).toBe(true);
      });

      it("rejects transition to ready", () => {
        expect(isTransitionAllowed("review", "ready")).toBe(false);
      });

      it("rejects transition to backlog", () => {
        expect(isTransitionAllowed("review", "backlog")).toBe(false);
      });
    });

    describe("from blocked", () => {
      it("allows transition to ready", () => {
        expect(isTransitionAllowed("blocked", "ready")).toBe(true);
      });

      it("allows transition to backlog", () => {
        expect(isTransitionAllowed("blocked", "backlog")).toBe(true);
      });

      it("rejects transition to in_progress", () => {
        expect(isTransitionAllowed("blocked", "in_progress")).toBe(false);
      });

      it("rejects transition to review", () => {
        expect(isTransitionAllowed("blocked", "review")).toBe(false);
      });

      it("rejects transition to done", () => {
        expect(isTransitionAllowed("blocked", "done")).toBe(false);
      });
    });

    describe("from done (terminal state)", () => {
      it("rejects transition to any state", () => {
        expect(isTransitionAllowed("done", "done")).toBe(false);
        expect(isTransitionAllowed("done", "backlog")).toBe(false);
        expect(isTransitionAllowed("done", "ready")).toBe(false);
        expect(isTransitionAllowed("done", "in_progress")).toBe(false);
        expect(isTransitionAllowed("done", "review")).toBe(false);
        expect(isTransitionAllowed("done", "blocked")).toBe(false);
      });
    });

    describe("unknown status", () => {
      it("rejects transition from unknown status", () => {
        expect(isTransitionAllowed("unknown", "ready")).toBe(false);
      });

      it("handles undefined source status gracefully", () => {
        expect(isTransitionAllowed("nonexistent", "done")).toBe(false);
      });
    });
  });

  describe("ALLOWED_TRANSITIONS", () => {
    it("defines transitions for all core statuses", () => {
      expect(ALLOWED_TRANSITIONS).toHaveProperty("backlog");
      expect(ALLOWED_TRANSITIONS).toHaveProperty("ready");
      expect(ALLOWED_TRANSITIONS).toHaveProperty("in_progress");
      expect(ALLOWED_TRANSITIONS).toHaveProperty("review");
      expect(ALLOWED_TRANSITIONS).toHaveProperty("blocked");
      expect(ALLOWED_TRANSITIONS).toHaveProperty("done");
    });

    it("marks done as terminal (no valid transitions)", () => {
      expect(ALLOWED_TRANSITIONS.done).toEqual([]);
    });

    it("all transition targets exist as valid statuses", () => {
      const validStatuses = Object.keys(ALLOWED_TRANSITIONS);
      Object.values(ALLOWED_TRANSITIONS).forEach((targets) => {
        targets.forEach((target) => {
          expect(validStatuses).toContain(target);
        });
      });
    });
  });
});
