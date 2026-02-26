/**
 * Epic-task synchronization tests
 */

import { syncEpicTaskLink } from "../epicTaskSync";
import { MutationCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";

describe("epicTaskSync", () => {
  describe("syncEpicTaskLink", () => {
    let mockDb: {
      get: jest.Mock;
      patch: jest.Mock;
    };
    let mockCtx: MutationCtx;

    beforeEach(() => {
      mockDb = {
        get: jest.fn(),
        patch: jest.fn(),
      };
      mockCtx = { db: mockDb } as unknown as MutationCtx;
    });

    const taskId = "task-123" as Id<"tasks">;
    const oldEpicId = "epic-old" as Id<"epics">;
    const newEpicId = "epic-new" as Id<"epics">;

    it("removes task from old epic when moving to a new epic", async () => {
      const oldEpic = {
        _id: oldEpicId,
        taskIds: [taskId, "task-456"],
      };

      mockDb.get.mockResolvedValueOnce(oldEpic);

      await syncEpicTaskLink(mockCtx, taskId, oldEpicId, newEpicId);

      expect(mockDb.patch).toHaveBeenCalledWith(oldEpicId, {
        taskIds: ["task-456"],
        updatedAt: expect.any(Number),
      });
    });

    it("adds task to new epic", async () => {
      const newEpic = {
        _id: newEpicId,
        taskIds: ["task-456"],
      };

      // Only one call to get since oldEpicId is undefined
      mockDb.get.mockResolvedValueOnce(newEpic);

      await syncEpicTaskLink(mockCtx, taskId, undefined, newEpicId);

      expect(mockDb.patch).toHaveBeenCalledWith(newEpicId, {
        taskIds: ["task-456", taskId],
        updatedAt: expect.any(Number),
      });
    });

    it("deduplicates when task already in new epic", async () => {
      const newEpic = {
        _id: newEpicId,
        taskIds: [taskId, "task-456"], // task already present
      };

      mockDb.get.mockResolvedValueOnce(null); // no old epic
      mockDb.get.mockResolvedValueOnce(newEpic);

      await syncEpicTaskLink(mockCtx, taskId, undefined, newEpicId);

      // Should not call patch if task already exists (deduplication)
      expect(mockDb.patch).not.toHaveBeenCalled();
    });

    it("handles null old epic (moving to new epic from nothing)", async () => {
      const newEpic = {
        _id: newEpicId,
        taskIds: [],
      };

      mockDb.get.mockResolvedValueOnce(newEpic);

      await syncEpicTaskLink(mockCtx, taskId, undefined, newEpicId);

      expect(mockDb.patch).toHaveBeenCalledWith(newEpicId, {
        taskIds: [taskId],
        updatedAt: expect.any(Number),
      });
    });

    it("handles null new epic (removing from epic)", async () => {
      const oldEpic = {
        _id: oldEpicId,
        taskIds: [taskId, "task-456"],
      };

      mockDb.get.mockResolvedValueOnce(oldEpic);

      await syncEpicTaskLink(mockCtx, taskId, oldEpicId, undefined);

      expect(mockDb.patch).toHaveBeenCalledWith(oldEpicId, {
        taskIds: ["task-456"],
        updatedAt: expect.any(Number),
      });
    });

    it("handles both epics being the same (no-op)", async () => {
      const epic = {
        _id: oldEpicId,
        taskIds: [taskId, "task-456"], // task already exists
      };

      mockDb.get.mockResolvedValueOnce(epic);

      await syncEpicTaskLink(mockCtx, taskId, oldEpicId, oldEpicId);

      // Should only check new epic (same as old), not patch since task already exists
      expect(mockDb.get).toHaveBeenCalledTimes(1);
      expect(mockDb.get).toHaveBeenCalledWith(oldEpicId);
      expect(mockDb.patch).not.toHaveBeenCalled();
    });

    it("handles old epic not found gracefully", async () => {
      mockDb.get.mockResolvedValueOnce(null); // old epic not found
      mockDb.get.mockResolvedValueOnce({ _id: newEpicId, taskIds: [] }); // new epic exists

      await syncEpicTaskLink(mockCtx, taskId, oldEpicId, newEpicId);

      // Should only patch new epic
      expect(mockDb.patch).toHaveBeenCalledTimes(1);
      expect(mockDb.patch).toHaveBeenCalledWith(newEpicId, expect.any(Object));
    });

    it("handles new epic not found gracefully", async () => {
      const oldEpic = {
        _id: oldEpicId,
        taskIds: [taskId],
      };

      mockDb.get.mockResolvedValueOnce(oldEpic);
      mockDb.get.mockResolvedValueOnce(null); // new epic not found

      await syncEpicTaskLink(mockCtx, taskId, oldEpicId, newEpicId);

      // Should only patch old epic to remove task
      expect(mockDb.patch).toHaveBeenCalledTimes(1);
      expect(mockDb.patch).toHaveBeenCalledWith(oldEpicId, expect.any(Object));
    });
  });
});
