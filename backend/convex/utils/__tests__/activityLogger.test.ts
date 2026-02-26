/**
 * Activity logging utilities tests
 */

import { resolveActorName } from "../activityLogger";
import { MutationCtx } from "../../_generated/server";

describe("activityLogger", () => {
  describe("resolveActorName", () => {
    const mockDb = {
      get: jest.fn(),
    };

    const mockCtx = { db: mockDb } as unknown as MutationCtx;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("resolves 'user' to 'You'", async () => {
      const result = await resolveActorName(mockCtx, "user");
      expect(result).toBe("You");
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    it("resolves 'system' to 'Mission Control'", async () => {
      const result = await resolveActorName(mockCtx, "system");
      expect(result).toBe("Mission Control");
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    it("resolves system-prefixed actors to 'Mission Control'", async () => {
      const result = await resolveActorName(mockCtx, "system:auto-claim");
      expect(result).toBe("Mission Control");
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    it("fetches agent by ID from database", async () => {
      const mockAgent = { name: "Agent Alice", _id: "agent-123" };
      mockDb.get.mockResolvedValueOnce(mockAgent);

      const result = await resolveActorName(mockCtx, "agent-123");

      expect(result).toBe("Agent Alice");
      expect(mockDb.get).toHaveBeenCalledWith("agent-123");
    });

    it("falls back to actor ID if agent not found", async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await resolveActorName(mockCtx, "agent-404");

      expect(result).toBe("agent-404");
    });

    it("falls back to actor ID if agent has no name", async () => {
      const mockAgent = { _id: "agent-789" }; // No name property
      mockDb.get.mockResolvedValueOnce(mockAgent);

      const result = await resolveActorName(mockCtx, "agent-789");

      expect(result).toBe("agent-789");
    });

    it("gracefully handles database errors", async () => {
      mockDb.get.mockRejectedValueOnce(new Error("DB error"));

      const result = await resolveActorName(mockCtx, "invalid-id");

      expect(result).toBe("invalid-id");
    });

    it("handles invalid Convex IDs gracefully", async () => {
      mockDb.get.mockRejectedValueOnce(new Error("Invalid ID format"));

      const result = await resolveActorName(mockCtx, "not-a-valid-id");

      expect(result).toBe("not-a-valid-id");
    });
  });
});
